"use client";

import { useState, useRef } from "react";
import type { InterviewSettings } from "@/app/api/interview-session/route";

interface Props {
  applicationLabel: string;
  onStart: (settings: InterviewSettings) => void;
  onClose: () => void;
}

export default function InterviewSetupModal({ applicationLabel, onStart, onClose }: Props) {
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [difficulty, setDifficulty] = useState<"normal" | "pressure">("normal");
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [interviewType, setInterviewType] = useState<"job_round" | "executive_round">("job_round");
  const [resumeExpanded, setResumeExpanded] = useState(false);
  const [resumeContext, setResumeContext] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setResumeContext((prev) => (prev ? prev + "\n\n" + text : text));
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  function handleStart() {
    onStart({
      difficulty,
      totalQuestions,
      interviewType,
      questionNumber: 0,
      isLastQuestion: false,
      mode,
      resumeContext: resumeContext.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">모의 면접 설정</h2>
            <p className="text-xs text-gray-400 mt-0.5">{applicationLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl px-1">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* 면접 방식 */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">면접 방식</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "text", emoji: "⌨️", label: "텍스트", desc: "타이핑으로 답변" },
                { value: "voice", emoji: "🎙️", label: "음성", desc: "말로 답변 (Chrome 권장)" },
              ] as const).map(({ value, emoji, label, desc }) => (
                <button key={value} type="button"
                  onClick={() => setMode(value)}
                  className={`p-3 rounded-xl border text-left transition-colors
                    ${mode === value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <p className="text-xl mb-1">{emoji}</p>
                  <p className={`text-sm font-semibold ${mode === value ? "text-blue-700" : "text-gray-700"}`}>{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 면접 유형 */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">면접 유형</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                {
                  value: "job_round",
                  label: "1차 직무면접",
                  emoji: "💼",
                  desc: "직무 역량·기술·실무 경험 검증",
                  detail: "BEI·상황면접 중심",
                },
                {
                  value: "executive_round",
                  label: "2차 임원면접",
                  emoji: "🏢",
                  desc: "인성·가치관·조직 적합성 검증",
                  detail: "리더십·성장·입사 의지 중심",
                },
              ] as const).map(({ value, label, emoji, desc, detail }) => (
                <button key={value} type="button"
                  onClick={() => setInterviewType(value)}
                  className={`p-3 rounded-xl border text-left transition-colors
                    ${interviewType === value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <p className="text-xl mb-1">{emoji}</p>
                  <p className={`text-sm font-semibold ${interviewType === value ? "text-blue-700" : "text-gray-700"}`}>{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  <p className={`text-xs mt-0.5 ${interviewType === value ? "text-blue-400" : "text-gray-400"}`}>{detail}</p>
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

          {/* 이력서/자소서 추가 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setResumeExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium">이력서/자소서 추가 <span className="text-gray-400 font-normal">(선택)</span></span>
              {resumeExpanded ? (
                <span className="text-xs text-gray-400">접기 ▲</span>
              ) : (
                <span className="text-xs text-blue-600 font-medium">추가 ▼</span>
              )}
            </button>
            {resumeExpanded && (
              <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
                <textarea
                  value={resumeContext}
                  onChange={(e) => setResumeContext(e.target.value)}
                  rows={8}
                  placeholder={"이력서 또는 자소서 내용을 붙여넣거나 파일을 업로드하세요.\n면접 질문이 실제 서류 내용을 기반으로 생성됩니다."}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                />
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
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
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
