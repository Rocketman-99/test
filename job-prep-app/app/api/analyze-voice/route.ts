import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  const body = await request.json();
  const { audioBase64, audioMimeType, geminiApiKey } = body as {
    audioBase64: string;
    audioMimeType: string;
    geminiApiKey?: string;
  };

  const key = geminiApiKey ?? process.env.GEMINI_API_KEY;
  if (!key) {
    return Response.json({ error: "Gemini API 키가 없습니다." }, { status: 400 });
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `이 오디오는 취업 면접 지원자의 답변입니다. 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "transcript": "말한 내용 전체를 정확하게 텍스트로",
  "pace": "빠름|적당|느림",
  "confidence": "높음|보통|낮음",
  "clarity": "또렷함|보통|불명확",
  "notes": "특이사항 (말더듬, 추임새 과다, 목소리 떨림 등. 없으면 '없음')"
}`;

  try {
    const result = await model.generateContent([
      { inlineData: { mimeType: audioMimeType, data: audioBase64 } },
      { text: prompt },
    ]);

    const raw = result.response.text().trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "분석 결과를 파싱할 수 없습니다." }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const deliveryNotes = `속도: ${parsed.pace} | 자신감: ${parsed.confidence} | 명확성: ${parsed.clarity}${parsed.notes !== "없음" ? ` | ${parsed.notes}` : ""}`;

    return Response.json({ transcript: parsed.transcript ?? "", deliveryNotes });
  } catch (err) {
    const msg =
      err instanceof Error && err.message.includes("API_KEY")
        ? "Gemini API 키가 유효하지 않습니다."
        : err instanceof Error && err.message.includes("quota")
          ? "Gemini 요청 한도를 초과했습니다."
          : "음성 분석 중 오류가 발생했습니다.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
