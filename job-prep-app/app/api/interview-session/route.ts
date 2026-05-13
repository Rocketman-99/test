import { getClient, buildProfileContext } from "@/lib/claude";
import type { UserProfile } from "@/types/user";
import Anthropic from "@anthropic-ai/sdk";

export interface InterviewSettings {
  difficulty: "normal" | "pressure";
  totalQuestions: number;
  interviewType: "job_round" | "executive_round";
  questionNumber: number;
  isLastQuestion: boolean;
  mode?: "text" | "voice";
  resumeContext?: string;
}

const DIFFICULTY_GUIDE: Record<string, string> = {
  normal: "친절하고 편안한 분위기로 진행하세요. 답변이 불완전해도 부드럽게 유도하세요.",
  pressure:
    "압박 면접 모드입니다. 날카롭게 반론을 제기하고, 답변의 허점을 파고들고, 재질문을 통해 압박하세요. 단, 무례하지는 않게 하세요.",
};

const TYPE_GUIDE: Record<string, string> = {
  job_round: `[1차 직무면접] 직무 역량과 실무 적합성 검증에 집중하세요.
질문 출처 비중: 직무 기술 50% / 자기소개서 기반(직무 관련 경험) 35% / 기업·산업 기반 15%.
BEI(행동사건면접)와 SI(상황면접) 위주로, 실제 업무 상황에서의 판단력·문제해결력을 파악하세요.`,
  executive_round: `[2차 임원면접] 인성·가치관·조직 적합성 검증에 집중하세요.
질문 출처 비중: 인성·가치관 45% / 자기소개서 기반(성장·동기) 35% / 기업·산업 기반(입사 의지·비전) 20%.
깊이 있는 가치관 질문, 리더십·협업 경험, 회사에 대한 이해와 입사 의지를 중점적으로 탐색하세요.`,
};

export async function POST(request: Request) {
  const body = await request.json();
  const { profile, messages, settings, questionBank, apiKey } = body as {
    profile: UserProfile;
    messages: Anthropic.MessageParam[];
    settings: InterviewSettings;
    questionBank?: string;
    apiKey?: string;
    resumeContext?: string;
  };

  let client: Anthropic;
  try {
    client = getClient(apiKey);
  } catch {
    return Response.json({ error: "API 키가 없습니다." }, { status: 400 });
  }

  const profileContext = buildProfileContext(profile);
  const { difficulty, totalQuestions, interviewType, questionNumber, isLastQuestion } = settings;

  const roundLabel = interviewType === "job_round" ? "1차 직무면접" : "2차 임원면접";

  const progressNote =
    questionNumber === 0
      ? `지금은 ${roundLabel} 시작 단계입니다. 간단히 자기소개를 요청한 후 첫 번째 질문을 해주세요.`
      : isLastQuestion
        ? `지금은 마지막 답변(${questionNumber}번째)을 들은 상태입니다. 짧게 수고했다는 말과 면접 종료 인사만 해주세요. 평가나 피드백은 절대 하지 마세요.`
        : `지금은 ${questionNumber}번째 답변을 들은 상태입니다. 피드백 없이 바로 ${questionNumber + 1}번째 질문만 해주세요.`;

  const questionBankSection = questionBank
    ? `\n[사전 준비된 질문 뱅크]\n아래 질문 뱅크를 면접 진행의 주요 재료로 활용하세요. 순서에 얽매이지 말고 대화 흐름에 맞게 자연스럽게 선택·변형해서 사용하세요.\n${questionBank}\n`
    : "";

  const resumeSection = settings.resumeContext
    ? `\n[제출 서류]\n${settings.resumeContext}\n`
    : "";

  const systemPrompt = `당신은 ${roundLabel} 전문 면접관입니다. 아래 지원자의 정보를 숙지하고 실제 면접처럼 진행해주세요.

[지원자 프로필]
${profileContext}
${resumeSection}${questionBankSection}

[면접 설정]
- 면접 유형: ${roundLabel}
- 총 질문 수: ${totalQuestions}개
- 난이도: ${difficulty === "normal" ? "일반" : "압박"} 면접

[진행 지침]
${DIFFICULTY_GUIDE[difficulty]}
${TYPE_GUIDE[interviewType]}

[현재 상태]
${progressNote}

[형식 규칙]
- 질문은 반드시 한 번에 하나만, 출처가 자연스럽게 드러나지 않도록 할 것
- 꼬리 질문은 이전 답변 내용을 직접 인용해서 연결
- 마지막에는 짧은 종료 인사만 할 것. 피드백과 평가는 별도 제공 예정
- 모든 응답은 한국어로, 자연스러운 면접관 말투로`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const starterMessage: Anthropic.MessageParam = { role: "user", content: "면접을 시작해주세요." };
        const effectiveMessages: Anthropic.MessageParam[] = [starterMessage, ...messages];

        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: systemPrompt,
          messages: effectiveMessages,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const msg =
          err instanceof Anthropic.AuthenticationError
            ? "API 키가 유효하지 않습니다."
            : err instanceof Anthropic.RateLimitError
              ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
              : raw;
        controller.enqueue(encoder.encode(`[오류] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
