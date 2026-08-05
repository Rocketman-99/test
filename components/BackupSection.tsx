"use client";

import { useEffect, useRef, useState } from "react";
import { buildBackup, restoreBackup, estimateUsage, formatBytes } from "@/lib/backup";

type Message = { kind: "ok" | "warn" | "error"; text: string } | null;

const MESSAGE_STYLE: Record<"ok" | "warn" | "error", { color: string; icon: string }> = {
  ok: { color: "text-green-600", icon: "✓" },
  warn: { color: "text-amber-600", icon: "!" },
  error: { color: "text-red-500", icon: "✗" },
};

export default function BackupSection() {
  const [includeApiKeys, setIncludeApiKeys] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // localStorage 는 서버 렌더 시점에 없으므로 마운트 후에 읽는다
  useEffect(() => {
    setUsage(estimateUsage());
  }, []);

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
        사라지니, 주기적으로 파일로 내보내 두세요.
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
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
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

      {message && (
        <p className={`text-xs ${MESSAGE_STYLE[message.kind].color}`}>
          {MESSAGE_STYLE[message.kind].icon} {message.text}
        </p>
      )}
    </div>
  );
}
