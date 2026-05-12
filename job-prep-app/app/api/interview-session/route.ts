import { getClient, buildProfileContext } from "@/lib/claude";
import type { UserProfile } from "@/types/user";
import Anthropic from "@anthropic-ai/sdk";

export interface InterviewSettings {
  difficulty: "normal" | "pressure";
  totalQuestions: number;
  interviewType: "personal" | "job" | "mixed";
  questionNumber: number;
  isLastQuestion: boolean;
}

const DIFFICULTY_GUIDE: Record<string, string> = {
  normal: "친절하고 편안한 분위기로 진행하세요. 답변이 불완전해도 부드럽게 유도하세요.",
  pressure:
    "압박 면접 모드입니다. 날카롭게 반론을 제기하고, 답변의 허점을 파고들고, 재질문을 통해 압박하세요. 단, 무례하지는 않게 하세요.",
};

const TYPE_GUIDE: Record<string, string> = {
  personal: "인성 면접 중심으로 진행하세요. 가치관, 협업 경험, 성격, 실패 경험 등을 물어보세요.",
  job: "직무 역량 면접 중심으로 진행하세요. 기술 지식, 프로젝트 경험, 직무 관련 상황 판단력을 물어보세요.",
  mixed: "인성과 직무 역량을 균형 있게 섞어서 진행하세요.",
};

export async function POST(request: Request) {
  const body = await request.json();
  const { profile, messages, settings, apiKey } = body as {
    profile: UserProfile;
    messages: Anthropic.MessageParam[];
    settings: InterviewSettings;
    apiKey?: string;
  };

  let client: Anthropic;
  try {
    client = getClient(apiKey);
  } catch {
    return Response.json({ error: "API 키가 없습니다." }, { status: 400 });
  }

  const profileContext = buildProfileContext(profile);
  const { difficulty, totalQuestions, interviewType, questionNumber, isLastQuestion } = settings;

  const progressNote =
    questionNumber === 0
      ? "지금은 면접 시작 단계입니다. 간단히 자기소개 후 첫 번째 질문을 해주세요."
      : isLastQuestion
        ? `지금은 마지막(${questionNumber}번째) 질문입니다. 답변에 피드백 후 종합 평가를 제공하고 면접을 마무리해주세요.`
        : `지금은 ${questionNumber}번째 답변에 대한 피드백 후 ${questionNumber + 1}번째 질문을 해주세요.`;

  const systemPrompt = `당신은 전문 채용 면접관입니다. 아래 지원자의 정보와 지시에 따라 면접을 진행해주세요.

[지원자 프로필]
${profileContext}

[면접 설정]
- 총 질문 수: ${totalQuestions}개
- 난이도: ${difficulty === "normal" ? "일반" : "압박"} 면접
- 유형: ${interviewType === "personal" ? "인성" : interviewType === "job" ? "직무" : "혼합"}

[진행 지침]
${DIFFICULTY_GUIDE[difficulty]}
${TYPE_GUIDE[interviewType]}

[현재 상태]
${progressNote}

[형식 규칙]
- 답변 피드백은 구체적으로: 잘한 점, 보완할 점, STAR 기법 활용 여부를 짧게 언급
- 질문은 한 번에 하나만
- 마지막 평가 시: 전체 면접에 대한 총평, 강점, 개선 필요 영역을 정리
- 모든 응답은 한국어로, 자연스러운 면접관 말투로`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 2048,
          thinking: { type: "adaptive" },
          system: systemPrompt,
          messages,
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
        const msg =
          err instanceof Anthropic.AuthenticationError
            ? "API 키가 유효하지 않습니다."
            : err instanceof Anthropic.RateLimitError
              ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
              : "AI 요청 중 오류가 발생했습니다.";
        controller.enqueue(encoder.encode(`[오류] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
