import { getClient } from "@/lib/claude";
import type { JobPosting } from "@/types/user";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const body = await request.json();
  const { label, jobPosting, apiKey } = body as {
    label: string;
    jobPosting: JobPosting;
    apiKey?: string;
  };

  let client: Anthropic;
  try {
    client = getClient(apiKey);
  } catch {
    return Response.json({ error: "API 키가 없습니다." }, { status: 400 });
  }

  const postingContent = jobPosting.text || (jobPosting.url ? `채용공고 URL: ${jobPosting.url}` : "");
  if (!postingContent && !label) {
    return Response.json({ error: "공고 정보가 없습니다." }, { status: 400 });
  }

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      messages: [
        {
          role: "user",
          content: `다음 채용공고를 분석해서 기업정보를 작성해주세요.

[기업명 / 지원직무]
${label}

[채용공고]
${postingContent || "공고 내용 없음"}

아래 항목을 마크다운 형식으로 작성해주세요. 공고에 명시되지 않은 항목은 기업명 기반으로 합리적으로 추론하되, 추론임을 표시하세요.

## 기업 개요
사업 분야, 주요 제품/서비스, 기업 규모 및 특징

## 핵심 가치 및 인재상
기업이 중시하는 가치관, 원하는 인재 유형

## 직무 요구 역량
이 직무에서 요구하는 핵심 역량과 기술 스택

## 면접 포인트
이 기업/직무 지원 시 강조해야 할 포인트와 예상 키워드`,
        },
      ],
    });

    const companyInfo = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    return Response.json({ companyInfo });
  } catch (err) {
    const msg =
      err instanceof Anthropic.AuthenticationError
        ? "API 키가 유효하지 않습니다."
        : err instanceof Anthropic.RateLimitError
          ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
          : err instanceof Error
            ? err.message
            : "기업정보 생성 중 오류가 발생했습니다.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
