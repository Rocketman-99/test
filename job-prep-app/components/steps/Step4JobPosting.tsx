"use client";

import { useState } from "react";
import { JobPosting } from "@/types/user";

interface Props {
  initialData: Partial<JobPosting>;
  onSubmit: (data: JobPosting) => void;
  onBack: () => void;
}

export default function Step4JobPosting({ initialData, onSubmit, onBack }: Props) {
  const [url, setUrl] = useState(initialData.url ?? "");
  const [text, setText] = useState(initialData.text ?? "");
  const [inputMode, setInputMode] = useState<"url" | "text">("url");
  const [error, setError] = useState("");

  function handleSubmit() {
    if (inputMode === "url" && !url.trim()) {
      setError("공고 URL을 입력해주세요.");
      return;
    }
    if (inputMode === "text" && text.trim().length < 20) {
      setError("공고 내용을 좀 더 붙여넣어주세요.");
      return;
    }
    setError("");
    onSubmit({ url: inputMode === "url" ? url : "", text: inputMode === "text" ? text : "" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">채용 공고 입력</h2>
        <p className="text-sm text-gray-500">
          지원할 공고를 입력하면 AI가 해당 공고에 최적화된 이력서와 자소서를 만들어드려요.
        </p>
      </div>

      {/* 건너뛰기 안내 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-500">
        공고가 아직 없으면 건너뛰어도 됩니다. 나중에 마이페이지에서 추가할 수 있어요.
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
          <label className="text-sm font-medium text-gray-700">채용 공고 URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(""); }}
            placeholder="https://www.wanted.co.kr/wd/..."
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors
              ${error ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:ring-blue-200 focus:border-blue-400"}`}
          />
          <p className="text-xs text-gray-400">원티드, 사람인, 잡코리아, 링크드인 등 URL을 붙여넣으세요.</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">공고 내용</label>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(""); }}
            placeholder="채용 공고 내용을 복사해서 붙여넣으세요. (자격요건, 우대사항, 담당업무 등)"
            rows={10}
            className={`w-full px-4 py-3 border rounded-lg text-sm leading-relaxed focus:outline-none focus:ring-2 transition-colors resize-none
              ${error ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:ring-blue-200 focus:border-blue-400"}`}
          />
          <div className="flex justify-between">
            {error ? <p className="text-xs text-red-500">{error}</p> : <span />}
            <p className="text-xs text-gray-400">{text.length}자</p>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
        >
          ← 이전
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSubmit({ url: "", text: "" })}
            className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-500 rounded-lg font-medium transition-colors"
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            완료 →
          </button>
        </div>
      </div>
    </div>
  );
}
