import { getClient, buildProfileContext } from "@/lib/claude";
import type { UserProfile } from "@/types/user";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const body = await request.json();
  const { profile, originalContent, instruction, featureLabel, apiKey } = body as {
    profile: UserProfile;
    originalContent: string;
    instruction: string;
    featureLabel: string;
    apiKey?: string;
  };

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
            "당신은 한국 취업 전문 컨설턴트입니다. 기존 문서를 사용자의 요청에 맞게 수정해주세요. 한국어로 작성하세요.",
          messages: [
            {
              role: "user",
              content: `다음은 취업 지원자를 위해 작성된 ${featureLabel}입니다.\n\n[지원자 프로필]\n${profileContext}\n\n[기존 내용]\n${originalContent}\n\n[수정 요청]\n${instruction}\n\n위 요청에 맞게 수정해주세요. 마크다운 형식으로 작성해주세요.`,
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
