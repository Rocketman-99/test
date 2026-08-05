/**
 * 서버 측 백업 파일 저장소. 앱이 사용자 PC에서 돌기 때문에 로컬 디스크에
 * 직접 백업을 쌓을 수 있다. 브라우저 권한 요청도 다운로드 창도 필요 없다.
 *
 * 서버 전용 모듈이다. 클라이언트에서 import 하지 말 것.
 */

import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const BACKUP_DIR_NAME = "backups";
export const DEFAULT_KEEP = 10;

/** 파일명으로 허용하는 형태. 이 밖의 문자는 전부 거부한다. */
const NAME_PATTERN = /^backup-[0-9A-Za-z_-]+\.json$/;

export function backupsDir(): string {
  return path.join(process.cwd(), BACKUP_DIR_NAME);
}

/**
 * 요청으로 들어온 파일명을 실제 경로로 바꾼다.
 *
 * 이름을 그대로 이어붙이면 `../../` 로 저장소 밖의 임의 파일을 읽히게 된다.
 * 패턴 검사와 "해석된 경로가 백업 폴더 안인가" 확인을 모두 통과해야 한다.
 * 어느 한쪽만으로는 부족하다 — 패턴은 인코딩 우회에, 경로 확인은 심볼릭
 * 링크가 아닌 평범한 상대경로에 각각 약하다.
 */
export function safeBackupPath(name: string): string {
  if (!NAME_PATTERN.test(name)) {
    throw new Error("허용되지 않는 파일명입니다.");
  }
  const dir = backupsDir();
  const resolved = path.resolve(dir, name);
  if (path.dirname(resolved) !== path.resolve(dir)) {
    throw new Error("허용되지 않는 경로입니다.");
  }
  return resolved;
}

export interface BackupEntry {
  name: string;
  size: number;
  createdAt: string;
}

export async function ensureDir(): Promise<void> {
  await mkdir(backupsDir(), { recursive: true });
}

/** 최신순 목록. 폴더가 없으면 빈 배열. */
export async function listBackups(): Promise<BackupEntry[]> {
  const dir = backupsDir();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }

  const entries: BackupEntry[] = [];
  for (const name of names) {
    if (!NAME_PATTERN.test(name)) continue;
    try {
      const s = await stat(path.join(dir, name));
      if (!s.isFile()) continue;
      entries.push({ name, size: s.size, createdAt: s.mtime.toISOString() });
    } catch {
      // 조회 중 사라진 파일은 건너뛴다
    }
  }
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries;
}

/** 파일명에 쓸 타임스탬프. backup-20260805-141230.json */
export function backupFileName(now: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `backup-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
    `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}.json`
  );
}

export async function writeBackup(contents: string, now = new Date()): Promise<string> {
  await ensureDir();
  let name = backupFileName(now);
  // 같은 초에 두 번 저장하면 이름이 겹친다. 덮어쓰지 않고 접미사를 붙인다.
  let suffix = 1;
  while (await exists(path.join(backupsDir(), name))) {
    name = backupFileName(now).replace(/\.json$/, `_${suffix}.json`);
    suffix++;
  }
  await writeFile(safeBackupPath(name), contents, "utf8");
  return name;
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** 최근 keep개만 남기고 오래된 것부터 지운다. 지운 개수를 반환. */
export async function pruneBackups(keep = DEFAULT_KEEP): Promise<number> {
  const entries = await listBackups();
  const stale = entries.slice(keep);
  let removed = 0;
  for (const entry of stale) {
    try {
      await unlink(safeBackupPath(entry.name));
      removed++;
    } catch {
      // 이미 지워졌으면 무시
    }
  }
  return removed;
}

export async function readBackup(name: string): Promise<string> {
  return readFile(safeBackupPath(name), "utf8");
}
