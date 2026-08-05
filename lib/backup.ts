/**
 * 전체 데이터 백업 / 복원.
 *
 * 이 앱의 데이터는 전부 localStorage 에만 있다. 브라우저의 "쿠키 및 기타 사이트
 * 데이터 삭제" 는 localStorage 도 함께 지우므로, 파일로 빼둘 수단이 없으면
 * 그 순간 전부 사라진다. 실제로 그렇게 소실된 적이 있어 추가된 모듈이다.
 */

export const BACKUP_VERSION = 1;

/** 값이 통째로 하나의 키에 들어가는 항목들 */
const FIXED_KEYS = [
  "job-prep-spec",
  "job-prep-applications",
  "job-prep-profile",
  "aptitude-folders",
  "aptitude-notes",
] as const;

/**
 * 공고/기능별로 키가 동적으로 생성되는 항목들.
 * 예) job-prep-history:cover-letter:<appId>, interview-history-<appId>
 * 고정 목록으로는 잡히지 않으므로 localStorage 전체를 순회해야 한다.
 */
const KEY_PREFIXES = ["job-prep-history:", "interview-history-"] as const;

/** 기본적으로 백업에서 제외되는 비밀 값 */
export const SECRET_KEYS = ["anthropic-api-key", "gemini-api-key"] as const;

export interface BackupFile {
  version: number;
  exportedAt: string;
  includesApiKeys: boolean;
  data: Record<string, string>;
}

export interface RestoreResult {
  restored: number;
  includedApiKeys: boolean;
}

function isAppKey(key: string): boolean {
  if ((FIXED_KEYS as readonly string[]).includes(key)) return true;
  return KEY_PREFIXES.some((p) => key.startsWith(p));
}

/** 백업 대상 키 목록. 앱이 소유하지 않은 키는 절대 포함하지 않는다. */
export function collectAppKeys(includeApiKeys: boolean): string[] {
  if (typeof window === "undefined") return [];
  const keys = Object.keys(localStorage).filter(isAppKey);
  if (includeApiKeys) {
    for (const k of SECRET_KEYS) {
      if (localStorage.getItem(k) !== null) keys.push(k);
    }
  }
  return keys;
}

export function buildBackup(includeApiKeys: boolean): BackupFile {
  const data: Record<string, string> = {};
  for (const key of collectAppKeys(includeApiKeys)) {
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    // 요청 여부가 아니라 실제로 담겼는지를 기록한다. 저장된 키가 없는데
    // true 로 적으면 파일을 열어본 사람이 키가 들어있다고 오해한다.
    includesApiKeys: SECRET_KEYS.some((k) => k in data),
    data,
  };
}

/**
 * 백업 파일을 되돌린다.
 *
 * 검증에 실패하면 localStorage 를 건드리기 전에 throw 한다. 잘못된 파일 하나로
 * 남아 있는 데이터까지 날아가면 백업 기능이 오히려 위험해지기 때문이다.
 */
export function restoreBackup(raw: string): RestoreResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("JSON 형식이 아닙니다. 백업 파일이 맞는지 확인해주세요.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("백업 파일 형식이 올바르지 않습니다.");
  }
  const file = parsed as Partial<BackupFile>;

  if (typeof file.version !== "number") {
    throw new Error("이 앱의 백업 파일이 아닙니다. (버전 정보 없음)");
  }
  if (file.version > BACKUP_VERSION) {
    throw new Error(`더 새로운 버전의 백업 파일입니다. (v${file.version}) 앱을 업데이트해주세요.`);
  }
  if (typeof file.data !== "object" || file.data === null || Array.isArray(file.data)) {
    throw new Error("백업 파일에 데이터가 없습니다.");
  }

  const entries = Object.entries(file.data as Record<string, unknown>);
  if (entries.some(([, v]) => typeof v !== "string")) {
    throw new Error("백업 데이터가 손상되었습니다.");
  }

  // 여기까지 왔으면 안전하다고 보고 기록을 시작한다.
  // 백업에 없는 옛 항목이 섞이지 않도록 앱 소유 키를 먼저 비운다.
  const includedApiKeys = entries.some(([k]) => (SECRET_KEYS as readonly string[]).includes(k));
  for (const key of collectAppKeys(true)) {
    localStorage.removeItem(key);
  }

  let restored = 0;
  for (const [key, value] of entries) {
    if (!isAppKey(key) && !(SECRET_KEYS as readonly string[]).includes(key)) continue;
    localStorage.setItem(key, value as string);
    restored++;
  }

  return { restored, includedApiKeys };
}

/** 앱이 쓰고 있는 대략적인 용량(byte). localStorage 한계(약 5MB) 대비 표시용. */
export function estimateUsage(): number {
  if (typeof window === "undefined") return 0;
  let total = 0;
  for (const key of collectAppKeys(true)) {
    const value = localStorage.getItem(key);
    if (value !== null) total += key.length + value.length;
  }
  // UTF-16 저장이므로 문자 수의 2배가 실제 사용량에 가깝다
  return total * 2;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
