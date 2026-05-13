import { getClient, buildProfileContext } from "@/lib/claude";
import type { UserProfile } from "@/types/user";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const body = await request.json();
  const { profile, apiKey } = body as { profile: UserProfile; apiKey?: string };

  let client: Anthropic;
  try {
    client = getClient(apiKey);
  } catch {
    return Response.json({ error: "API 키가 없습니다." }, { status: 400 });
  }

  const profileContext = buildProfileContext(profile);

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          thinking: { type: "adaptive" },
          system:
            "당신은 한국 취업 시장 전문 이력서 작성 컨설턴트입니다. 지원자의 정보를 바탕으로 채용 공고에 최적화된 이력서를 작성해주세요. 한국어로 작성하세요.",
          messages: [
            {
              role: "user",
              content: `다음 지원자의 정보를 바탕으로 완성된 이력서를 작성해주세요.\n채용 공고가 있다면 공고의 요구사항에 맞게 강점을 부각시켜주세요.\n마크다운 형식으로 작성해주세요.\n\n${profileContext}`,
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
