import { getClient, buildProfileContext } from "@/lib/claude";
import type { UserProfile } from "@/types/user";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const body = await request.json();
  const { profile, interviewType, difficulty, totalQuestions, apiKey } = body as {
    profile: UserProfile;
    interviewType: "job_round" | "executive_round";
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

  const isJobRound = interviewType === "job_round";
  const roundLabel = isJobRound ? "1차 직무면접" : "2차 임원면접";

  const distribution = isJobRound
    ? `직무 기술 50% / 자기소개서 기반(직무 관련 경험) 35% / 기업·산업 기반 15%`
    : `인성·가치관 45% / 자기소개서 기반(성장·동기·가치관) 35% / 기업·산업 기반(입사 의지·비전) 20%`;

  const pressureNote =
    difficulty === "pressure"
      ? "\n- 각 질문마다 압박용 꼬리 질문(반론·재확인)을 1개씩 추가로 준비할 것"
      : "";

  const roundFocus = isJobRound
    ? `이 면접은 직무 적합성과 실무 역량을 검증하는 1차 직무면접입니다.
BEI(행동사건면접)와 SI(상황면접) 중심으로, 지원자가 직무 현장에서 어떻게 판단하고 행동하는지 파악하는 질문을 만드세요.
기술적 이해도, 업무 우선순위 판단, 문제해결 방식에 집중하세요.`
    : `이 면접은 가치관·인성·조직 적합성을 검증하는 2차 임원면접입니다.
지원자의 핵심 가치관, 협업 방식, 리더십 경험, 성장 동기, 회사에 대한 이해와 입사 의지를 깊이 탐색하는 질문을 만드세요.
직무 기술보다 '이 사람이 우리 조직에 맞는가'를 판단하는 데 집중하세요.`;

  const systemPrompt = `당신은 대한민국 채용 전문 컨설턴트입니다. 지원자의 프로필과 채용 공고를 분석해 실전 면접 질문 뱅크를 작성해주세요.`;

  const sections = isJobRound
    ? `## 🙋 자기소개서 기반 질문 (직무 관련 경험 중심)
지원자의 실제 직무·프로젝트·활동 경험을 직접 언급한 질문
각 질문마다:
- 질문: (유형) [질문 내용]
- 의도: [이 질문이 검증하려는 것]
- 꼬리: [예상 답변에 따른 후속 질문 1~2개]

## 💼 직무 기술 질문
희망 직무(${profile.goals.targetRole}) 특화 역량·기술 검증 질문
(위와 동일한 형식)

## 🏢 기업·산업 기반 질문
채용 공고 요구사항·업종 트렌드·직무 관련 기업 이해도 질문
(위와 동일한 형식)

## ⚡ 압박 시나리오
직무 관련 답변이 불완전할 때 활용할 압박 상황 예시 2~3개`
    : `## 🙋 자기소개서 기반 질문 (성장·동기·가치관 중심)
지원자의 경험에서 가치관·태도·성장을 드러내는 질문
각 질문마다:
- 질문: (유형) [질문 내용]
- 의도: [이 질문이 검증하려는 것]
- 꼬리: [예상 답변에 따른 후속 질문 1~2개]

## 🤝 인성·가치관 질문
협업·리더십·실패 극복·성장 관련 깊이 있는 질문
(위와 동일한 형식)

## 🏢 기업·비전 기반 질문
입사 동기, 회사 이해, 장기 비전, 조직 적합성 관련 질문
(위와 동일한 형식)

## ⚡ 압박 시나리오
가치관·태도 답변이 두루뭉술할 때 활용할 압박 상황 예시 2~3개`;

  const userPrompt = `[지원자 프로필]
${profileContext}

---

위 정보를 바탕으로 **${roundLabel}** 질문 뱅크를 작성해주세요.

[작성 조건]
- 총 질문 수: ${totalQuestions}개 (+ 꼬리 질문 포함)
- 질문 유형 비율: ${distribution}
- 난이도: ${difficulty === "normal" ? "일반" : "압박"}${pressureNote}

[면접 특성]
${roundFocus}

[질문 유형 정의 — 반드시 표기할 것]
- (BEI) 행동사건면접: "~한 경험을 구체적으로 말씀해주세요" 형식. 과거 행동 기반
- (SI) 상황면접: "만약 ~라면 어떻게 하시겠습니까?" 형식. 가상 상황 판단
- (역량) 역량검증: 특정 핵심역량(소통·리더십·문제해결 등)을 직접 묻는 질문
- (기술) 직무기술: 직무 지식·전문성을 검증하는 기술적 질문
- (가치관) 인성·가치관: 삶의 태도, 협업 방식, 성장 동기를 탐색하는 질문
- (압박) 압박·재질문: 답변의 허점을 파고드는 반론·재확인 질문

[출력 형식 — 반드시 아래 구조 준수]

## 📋 공고 분석
채용 공고와 지원자 프로필을 분석한 핵심 포인트 (${isJobRound ? "요구 역량, 기술 스택, 주목할 직무 경험" : "인재상, 조직문화, 주목할 가치관·성장 스토리"})

${sections}`;

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
