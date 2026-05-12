"use client";

import { useEffect, useRef } from "react";

interface Props {
  title: string;
  content: string;
  loading: boolean;
  onClose: () => void;
  onCopy: () => void;
  copied: boolean;
}

export default function AiResultPanel({
  title,
  content,
  loading,
  onClose,
  onCopy,
  copied,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [content, loading]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-lg">{title}</h2>
          <div className="flex items-center gap-2">
            {content && (
              <button
                type="button"
                onClick={onCopy}
                className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
              >
                {copied ? "복사됨 ✓" : "복사"}
              </button>
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
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!content && loading && (
            <div className="flex items-center gap-3 text-gray-400 py-8 justify-center">
              <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              AI가 생성 중입니다…
            </div>
          )}
          {content && (
            <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
              {content}
            </pre>
          )}
          <div ref={bottomRef} />
        </div>

        {loading && content && (
          <div className="px-6 py-2 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
            <span className="inline-block w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
            생성 중…
          </div>
        )}
      </div>
    </div>
  );
}
