import { getClient } from "@/lib/claude";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const body = await request.json();
  const { questionText, imageBase64, imageMimeType, apiKey } = body as {
    questionText?: string;
    imageBase64?: string;
    imageMimeType?: string;
    apiKey?: string;
  };

  let client: Anthropic;
  try {
    client = getClient(apiKey);
  } catch {
    return Response.json({ error: "API 키가 없습니다." }, { status: 400 });
  }

  const content: Anthropic.MessageParam["content"] = [];

  if (imageBase64 && imageMimeType) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imageMimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        data: imageBase64,
      },
    });
  }

  const textPart = questionText?.trim()
    ? `다음 인적성 문제를 풀어주세요:\n\n${questionText.trim()}`
    : "이미지에 있는 인적성 문제를 풀어주세요.";

  content.push({ type: "text", text: textPart });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: `당신은 인적성 검사 전문가입니다. 문제를 단계별로 정확하게 풀어주세요.
풀이는 다음 형식으로 작성하세요:
1. **문제 유형** 파악
2. **풀이 과정** (단계별)
3. **정답** 명시
4. **핵심 포인트** (비슷한 유형 대비용)`,
          messages: [{ role: "user", content }],
        });

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const msg =
          err instanceof Anthropic.AuthenticationError
            ? "API 키가 유효하지 않습니다."
            : "풀이 생성 중 오류가 발생했습니다.";
        controller.enqueue(encoder.encode(`[오류] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
