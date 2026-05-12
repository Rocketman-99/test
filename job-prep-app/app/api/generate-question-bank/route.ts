import { getClient, buildProfileContext } from "@/lib/claude";
import type { UserProfile } from "@/types/user";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const body = await request.json();
  const { profile, interviewType, difficulty, totalQuestions, apiKey } = body as {
    profile: UserProfile;
    interviewType: "personal" | "job" | "mixed";
    difficulty: "normal" | "pressure";
    totalQuestions: number;
    apiKey?: string;
  };

  let client: Anthropic;
  try {
    client = getClient(apiKey);
  } catch {
    return Response.json({ error: "API 키가 없습니다." }, { status: 400 });
  }

  const profileContext = buildProfileContext(profile);

  // 면접 유형별 질문 분배 비율
  const distribution: Record<string, string> = {
    personal: `인성 40% / 자기소개서 기반 40% / 기업·산업 기반 20%`,
    job: `직무 기술 50% / 자기소개서 기반 30% / 기업·산업 기반 20%`,
    mixed: `자기소개서 기반 30% / 직무 기술 30% / 기업·산업 기반 20% / 인성 20%`,
  };

  const pressureNote =
    difficulty === "pressure"
      ? "\n- 각 질문마다 압박용 꼬리 질문(반론·재확인)을 1개씩 추가로 준비할 것"
      : "";

  const systemPrompt = `당신은 대한민국 채용 전문 컨설턴트입니다. 지원자의 프로필과 채용 공고를 분석해 실전 면접 질문 뱅크를 작성해주세요.`;

  const userPrompt = `[지원자 프로필]
${profileContext}

---

위 정보를 바탕으로 실전 면접 질문 뱅크를 작성해주세요.

[작성 조건]
- 총 질문 수: ${totalQuestions}개 (+ 꼬리 질문 포함)
- 질문 유형 비율: ${distribution[interviewType]}
- 난이도: ${difficulty === "normal" ? "일반" : "압박"}${pressureNote}

[질문 유형 정의 — 반드시 표기할 것]
- (BEI) 행동사건면접: "~한 경험을 구체적으로 말씀해주세요" 형식. 과거 행동 기반
- (SI) 상황면접: "만약 ~라면 어떻게 하시겠습니까?" 형식. 가상 상황 판단
- (역량) 역량검증: 특정 핵심역량(소통·리더십·문제해결 등)을 직접 묻는 질문
- (기술) 직무기술: 직무 지식·전문성을 검증하는 기술적 질문
- (압박) 압박·재질문: 답변의 허점을 파고드는 반론·재확인 질문

[출력 형식 — 반드시 아래 구조 준수]

## 📋 공고 분석
채용 공고와 지원자 프로필을 분석한 핵심 포인트 (요구 역량, 인재상, 주목할 경험 등)

## 🙋 자기소개서 기반 질문
지원자의 실제 경험(경력·프로젝트·활동)을 직접 언급한 질문
각 질문마다:
- 질문: (유형) [질문 내용]
- 의도: [이 질문이 검증하려는 것]
- 꼬리: [예상 답변에 따른 후속 질문 1~2개]

## 💼 직무 기술 질문
희망 직무(${profile.goals.targetRole}) 특화 질문
(위와 동일한 형식)

## 🏢 기업·산업 기반 질문
채용 공고·업종 트렌드·인재상 기반 질문
(위와 동일한 형식)

## 🤝 인성 질문
가치관·협업·실패·성장 관련 질문
(위와 동일한 형식)

## ⚡ 압박 시나리오
면접 중 활용할 수 있는 압박 상황 예시 2~3개
(답변이 두루뭉술할 때 / 논리가 약할 때 / 자신감 테스트 등)`;

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
            : "질문 뱅크 생성 중 오류가 발생했습니다.";
        controller.enqueue(encoder.encode(`[오류] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
