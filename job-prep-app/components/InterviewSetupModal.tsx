"use client";

import { useState } from "react";
import type { InterviewSettings } from "@/app/api/interview-session/route";

interface Props {
  applicationLabel: string;
  onStart: (settings: InterviewSettings) => void;
  onClose: () => void;
}

export default function InterviewSetupModal({ applicationLabel, onStart, onClose }: Props) {
  const [difficulty, setDifficulty] = useState<"normal" | "pressure">("normal");
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [interviewType, setInterviewType] = useState<"personal" | "job" | "mixed">("mixed");

  function handleStart() {
    onStart({ difficulty, totalQuestions, interviewType, questionNumber: 0, isLastQuestion: false });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">모의 면접 설정</h2>
            <p className="text-xs text-gray-400 mt-0.5">{applicationLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl px-1">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 면접 유형 */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">면접 유형</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "personal", label: "인성", desc: "가치관·경험 중심" },
                { value: "job", label: "직무", desc: "기술·역량 중심" },
                { value: "mixed", label: "혼합", desc: "인성 + 직무" },
              ] as const).map(({ value, label, desc }) => (
                <button key={value} type="button"
                  onClick={() => setInterviewType(value)}
                  className={`p-3 rounded-xl border text-left transition-colors
                    ${interviewType === value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <p className={`text-sm font-medium ${interviewType === value ? "text-blue-700" : "text-gray-700"}`}>{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 난이도 */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">난이도</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "normal", label: "일반 면접", desc: "편안한 분위기", emoji: "😊" },
                { value: "pressure", label: "압박 면접", desc: "날카로운 반론·재질문", emoji: "😤" },
              ] as const).map(({ value, label, desc, emoji }) => (
                <button key={value} type="button"
                  onClick={() => setDifficulty(value)}
                  className={`p-3 rounded-xl border text-left transition-colors
                    ${difficulty === value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <p className="text-xl mb-1">{emoji}</p>
                  <p className={`text-sm font-medium ${difficulty === value ? "text-blue-700" : "text-gray-700"}`}>{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 질문 수 */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">질문 수</label>
            <div className="flex gap-2">
              {[5, 10, 15].map((n) => (
                <button key={n} type="button"
                  onClick={() => setTotalQuestions(n)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors
                    ${totalQuestions === n ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 text-gray-600"}`}>
                  {n}개
                  <span className="block text-xs font-normal text-gray-400 mt-0.5">
                    {n === 5 ? "~10분" : n === 10 ? "~20분" : "~30분"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-lg text-sm font-medium transition-colors">
            취소
          </button>
          <button type="button" onClick={handleStart}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors">
            면접 시작 →
          </button>
        </div>
      </div>
    </div>
  );
}
