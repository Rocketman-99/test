"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  title: string;
  content: string;
  loading: boolean;
  onClose: () => void;
  onCopy: () => void;
  copied: boolean;
  onVerify: () => void;
  verifying: boolean;
  verifyResult: string;
  canVerify: boolean;
}

function toFilename(title: string) {
  const map: Record<string, string> = {
    "경험 자동 정리": "경험정리",
    "이력서 자동 생성": "이력서",
    "자소서 작성": "자기소개서",
    "면접 질문 생성": "면접질문",
  };
  return `취준도우미_${map[title] ?? title}_${new Date().toISOString().slice(0, 10)}.md`;
}

export default function AiResultPanel({
  title,
  content,
  loading,
  onClose,
  onCopy,
  copied,
  onVerify,
  verifying,
  verifyResult,
  canVerify,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || verifying) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [content, verifyResult, loading, verifying]);

  function handleDownload() {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = toFilename(title);
    a.click();
    URL.revokeObjectURL(url);
  }

  const done = !loading && !!content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-lg">{title}</h2>
          <div className="flex items-center gap-2">
            {done && (
              <>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                >
                  다운로드 ↓
                </button>
                <button
                  type="button"
                  onClick={onCopy}
                  className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                >
                  {copied ? "복사됨 ✓" : "복사"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Claude 결과 */}
          {!content && loading && (
            <div className="flex items-center gap-3 text-gray-400 py-8 justify-center">
              <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              AI가 생성 중입니다…
            </div>
          )}
          {content && (
            <div className="prose prose-sm prose-gray max-w-none text-gray-700">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}

          {/* Gemini 교차검증 섹션 */}
          {done && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔍</span>
                  <span className="text-sm font-semibold text-gray-700">Gemini 교차검증</span>
                </div>
                {!verifyResult && !verifying && (
                  <button
                    type="button"
                    onClick={onVerify}
                    disabled={!canVerify}
                    className="text-sm px-4 py-1.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Gemini로 검증하기
                  </button>
                )}
                {!canVerify && !verifyResult && !verifying && (
                  <span className="text-xs text-amber-500 ml-2">Gemini API 키 필요</span>
                )}
              </div>

              {verifying && !verifyResult && (
                <div className="flex items-center gap-3 text-gray-400 py-4 justify-center">
                  <span className="inline-block w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                  Gemini가 검토 중입니다…
                </div>
              )}

              {verifyResult && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 prose prose-sm prose-gray max-w-none">
                  <ReactMarkdown>{verifyResult}</ReactMarkdown>
                </div>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {(loading || verifying) && (content || verifyResult) && (
          <div className="px-6 py-2 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
            <span className="inline-block w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
            생성 중…
          </div>
        )}
      </div>
    </div>
  );
}
