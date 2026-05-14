import { getClient, buildCoverLetterContext, buildApplicationContext } from "@/lib/claude";
import type { UserSpec, Application } from "@/types/user";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const body = await request.json();
  const { spec, application, apiKey } = body as {
    spec: UserSpec;
    application: Application;
    apiKey?: string;
  };

  let client: Anthropic;
  try {
    client = getClient(apiKey);
  } catch {
    return Response.json({ error: "API 키가 없습니다." }, { status: 400 });
  }

  const specContext = buildCoverLetterContext(spec);
  const appContext = buildApplicationContext(application);
  const coverLetterPrompts = application.coverLetterPrompts?.trim();

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const userContent = coverLetterPrompts
          ? `다음 정보를 바탕으로 자기소개서를 작성해주세요.
채용공고와 기업정보를 반영하고, 아래 자소서 문항에 맞춰 각 항목별로 작성해주세요.
기업이 원하는 인재상과 직무 요구역량에 맞게 지원자의 경험을 녹여 작성하세요.
마크다운 형식으로 작성하되, 각 문항을 제목(##)으로 구분해주세요.

${appContext}

${specContext}

[자소서 문항]
${coverLetterPrompts}`
          : `다음 정보를 바탕으로 자기소개서를 작성해주세요.
채용공고와 기업정보를 반영하고, 기업이 원하는 인재상과 직무 요구역량에 맞게 지원자의 경험을 녹여 작성하세요.
일반적인 자소서 항목(성장과정·성격의 장단점·지원동기·입사 후 포부)을 포함해주세요.
마크다운 형식으로 작성해주세요.

${appContext}

${specContext}`;

        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system:
            "당신은 한국 취업 시장 전문 자기소개서 작성 컨설턴트입니다. 기업의 인재상과 직무 요구역량에 맞게 지원자의 경험을 진정성 있고 설득력 있게 녹여내는 자소서를 작성해주세요. 한국어로 작성하세요.",
          messages: [{ role: "user", content: userContent }],
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
        controller.enqueue(encoder.encode(`\n\n[오류] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
