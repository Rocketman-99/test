"use client";

import { useState, useRef } from "react";

interface Props {
  applicationLabel: string;
  onGenerate: (coverLetter: string, questionCount: number) => void;
  onClose: () => void;
}

export default function InterviewQuestionsModal({ applicationLabel, onGenerate, onClose }: Props) {
  const [coverLetter, setCoverLetter] = useState("");
  const [questionCount, setQuestionCount] = useState(15);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCoverLetter((prev) => (prev ? prev + "\n\n" + text : text));
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">면접 질문 생성</h2>
            <p className="text-xs text-gray-400 mt-0.5">{applicationLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl px-1">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">질문 수</label>
            <div className="mt-1.5">
              <input
                type="number"
                min={1}
                max={50}
                value={questionCount}
                onChange={(e) => setQuestionCount(Math.max(1, Math.min(50, Number(e.target.value) || 15)))}
                className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">자소서 첨부 <span className="font-normal text-gray-400">(권장)</span></label>
            <p className="text-xs text-gray-400 mt-0.5 mb-2">자소서를 첨부하면 실제 서류 기반의 꼬리 질문이 생성됩니다.</p>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={8}
              placeholder={"제출한 자소서 내용을 붙여넣으세요.\n\n자소서 없이도 채용공고와 기업정보 기반으로 질문을 생성할 수 있습니다."}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-lg transition-colors"
              >
                📎 파일 업로드 (.md, .txt)
              </button>
              <span className="text-xs text-gray-400">{coverLetter.length}자</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-lg text-sm font-medium transition-colors">
            취소
          </button>
          <button
            type="button"
            onClick={() => onGenerate(coverLetter, questionCount)}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            질문 생성하기
          </button>
        </div>
      </div>
    </div>
  );
}
