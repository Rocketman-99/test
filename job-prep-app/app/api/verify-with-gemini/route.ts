import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildProfileContext } from "@/lib/claude";
import { normalizeApiKey } from "@/lib/api-key";
import type { UserProfile } from "@/types/user";

const FEATURE_LABEL: Record<string, string> = {
  organize: "경험 정리",
  resume: "이력서",
  "cover-letter": "자기소개서",
  interview: "면접 질문",
};

export async function POST(request: Request) {
  const body = await request.json();
  const { profile, claudeOutput, feature, geminiApiKey } = body as {
    profile: UserProfile;
    claudeOutput: string;
    feature: string;
    geminiApiKey?: string;
  };

  const key = normalizeApiKey(geminiApiKey) ?? normalizeApiKey(process.env.GEMINI_API_KEY);
  if (!key) {
    return Response.json({ error: "Gemini API 키가 없습니다." }, { status: 400 });
  }

  const profileContext = buildProfileContext(profile);
  const label = FEATURE_LABEL[feature] ?? feature;

  const prompt = `당신은 한국 취업 전문가입니다. 아래 지원자 프로필과 Claude AI가 작성한 ${label}를 검토해주세요.

${profileContext}

---
[Claude가 작성한 ${label}]
${claudeOutput}
---

다음 항목을 기준으로 검토해주세요:
1. 지원자 프로필과의 일치성 (내용이 실제 정보와 맞는지)
2. 완성도와 설득력
3. 개선이 필요한 부분 (구체적으로)
4. 잘 된 부분

마크다운 형식으로 작성해주세요.`;

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const result = await model.generateContentStream(prompt);
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
            : raw.includes("PERMISSION_DENIED")
              ? "Gemini API 키 권한이 없습니다."
              : `Gemini 오류: ${raw}`;
        controller.enqueue(encoder.encode(`\n\n[오류] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
