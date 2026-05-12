"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  title: string;
  content: string;
  loading: boolean;
  onClose: () => void;
  onStop: () => void;
  onCopy: () => void;
  copied: boolean;
  onRegenerate: () => void;
  onRevise: (instruction: string) => void;
  revising: boolean;
  onVerify: () => void;
  verifying: boolean;
  verifyResult: string;
  canVerify: boolean;
}

function toFilename(title: string) {
  const base = title.replace(/\s*—.*$/, "").trim();
  const map: Record<string, string> = {
    "경험 자동 정리": "경험정리",
    "이력서": "이력서",
    "자소서": "자기소개서",
    "면접 질문": "면접질문",
  };
  const key = Object.keys(map).find((k) => base.includes(k)) ?? base;
  return `취준도우미_${map[key] ?? key}_${new Date().toISOString().slice(0, 10)}.md`;
}

export default function AiResultPanel({
  title, content, loading,
  onClose, onStop, onCopy, copied,
  onRegenerate, onRevise, revising,
  onVerify, verifying, verifyResult, canVerify,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [localContent, setLocalContent] = useState(content);
  const [revisionInput, setRevisionInput] = useState("");

  // 스트리밍 중에는 로컬 편집 내용을 최신 content로 동기화
  useEffect(() => {
    if (!editMode) setLocalContent(content);
  }, [content, editMode]);

  // 새 생성 시작 시 편집 모드 종료
  useEffect(() => {
    if (loading) { setEditMode(false); setRevisionInput(""); }
  }, [loading]);

  useEffect(() => {
    if (loading || revising) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [content, verifyResult, loading, revising]);

  function handleDownload() {
    const blob = new Blob([localContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = toFilename(title);
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleRevise() {
    if (!revisionInput.trim()) return;
    setEditMode(false);
    onRevise(revisionInput.trim());
    setRevisionInput("");
  }

  const busy = loading || revising || verifying;
  const done = !loading && !!content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 gap-2 flex-wrap">
          <h2 className="font-bold text-gray-800 text-base">{title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {done && (
              <>
                <button type="button" onClick={onRegenerate} disabled={busy}
                  className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-40">
                  🔄 재생성
                </button>
                <button type="button" onClick={() => setEditMode((v) => !v)} disabled={busy}
                  className={`text-sm px-3 py-1.5 border rounded-lg transition-colors disabled:opacity-40
                    ${editMode ? "border-blue-400 bg-blue-50 text-blue-600" : "border-gray-200 hover:bg-gray-50 text-gray-600"}`}>
                  ✏️ {editMode ? "미리보기" : "직접 편집"}
                </button>
                <button type="button" onClick={handleDownload}
                  className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                  ↓ 다운로드
                </button>
                <button type="button" onClick={() => navigator.clipboard.writeText(localContent).then(() => onCopy())}
                  className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors">
                  {copied ? "복사됨 ✓" : "복사"}
                </button>
              </>
            )}
            <button type="button" onClick={onClose} disabled={busy}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1 disabled:opacity-40">
              ✕
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* 생성 대기 */}
          {!content && loading && (
            <div className="flex items-center gap-3 text-gray-400 py-8 justify-center">
              <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              AI가 생성 중입니다…
            </div>
          )}

          {/* 편집 모드 */}
          {content && editMode && (
            <textarea
              value={localContent}
              onChange={(e) => setLocalContent(e.target.value)}
              className="w-full h-96 px-4 py-3 border border-blue-300 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y font-mono"
            />
          )}

          {/* 미리보기 모드 */}
          {content && !editMode && (
            <div className="prose prose-sm prose-gray max-w-none text-gray-700">
              <ReactMarkdown>{localContent}</ReactMarkdown>
            </div>
          )}

          {/* 수정 요청 */}
          {done && (
            <div className="border-t border-gray-100 pt-4 space-y-2">
              <p className="text-xs font-semibold text-gray-600">✍️ 수정 요청</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={revisionInput}
                  onChange={(e) => setRevisionInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleRevise()}
                  placeholder="예: 더 간결하게, 공격적인 어조로, 직무 역량 부각"
                  disabled={busy}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleRevise}
                  disabled={busy || !revisionInput.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {revising ? "수정 중…" : "수정"}
                </button>
              </div>
              <p className="text-xs text-gray-400">Enter로 바로 요청할 수 있어요.</p>
            </div>
          )}

          {/* Gemini 교차검증 */}
          {done && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>🔍</span>
                  <span className="text-sm font-semibold text-gray-700">Gemini 교차검증</span>
                </div>
                {!verifyResult && !verifying && (
                  <button type="button" onClick={onVerify} disabled={!canVerify || busy}
                    className="text-sm px-4 py-1.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    Gemini로 검증하기
                  </button>
                )}
                {!canVerify && !verifyResult && !verifying && (
                  <span className="text-xs text-amber-500">Gemini API 키 필요</span>
                )}
              </div>
              {verifying && !verifyResult && (
                <div className="flex items-center gap-3 text-gray-400 py-4 justify-center">
                  <span className="inline-block w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                  Gemini가 검토 중입니다…
                </div>
              )}
              {verifyResult && (
                <div className={`border rounded-xl p-4 prose prose-sm prose-gray max-w-none ${verifyResult.includes("[오류]") ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"}`}>
                  <ReactMarkdown>{verifyResult}</ReactMarkdown>
                  {verifyResult.includes("[오류]") && (
                    <button type="button" onClick={onVerify} disabled={!canVerify || busy}
                      className="mt-2 text-sm px-3 py-1 bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40">
                      재시도
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* 하단 상태 바 */}
        {busy && (content || verifyResult) && (
          <div className="px-6 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
              {revising ? "수정 중…" : verifying ? "Gemini 검토 중…" : "생성 중…"}
            </div>
            {loading && (
              <button type="button" onClick={onStop}
                className="px-2 py-1 text-xs text-red-500 border border-red-200 rounded hover:bg-red-50 transition-colors">
                ■ 정지
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
