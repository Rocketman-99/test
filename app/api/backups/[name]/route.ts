import { readBackup } from "@/lib/backup-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  let contents: string;
  try {
    // safeBackupPath 가 파일명 형태와 해석된 경로를 모두 검사한다.
    // 여기서 걸리면 경로 조작 시도이므로 400 으로 끊는다.
    contents = await readBackup(name);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("허용되지 않는")) {
      return Response.json({ error: msg }, { status: 400 });
    }
    return Response.json({ error: "백업 파일을 찾을 수 없습니다." }, { status: 404 });
  }

  return new Response(contents, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
