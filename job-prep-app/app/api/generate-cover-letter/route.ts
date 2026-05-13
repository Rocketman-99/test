import { getClient, buildProfileContext } from "@/lib/claude";
import type { UserProfile } from "@/types/user";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const body = await request.json();
  const { profile, apiKey, coverLetterPrompts } = body as {
    profile: UserProfile;
    apiKey?: string;
    coverLetterPrompts?: string;
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
            "당신은 한국 취업 시장 전문 자기소개서 작성 컨설턴트입니다. 진정성 있고 설득력 있는 자기소개서를 작성해주세요. 한국어로 작성하세요.",
          messages: [
            {
              role: "user",
              content: coverLetterPrompts?.trim()
                ? `다음 지원자의 정보를 바탕으로 자기소개서를 작성해주세요.\n채용 공고가 있다면 공고에 맞게 내용을 최적화하고, 아래 자소서 문항에 맞춰 각 항목별로 작성해주세요.\n마크다운 형식으로 작성하되, 각 문항을 제목(##)으로 구분해주세요.\n\n[지원자 정보]\n${profileContext}\n\n[자소서 문항]\n${coverLetterPrompts}`
                : `다음 지원자의 정보를 바탕으로 자기소개서를 작성해주세요.\n일반적인 자소서 항목(성장과정·성격의 장단점·지원동기·입사 후 포부)을 포함하고, 채용 공고가 있다면 공고에 맞게 내용을 최적화해주세요.\n마크다운 형식으로 작성해주세요.\n\n${profileContext}`,
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
