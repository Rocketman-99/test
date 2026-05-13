import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  const body = await request.json();
  const { geminiApiKey } = body as { geminiApiKey?: string };

  const key = geminiApiKey ?? process.env.GEMINI_API_KEY;
  if (!key) {
    return Response.json({ ok: false, error: "Gemini API 키가 없습니다." });
  }

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("안녕하세요. 한 문장으로 답해주세요.");
    const text = result.response.text();
    return Response.json({ ok: true, response: text });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: raw });
  }
}
