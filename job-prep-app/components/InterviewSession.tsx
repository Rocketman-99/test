"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import type { UserSpec, Application } from "@/types/user";
import type { InterviewSettings } from "@/app/api/interview-session/route";

interface Message {
  role: "ai" | "user";
  content: string;
  elapsed?: number; // 답변 소요 시간 (초)
}

interface Props {
  spec: UserSpec;
  application: Application | null;
  settings: InterviewSettings;
  apiKey: string;
  onClose: () => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function InterviewSession({ spec, application, settings, apiKey, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(0);

  // 타이머
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const profile = {
    ...spec,
    jobPosting: application?.jobPosting ?? { url: "", text: "" },
  };

  // 첫 질문 자동 시작
  useEffect(() => {
    sendToAI([], 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // 타이머 제어
  function startTimer() {
    setElapsed(0);
    setTimerRunning(true);
  }

  function stopTimer() {
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const sendToAI = useCallback(async (history: Message[], qNum: number) => {
    setLoading(true);
    stopTimer();

    const isLast = qNum > 0 && qNum >= settings.totalQuestions;
    const currentSettings: InterviewSettings = {
      ...settings,
      questionNumber: qNum,
      isLastQuestion: isLast,
    };

    const apiMessages = history.map((m) => ({
      role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

    // AI 메시지 placeholder
    setMessages((prev) => [...prev, { role: "ai", content: "" }]);

    try {
      const res = await fetch("/api/interview-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          messages: apiMessages,
          settings: currentSettings,
          apiKey: apiKey || undefined,
        }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "ai", content: "[오류] 서버 요청에 실패했습니다." };
          return next;
        });
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "ai", content: accumulated };
          return next;
        });
      }

      if (isLast) {
        setFinished(true);
      } else {
        // AI 질문이 끝나면 타이머 시작
        startTimer();
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "ai", content: "[오류] 네트워크 오류가 발생했습니다." };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [settings, profile, apiKey]);

  function handleSubmit() {
    if (!answer.trim() || loading || finished) return;

    const answerElapsed = elapsed;
    stopTimer();

    const userMsg: Message = { role: "user", content: answer.trim(), elapsed: answerElapsed };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setAnswer("");

    const nextQ = questionNumber + 1;
    setQuestionNumber(nextQ);
    sendToAI(newHistory, nextQ);
  }

  const difficultyLabel = settings.difficulty === "normal" ? "일반" : "압박";
  const typeLabel = settings.interviewType === "personal" ? "인성" : settings.interviewType === "job" ? "직무" : "혼합";
  const progress = Math.min(questionNumber, settings.totalQuestions);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-sm">🎤 모의 면접</span>
          {application && (
            <span className="text-gray-400 text-xs">{application.label}</span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">{typeLabel}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${settings.difficulty === "pressure" ? "bg-red-900 text-red-300" : "bg-green-900 text-green-300"}`}>
            {difficultyLabel}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* 진행도 */}
          {!finished && (
            <span className="text-gray-400 text-xs">
              {progress} / {settings.totalQuestions}
            </span>
          )}
          {/* 타이머 */}
          {timerRunning && (
            <span className={`font-mono text-sm font-bold ${elapsed > 120 ? "text-red-400" : elapsed > 90 ? "text-yellow-400" : "text-green-400"}`}>
              {formatTime(elapsed)}
            </span>
          )}
          <button type="button" onClick={onClose}
            className="text-gray-400 hover:text-white text-sm px-3 py-1.5 border border-gray-700 rounded-lg transition-colors">
            종료
          </button>
        </div>
      </div>

      {/* 진행 바 */}
      {!finished && (
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${(progress / settings.totalQuestions) * 100}%` }}
          />
        </div>
      )}

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "ai" && (
                <div className="flex items-start gap-3 max-w-xl">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm shrink-0 mt-1">
                    면
                  </div>
                  <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-gray-100 text-sm leading-relaxed prose prose-sm prose-invert max-w-none">
                    {msg.content
                      ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                      : <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                    }
                  </div>
                </div>
              )}
              {msg.role === "user" && (
                <div className="flex items-end gap-2 max-w-xl">
                  {msg.elapsed !== undefined && (
                    <span className="text-xs text-gray-500 mb-1">{formatTime(msg.elapsed)}</span>
                  )}
                  <div className="bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-3 text-white text-sm leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 입력 영역 */}
      {!finished ? (
        <div className="px-4 py-4 bg-gray-900 border-t border-gray-800">
          <div className="max-w-2xl mx-auto space-y-2">
            {timerRunning && elapsed > 90 && (
              <p className={`text-xs text-center ${elapsed > 120 ? "text-red-400" : "text-yellow-400"}`}>
                {elapsed > 120 ? "⚠ 2분 초과 — 답변을 마무리해주세요" : "💡 1분 30초 경과 — 곧 마무리해주세요"}
              </p>
            )}
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                disabled={loading || finished}
                placeholder={loading ? "면접관이 말하는 중…" : "답변을 입력하세요. (Enter로 제출 / Shift+Enter 줄바꿈)"}
                rows={3}
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !answer.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end"
              >
                제출
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 bg-gray-900 border-t border-gray-800 text-center">
          <p className="text-gray-400 text-sm mb-3">면접이 종료됐습니다.</p>
          <button type="button" onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors">
            대시보드로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}
