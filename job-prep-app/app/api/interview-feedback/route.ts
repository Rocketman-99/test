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

  const systemPrompt = `당신은 10년 경력의 대기업 HR 출신 전문 면접 코치입니다. 아래 ${roundLabel} 면접 대화를 심층 분석하여 지원자에게 실질적으로 도움이 되는 상세 피드백을 제공해주세요.

[지원자 프로필]
${profileContext}

[면접 설정]
- 면접 유형: ${roundLabel}
- 난이도: ${difficultyLabel}
- 총 질문 수: ${settings.totalQuestions}개

[피드백 작성 원칙]
- 막연한 칭찬/지적 금지. 반드시 면접 대화의 구체적인 내용을 인용해서 근거를 제시할 것
- 개선점마다 "이렇게 바꿔보세요" 형태의 실행 가능한 조언 포함
- STAR(상황-과제-행동-결과) 구조 활용 여부를 평가하고 미흡한 답변은 개선 예시 제시
- 면접 코치 관점이 아닌 실제 면접관 관점으로 작성 (이 답변이 합격/불합격에 미치는 영향)

[피드백 구조 — 반드시 아래 형식을 정확히 따르세요]

## 📊 종합 평가
전반적인 수행도 총평 (5~7문장). 이 지원자가 실제 면접에서 합격 가능성이 어느 정도인지, 어떤 인상을 남겼는지 솔직하게 평가하세요.

**종합 점수: X / 10** (각 항목 평균)

| 평가 항목 | 점수 | 한 줄 평 |
|---|---|---|
| 답변 구조 (STAR) | X/10 | |
| 직무 적합성 | X/10 | |
| 논리적 일관성 | X/10 | |
| 구체성·근거 | X/10 | |
| 자신감·태도 | X/10 | |

## ✅ 강점 (잘한 점)
각 강점마다:
- **[강점 제목]**: 구체적 근거 (면접 대화 내용 인용) + 왜 이것이 면접관에게 긍정적으로 보이는지

## ⚠️ 개선 필요 영역
각 개선점마다:
- **[개선 항목]**: 현재 문제점 (면접 대화 인용) → 개선 방향 → 개선된 답변 예시 (1~2문장)

## 📋 질문별 상세 분석
면접관의 각 질문에 대해:

**Q1. [질문 요약]**
- 답변 수준: ⭐⭐⭐⭐⭐ (5점 만점)
- 잘한 점:
- 아쉬운 점:
- STAR 구조: 완성/부분/미흡
- 개선 포인트:${voiceSection}
## 🎯 앞으로의 준비 방향
이 지원자가 실제 면접 전에 반드시 준비해야 할 3가지를 우선순위 순으로 제시하세요.

모든 피드백은 한국어로, 지원자가 바로 실행에 옮길 수 있는 수준으로 구체적으로 작성해주세요.`;

  const userPrompt = `[면접 대화 전문]\n\n${conversationText}`;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 8192,
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
