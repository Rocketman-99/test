import Anthropic from "@anthropic-ai/sdk";
import { normalizeApiKey } from "@/lib/api-key";

export async function POST(request: Request) {
  const body = await request.json();
  const { claudeApiKey } = body as { claudeApiKey?: string };

  const key = normalizeApiKey(claudeApiKey) ?? normalizeApiKey(process.env.ANTHROPIC_API_KEY);
  if (!key) {
    return Response.json({ ok: false, error: "Claude API 키가 없습니다." });
  }

  try {
    const client = new Anthropic({ apiKey: key });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 64,
      messages: [{ role: "user", content: "안녕하세요. 한 문장으로 답해주세요." }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return Response.json({ ok: true, response: text });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: raw });
  }
}
