import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  const body = await request.json();
  const { questionText, imageBase64, imageMimeType, geminiApiKey } = body as {
    questionText?: string;
    imageBase64?: string;
    imageMimeType?: string;
    geminiApiKey?: string;
  };

  const key = geminiApiKey ?? process.env.GEMINI_API_KEY;
  if (!key) {
    return Response.json({ error: "Gemini API 키가 없습니다." }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const parts: Parameters<typeof model.generateContentStream>[0] extends { contents: infer C } ? never : unknown[] = [];
  const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (imageBase64 && imageMimeType) {
    contentParts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
  }

  const textPart = questionText?.trim()
    ? `다음 인적성 문제를 풀어주세요:\n\n${questionText.trim()}`
    : "이미지에 있는 인적성 문제를 풀어주세요.";

  contentParts.push({ text: `당신은 인적성 검사 전문가입니다. 문제를 단계별로 정확하게 풀어주세요.
풀이는 다음 형식으로 작성하세요:
1. **문제 유형** 파악
2. **풀이 과정** (단계별)
3. **정답** 명시
4. **핵심 포인트** (비슷한 유형 대비용)

${textPart}` });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const result = await model.generateContentStream(contentParts as Parameters<typeof model.generateContentStream>[0]);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const msg = raw.includes("API_KEY") || raw.includes("API key")
          ? "Gemini API 키가 유효하지 않습니다."
          : raw.includes("quota") || raw.includes("RESOURCE_EXHAUSTED")
            ? "Gemini 요청 한도를 초과했습니다."
            : `Gemini 오류: ${raw}`;
        controller.enqueue(encoder.encode(`[오류] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
