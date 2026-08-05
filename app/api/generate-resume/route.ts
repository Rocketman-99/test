import { getClient, buildResumeContext, buildApplicationContext } from "@/lib/claude";
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

  const specContext = buildResumeContext(spec);
  const appContext = buildApplicationContext(application);

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system:
            "당신은 한국 취업 시장 전문 이력서 작성 컨설턴트입니다. 채용공고와 기업정보를 최우선으로 반영하고, 지원자의 기본정보와 경험을 직무에 맞게 부각하는 이력서를 작성해주세요. 한국어로 작성하세요.",
          messages: [
            {
              role: "user",
              content: `다음 정보를 바탕으로 완성된 이력서를 작성해주세요.
채용공고의 요구사항과 기업정보를 최우선으로 반영하고, 지원자의 경험과 역량을 직무에 맞게 강조해주세요.
마크다운 형식으로 작성해주세요.

${appContext}

${specContext}`,
            },
          ],
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
