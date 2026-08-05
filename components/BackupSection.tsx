"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildBackup, restoreBackup, estimateUsage, formatBytes } from "@/lib/backup";

type Message = { kind: "ok" | "warn" | "error"; text: string } | null;

const MESSAGE_STYLE: Record<"ok" | "warn" | "error", { color: string; icon: string }> = {
  ok: { color: "text-green-600", icon: "✓" },
  warn: { color: "text-amber-600", icon: "!" },
  error: { color: "text-red-500", icon: "✗" },
};

interface BackupEntry {
  name: string;
  size: number;
  createdAt: string;
}

/** 이 간격보다 오래됐으면 자동으로 한 부 저장한다. */
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

export default function BackupSection() {
  const [includeApiKeys, setIncludeApiKeys] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [backups, setBackups] = useState<BackupEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [showList, setShowList] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // React 개발 모드의 이중 마운트로 백업이 두 번 만들어지는 것을 막는다
  const autoRanRef = useRef(false);

  /** 서버 폴더에 한 부 저장. 자동 백업에는 API 키를 절대 넣지 않는다. */
  const saveToServer = useCallback(async (): Promise<BackupEntry[]> => {
    const backup = buildBackup(false);
    if (Object.keys(backup.data).length === 0) return [];
    const res = await fetch("/api/backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backup),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "저장에 실패했습니다.");
    return json.backups ?? [];
  }, []);

  useEffect(() => {
    setUsage(estimateUsage());

    if (autoRanRef.current) return;
    autoRanRef.current = true;

    // 서버가 없거나 실패해도 대시보드는 그대로 동작해야 한다.
    // 조용히 넘기지는 않고 경고로만 알린다.
    (async () => {
      try {
        const res = await fetch("/api/backups");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "목록을 읽지 못했습니다.");

        const list: BackupEntry[] = json.backups ?? [];
        const newest = list[0];
        const stale =
          !newest || Date.now() - new Date(newest.createdAt).getTime() > AUTO_BACKUP_INTERVAL_MS;

        if (!stale) {
          setBackups(list);
          return;
        }
        setBackups(await saveToServer());
      } catch (err) {
        setBackups([]);
        setMessage({
          kind: "warn",
          text: `자동 백업을 하지 못했습니다: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    })();
  }, [saveToServer]);

  async function handleBackupNow() {
    setBusy(true);
    setMessage(null);
    try {
      const list = await saveToServer();
      if (list.length === 0) {
        setMessage({ kind: "error", text: "백업할 데이터가 없습니다." });
        return;
      }
      setBackups(list);
      setMessage({ kind: "ok", text: `백업했습니다. (보관 중 ${list.length}개)` });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "백업에 실패했습니다." });
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreFrom(entry: BackupEntry) {
    if (!confirm(`${new Date(entry.createdAt).toLocaleString("ko-KR")} 백업으로 되돌립니다.\n현재 데이터는 대체됩니다. 계속할까요?`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/backups/${encodeURIComponent(entry.name)}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "백업을 읽지 못했습니다.");
      }
      const { restored } = restoreBackup(await res.text());
      setMessage({ kind: "ok", text: `${restored}개 항목을 복원했습니다. 새로고침합니다...` });
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "복원에 실패했습니다." });
    } finally {
      setBusy(false);
    }
  }

  function handleExport() {
    try {
      const backup = buildBackup(includeApiKeys);
      const count = Object.keys(backup.data).length;
      if (count === 0) {
        setMessage({ kind: "error", text: "내보낼 데이터가 없습니다." });
        return;
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `job-prep-backup-${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 체크박스를 켰는데 저장된 키가 없으면 조용히 넘어가지 않는다.
      // 아무 말이 없으면 키가 백업된 줄 알게 된다.
      if (includeApiKeys && !backup.includesApiKeys) {
        setMessage({
          kind: "warn",
          text: `${count}개 항목을 내보냈습니다. 저장된 API 키가 없어 키는 포함되지 않았습니다. (API 키 설정에서 저장 버튼을 눌렀는지 확인하세요)`,
        });
        return;
      }

      setMessage({
        kind: "ok",
        text: `${count}개 항목을 내보냈습니다.${backup.includesApiKeys ? " (API 키 포함)" : ""}`,
      });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "내보내기에 실패했습니다." });
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 같은 파일을 다시 골라도 change 가 발생하도록 값을 비운다
    e.target.value = "";
    if (!file) return;

    if (!confirm("현재 브라우저에 저장된 데이터가 백업 파일의 내용으로 대체됩니다.\n계속할까요?")) {
      return;
    }

    try {
      const raw = await file.text();
      const { restored, includedApiKeys } = restoreBackup(raw);
      setMessage({
        kind: "ok",
        text: `${restored}개 항목을 복원했습니다.${includedApiKeys ? " (API 키 포함)" : ""} 새로고침합니다...`,
      });
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "복원에 실패했습니다.",
      });
    }
  }

  const newest = backups?.[0];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">💾 데이터 백업</h2>
        {usage !== null && (
          <span className="text-xs text-gray-400">{formatBytes(usage)} / 약 5MB</span>
        )}
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        모든 데이터는 <strong className="text-gray-700">이 브라우저에만</strong>{" "}
        저장됩니다. 브라우저의 &ldquo;쿠키 및 기타 사이트 데이터 삭제&rdquo;를 실행하면 함께
        사라지니, 하루에 한 번 <code className="text-gray-600">backups</code> 폴더에 자동으로
        저장해 둡니다. (자동 백업에는 API 키가 포함되지 않습니다)
      </p>

      {/* 서버 폴더 백업 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleBackupNow}
          disabled={busy}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          지금 백업
        </button>
        {backups !== null && backups.length > 0 && (
          <button
            type="button"
            onClick={() => setShowList((v) => !v)}
            className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg transition-colors"
          >
            {showList ? "목록 닫기" : `백업 목록 (${backups.length})`}
          </button>
        )}
        {newest && (
          <span className="text-xs text-gray-400">마지막 백업 {relativeTime(newest.createdAt)}</span>
        )}
      </div>

      {showList && backups && (
        <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-56 overflow-y-auto">
          {backups.map((b) => (
            <div key={b.name} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-700 truncate">
                  {new Date(b.createdAt).toLocaleString("ko-KR")}
                </p>
                <p className="text-[11px] text-gray-400">{formatBytes(b.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRestoreFrom(b)}
                disabled={busy}
                className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-medium transition-colors shrink-0 disabled:opacity-50"
              >
                이 시점으로 복원
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-100 pt-3 space-y-2">
        <p className="text-xs text-gray-500">
          다른 PC나 브라우저로 옮기려면 파일로 주고받으세요.
        </p>

        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={includeApiKeys}
            onChange={(e) => setIncludeApiKeys(e.target.checked)}
            className="rounded border-gray-300"
          />
          API 키도 포함 (파일이 유출되면 키도 함께 노출됩니다)
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-lg transition-colors"
          >
            내보내기
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-lg transition-colors"
          >
            불러오기
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {message && (
        <p className={`text-xs ${MESSAGE_STYLE[message.kind].color}`}>
          {MESSAGE_STYLE[message.kind].icon} {message.text}
        </p>
      )}
    </div>
  );
}
