import { listBackups, pruneBackups, writeBackup, DEFAULT_KEEP } from "@/lib/backup-fs";

export const runtime = "nodejs";
// 목록이 캐시되면 방금 만든 백업이 안 보인다.
export const dynamic = "force-dynamic";

/** 본문 크기 상한. localStorage 한계가 약 5MB 이므로 넉넉하게 잡는다. */
const MAX_BYTES = 20 * 1024 * 1024;

export async function GET() {
  try {
    return Response.json({ backups: await listBackups() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `백업 목록을 읽지 못했습니다: ${msg}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const raw = await request.text();

  if (raw.length > MAX_BYTES) {
    return Response.json({ error: "백업 크기가 너무 큽니다." }, { status: 413 });
  }

  // 아무 JSON 이나 디스크에 쌓지 않는다. 백업 파일 형태인지 확인하고 받는다.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return Response.json({ error: "JSON 형식이 아닙니다." }, { status: 400 });
  }
  if (typeof parsed !== "object" || parsed === null) {
    return Response.json({ error: "백업 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const file = parsed as { version?: unknown; data?: unknown };
  if (typeof file.version !== "number") {
    return Response.json({ error: "백업 형식이 올바르지 않습니다. (버전 없음)" }, { status: 400 });
  }
  if (typeof file.data !== "object" || file.data === null || Array.isArray(file.data)) {
    return Response.json({ error: "백업에 데이터가 없습니다." }, { status: 400 });
  }

  try {
    const name = await writeBackup(raw);
    const removed = await pruneBackups(DEFAULT_KEEP);
    return Response.json({ name, removed, backups: await listBackups() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `백업을 저장하지 못했습니다: ${msg}` }, { status: 500 });
  }
}
