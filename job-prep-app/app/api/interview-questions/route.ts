import { getClient, buildApplicationContext } from "@/lib/claude";
import type { Application } from "@/types/user";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const body = await request.json();
  const { application, coverLetter, questionCount, apiKey } = body as {
    application: Application;
    coverLetter?: string;
    questionCount?: number;
    apiKey?: string;
  };
  const count = Math.max(1, Math.min(50, questionCount ?? 15));

  let client: Anthropic;
  try {
    client = getClient(apiKey);
  } catch {
    return Response.json({ error: "API 키가 없습니다." }, { status: 400 });
  }

  const appContext = buildApplicationContext(application);
  const coverLetterSection = coverLetter?.trim()
    ? `\n[제출한 자소서]\n${coverLetter.trim()}`
    : "";

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system:
            "당신은 한국 취업 면접 전문 코치입니다. 채용공고, 기업정보, 자소서를 분석해 실전에 가장 가까운 면접 예상 질문과 답변 가이드를 제공해주세요. 한국어로 작성하세요.",
          messages: [
            {
              role: "user",
              content: `다음 정보를 바탕으로 면접 예상 질문 ${count}개와 각 질문에 대한 답변 가이드를 작성해주세요.
인성 질문, 직무 질문, 상황 질문을 골고루 포함하고, 자소서 내용을 기반으로 한 꼬리 질문도 추가해주세요.
마크다운 형식으로 작성해주세요.

${appContext}${coverLetterSection}`,
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
