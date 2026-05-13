"use client";

import { useState } from "react";
import { Application, JobPosting } from "@/types/user";

interface Props {
  onSave: (app: Application) => void;
  onClose: () => void;
  initial?: Application;
}

export default function AddApplicationModal({ onSave, onClose, initial }: Props) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [inputMode, setInputMode] = useState<"url" | "text">(
    initial?.jobPosting.text ? "text" : "url"
  );
  const [url, setUrl] = useState(initial?.jobPosting.url ?? "");
  const [text, setText] = useState(initial?.jobPosting.text ?? "");
  const [coverLetterPrompts, setCoverLetterPrompts] = useState(initial?.coverLetterPrompts ?? "");
  const [error, setError] = useState("");

  function handleSave() {
    if (inputMode === "url" && !url.trim()) {
      setError("공고 URL을 입력해주세요.");
      return;
    }
    if (inputMode === "text" && text.trim().length < 20) {
      setError("공고 내용을 좀 더 붙여넣어주세요.");
      return;
    }

    const jobPosting: JobPosting = {
      url: inputMode === "url" ? url.trim() : "",
      text: inputMode === "text" ? text.trim() : "",
    };

    const autoLabel = label.trim() || (url ? new URL(url).hostname.replace("www.", "") : "새 공고");

    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      label: autoLabel,
      jobPosting,
      coverLetterPrompts: coverLetterPrompts.trim() || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-lg">
            {initial ? "공고 수정" : "공고 추가"}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl px-1">
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 공고 이름 */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">공고 이름 (선택)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: 카카오 백엔드, 네이버 기획 등"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
            <p className="text-xs text-gray-400">비워두면 URL 도메인으로 자동 설정됩니다.</p>
          </div>

          {/* 입력 방식 탭 */}
          <div className="flex border-b gap-4">
            {(["url", "text"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setInputMode(mode); setError(""); }}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors -mb-px
                  ${inputMode === mode ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                {mode === "url" ? "URL 입력" : "공고 내용 붙여넣기"}
              </button>
            ))}
          </div>

          {inputMode === "url" ? (
            <div className="space-y-1">
              <input
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(""); }}
                placeholder="https://www.wanted.co.kr/wd/..."
                className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors
                  ${error ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:ring-blue-200 focus:border-blue-400"}`}
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          ) : (
            <div className="space-y-1">
              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setError(""); }}
                placeholder="채용 공고 내용을 복사해서 붙여넣으세요."
                rows={8}
                className={`w-full px-3 py-2 border rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors resize-none
                  ${error ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:ring-blue-200 focus:border-blue-400"}`}
              />
              <div className="flex justify-between">
                {error ? <p className="text-xs text-red-500">{error}</p> : <span />}
                <p className="text-xs text-gray-400">{text.length}자</p>
              </div>
            </div>
          )}
          {/* 자소서 문항 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">자소서 문항 <span className="text-gray-400 font-normal">(선택)</span></label>
            </div>
            <textarea
              value={coverLetterPrompts}
              onChange={(e) => setCoverLetterPrompts(e.target.value)}
              placeholder={`기업에서 요구하는 자소서 문항을 입력하세요.\n문항이 있으면 해당 문항에 맞게 자소서가 생성됩니다.\n\n예시:\n1. 지원 동기 및 입사 후 포부 (500자)\n2. 본인의 강점과 직무 연관성 (700자)\n3. 어려운 상황을 극복한 경험 (600자)`}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none"
            />
            <p className="text-xs text-gray-400">문항 미입력 시 일반 자소서 항목(성장과정·지원동기·포부 등)으로 생성됩니다.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-lg text-sm font-medium transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
