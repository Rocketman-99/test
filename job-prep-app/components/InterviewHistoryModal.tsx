"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Application } from "@/types/user";
import type { InterviewRecord } from "@/types/user";

interface Props {
  application: Application;
  onNewInterview: () => void;
  onClose: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

function loadHistory(appId: string): InterviewRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(`interview-history-${appId}`) ?? "[]");
  } catch {
    return [];
  }
}

export default function InterviewHistoryModal({ application, onNewInterview, onClose }: Props) {
  const [records] = useState<InterviewRecord[]>(() => loadHistory(application.id));
  const [viewingRecord, setViewingRecord] = useState<InterviewRecord | null>(null);

  const difficultyLabel = (d: string) => (d === "normal" ? "일반" : "압박");
  const typeLabel = (t: string) => (t === "job_round" ? "1차 직무" : "2차 임원");

  if (viewingRecord) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-gray-800 text-base">면접 기록 보기</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDate(viewingRecord.createdAt)} · {typeLabel(viewingRecord.settings.interviewType)} · {difficultyLabel(viewingRecord.settings.difficulty)} · {viewingRecord.settings.totalQuestions}문항
              </p>
            </div>
            <button type="button" onClick={() => setViewingRecord(null)} className="text-gray-400 hover:text-gray-600 text-xl px-1">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-950">
            {viewingRecord.messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "ai" && (
                  <div className="flex items-start gap-3 max-w-xl">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm shrink-0 mt-1">면</div>
                    <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-gray-100 text-sm leading-relaxed prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
                {msg.role === "user" && (
                  <div className="bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-3 text-white text-sm leading-relaxed max-w-xl">
                    {msg.content.split("【발화 분석】")[0].trim()}
                  </div>
                )}
              </div>
            ))}
            {viewingRecord.feedback && (
              <div className="mt-6 pt-6 border-t border-gray-700">
                <p className="text-xs text-gray-400 font-semibold mb-3">피드백</p>
                <div className="bg-gray-800 rounded-2xl px-4 py-3 text-gray-100 text-sm leading-relaxed prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{viewingRecord.feedback}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-gray-100">
            <button type="button" onClick={() => setViewingRecord(null)}
              className="w-full py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-xl text-sm font-medium transition-colors">
              목록으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800 text-base">모의 면접</h2>
            <p className="text-xs text-gray-400 mt-0.5">{application.label}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl px-1">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {records.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-3xl">📭</p>
              <p className="text-sm text-gray-500">아직 진행한 면접이 없습니다</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">이전 면접 기록을 선택하거나 새 면접을 시작하세요.</p>
              {records.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setViewingRecord(record)}
                  className="w-full text-left border border-gray-200 rounded-xl p-4 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-purple-600">
                      {typeLabel(record.settings.interviewType)} · {difficultyLabel(record.settings.difficulty)}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(record.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-500">{record.settings.totalQuestions}문항</p>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onNewInterview}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            새 면접 시작
          </button>
        </div>
      </div>
    </div>
  );
}
