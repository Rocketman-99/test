import { getClient, buildProfileContext } from "@/lib/claude";
import type { UserProfile } from "@/types/user";
import type { InterviewSettings } from "@/app/api/interview-session/route";
import Anthropic from "@anthropic-ai/sdk";

interface Message {
  role: "ai" | "user";
  content: string;
  elapsed?: number;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { profile, messages, settings, apiKey } = body as {
    profile: UserProfile;
    messages: Message[];
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
  const roundLabel = settings.interviewType === "job_round" ? "1차 직무면접" : "2차 임원면접";
  const difficultyLabel = settings.difficulty === "normal" ? "일반" : "압박";

  const conversationText = messages
    .map((m) => {
      const roleLabel = m.role === "ai" ? "면접관" : "지원자";
      return `[${roleLabel}]: ${m.content}`;
    })
    .join("\n\n");

  const voiceSection =
    settings.mode === "voice"
      ? `\n## 발화 방식 평가\n지원자 메시지 중 【발화 분석】 항목을 종합하여 말하는 속도, 자신감, 명확성, 전달력에 대한 종합 평가를 해주세요.\n`
      : "";

  const systemPrompt = `당신은 전문 면접 코치입니다. 아래 ${roundLabel} 면접 대화를 분석하여 지원자에게 종합적인 피드백을 제공해주세요.

[지원자 프로필]
${profileContext}

[면접 설정]
- 면접 유형: ${roundLabel}
- 난이도: ${difficultyLabel}
- 총 질문 수: ${settings.totalQuestions}개

[피드백 구조 — 반드시 아래 형식을 따르세요]

## 종합 평가
전반적인 면접 수행도에 대한 총평 (3~5문장)

## 강점
잘 수행한 부분들을 구체적으로 나열

## 개선 필요 영역
보완이 필요한 부분들과 개선 방법 제시

## 질문별 수행도
각 면접관 질문에 대한 지원자의 답변을 간략히 평가${voiceSection}

모든 피드백은 한국어로, 건설적이고 구체적으로 작성해주세요.`;

  const userPrompt = `[면접 대화 전문]\n\n${conversationText}`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 4096,
          thinking: { type: "adaptive" },
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
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
              : "피드백 생성 중 오류가 발생했습니다.";
        controller.enqueue(encoder.encode(`[오류] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
