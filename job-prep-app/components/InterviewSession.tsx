"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import type { UserSpec, Application, InterviewRecord } from "@/types/user";
import type { InterviewSettings } from "@/app/api/interview-session/route";

interface Message {
  role: "ai" | "user";
  content: string;
  elapsed?: number;
}

type Phase = "preparing" | "ready" | "interviewing";

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
  const [phase, setPhase] = useState<Phase>("preparing");
  const [questionBank, setQuestionBank] = useState("");
  const [bankProgress, setBankProgress] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(0);

  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [aiError, setAiError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const profile = {
    ...spec,
    jobPosting: application?.jobPosting ?? { url: "", text: "" },
  };

  // ── 1단계: 질문 뱅크 생성 ─────────────────────────────
  useEffect(() => {
    generateQuestionBank();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateQuestionBank() {
    setPhase("preparing");
    try {
      const res = await fetch("/api/generate-question-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spec,
          application,
          interviewType: settings.interviewType,
          difficulty: settings.difficulty,
          totalQuestions: settings.totalQuestions,
          coverLetter: settings.coverLetter || undefined,
          apiKey: apiKey || undefined,
        }),
      });

      if (!res.ok || !res.body) {
        setQuestionBank("[오류] 질문 뱅크 생성 실패");
        setPhase("ready");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        // 준비 화면에 진행 상황 표시 (마지막 줄만)
        const lines = accumulated.split("\n").filter((l) => l.trim());
        setBankProgress(lines[lines.length - 1] ?? "");
      }

      setQuestionBank(accumulated);
      setPhase("ready");
    } catch {
      setQuestionBank("[오류] 네트워크 오류");
      setPhase("ready");
    }
  }

  // ── 2단계: 면접 진행 ──────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

  function saveInterviewRecord(finalMessages: Message[], feedback?: string) {
    if (typeof window === "undefined" || !application) return;
    const key = `interview-history-${application.id}`;
    let existing: InterviewRecord[] = [];
    try { existing = JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { existing = []; }
    const record: InterviewRecord = {
      id: crypto.randomUUID(),
      settings: {
        difficulty: settings.difficulty,
        totalQuestions: settings.totalQuestions,
        interviewType: settings.interviewType,
        mode: settings.mode,
      },
      messages: finalMessages,
      feedback,
      createdAt: new Date().toISOString(),
    };
    const updated = [record, ...existing].slice(0, 5);
    localStorage.setItem(key, JSON.stringify(updated));
  }

  async function loadFeedback(finalMessages: Message[]) {
    setFeedbackLoading(true);
    setFeedbackContent("");
    setFeedbackVisible(true);
    try {
      const res = await fetch("/api/interview-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          messages: finalMessages,
          settings,
          apiKey: apiKey || undefined,
        }),
      });
      if (!res.ok || !res.body) {
        setFeedbackContent("[오류] 피드백 생성에 실패했습니다.");
        setFeedbackLoading(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setFeedbackContent(accumulated);
      }
      saveInterviewRecord(finalMessages, accumulated);
    } catch {
      setFeedbackContent("[오류] 네트워크 오류가 발생했습니다.");
    } finally {
      setFeedbackLoading(false);
    }
  }

  function stopAI() {
    abortRef.current?.abort();
  }

  const sendToAI = useCallback(async (history: Message[], qNum: number, bank: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setAiError("");
    stopTimer();

    const isLast = qNum > 0 && qNum > settings.totalQuestions;
    const currentSettings: InterviewSettings = {
      ...settings,
      questionNumber: qNum,
      isLastQuestion: isLast,
    };

    const apiMessages = history.map((m) => ({
      role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

    setMessages((prev) => [...prev, { role: "ai", content: "" }]);

    try {
      const res = await fetch("/api/interview-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          messages: apiMessages,
          settings: currentSettings,
          questionBank: bank || undefined,
          apiKey: apiKey || undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => prev.slice(0, -1)); // rollback empty AI bubble
        setAiError("서버 요청에 실패했습니다. 다시 제출해주세요.");
        startTimer();
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

      if (accumulated.startsWith("[오류]")) {
        // API returned error text — rollback and allow retry
        setMessages((prev) => prev.slice(0, -1));
        setAiError(accumulated.replace("[오류] ", ""));
        startTimer();
        setTimeout(() => textareaRef.current?.focus(), 100);
        return;
      }

      // Successful response — now increment counter
      setQuestionNumber(qNum);

      if (isLast) {
        setFinished(true);
        const finalMessages = [...history, { role: "ai" as const, content: accumulated }];
        saveInterviewRecord(finalMessages);
      } else {
        startTimer();
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setMessages((prev) => prev.slice(0, -1));
        setAiError("네트워크 오류가 발생했습니다. 다시 제출해주세요.");
        startTimer();
      }
    } finally {
      setLoading(false);
    }
  }, [settings, profile, apiKey]);

  function handleStart() {
    setPhase("interviewing");
    sendToAI([], 0, questionBank);
  }

  function handleSubmit() {
    if (!answer.trim() || loading || finished) return;

    const answerElapsed = elapsed;
    stopTimer();

    const userMsg: Message = { role: "user", content: answer.trim(), elapsed: answerElapsed };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setAnswer("");

    const nextQ = questionNumber + 1;
    sendToAI(newHistory, nextQ, questionBank);
  }

  const difficultyLabel = settings.difficulty === "normal" ? "일반" : "압박";
  const typeLabel = settings.interviewType === "job_round" ? "1차 직무" : "2차 임원";
  const progress = Math.min(questionNumber, settings.totalQuestions);

  // ── 준비 화면 ─────────────────────────────────────────
  if (phase === "preparing" || phase === "ready") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950 p-6">
        <div className="w-full max-w-lg space-y-6 text-center">
          <div className="space-y-2">
            <div className="text-4xl">{phase === "preparing" ? "🧠" : "✅"}</div>
            <h2 className="text-white text-xl font-bold">
              {phase === "preparing" ? "면접 질문 준비 중…" : "준비 완료"}
            </h2>
            <p className="text-gray-400 text-sm">
              {phase === "preparing"
                ? "프로필과 채용 공고를 분석해 맞춤 질문을 생성하고 있어요."
                : "지원자 분석과 질문 뱅크가 준비됐습니다."}
            </p>
          </div>

          {phase === "preparing" ? (
            <div className="space-y-3">
              <div className="flex justify-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
              {bankProgress && (
                <p className="text-xs text-gray-500 truncate max-w-xs mx-auto">{bankProgress}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* 준비 요약 */}
              <div className="bg-gray-900 rounded-2xl p-4 text-left space-y-2 border border-gray-800">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">면접 설정</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 bg-blue-900 text-blue-300 rounded-full">{typeLabel} 면접</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${settings.difficulty === "pressure" ? "bg-red-900 text-red-300" : "bg-green-900 text-green-300"}`}>
                    {difficultyLabel}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded-full">
                    질문 {settings.totalQuestions}개
                  </span>
                  {application && (
                    <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded-full">
                      {application.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 pt-1">
                  자기소개서·직무·기업·인성 질문이 자연스럽게 혼합됩니다.
                </p>
              </div>

              <button type="button" onClick={handleStart}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base transition-colors">
                면접 시작 →
              </button>
              <button type="button" onClick={onClose}
                className="w-full py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors">
                취소
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 면접 화면 ─────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-sm">🎤 모의 면접</span>
          {application && <span className="text-gray-400 text-xs">{application.label}</span>}
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">{typeLabel}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${settings.difficulty === "pressure" ? "bg-red-900 text-red-300" : "bg-green-900 text-green-300"}`}>
            {difficultyLabel}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {!finished && <span className="text-gray-400 text-xs">{progress} / {settings.totalQuestions}</span>}
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

      {!finished && (
        <div className="h-1 bg-gray-800">
          <div className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${(progress / settings.totalQuestions) * 100}%` }} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "ai" && (
                <div className="flex items-start gap-3 max-w-xl">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm shrink-0 mt-1">면</div>
                  <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-gray-100 text-sm leading-relaxed prose prose-sm prose-invert max-w-none">
                    {msg.content
                      ? <ReactMarkdown>{msg.content}</ReactMarkdown>
                      : <span className="inline-flex gap-1">
                          {[0, 150, 300].map((d) => (
                            <span key={d} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                              style={{ animationDelay: `${d}ms` }} />
                          ))}
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

      {!finished ? (
        <div className="px-4 py-4 bg-gray-900 border-t border-gray-800">
          <div className="max-w-2xl mx-auto space-y-2">
            {aiError && (
              <p className="text-xs text-red-400 text-center bg-red-900/20 rounded-lg py-1.5">
                ⚠ {aiError}
              </p>
            )}
            {timerRunning && elapsed > 90 && (
              <p className={`text-xs text-center ${elapsed > 120 ? "text-red-400" : "text-yellow-400"}`}>
                {elapsed > 120 ? "⚠ 2분 초과 — 답변을 마무리해주세요" : "💡 1분 30초 경과 — 곧 마무리해주세요"}
              </p>
            )}
            <div className="flex gap-2">
              <textarea ref={textareaRef} value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                disabled={loading || finished}
                placeholder={loading ? "면접관이 말하는 중…" : "답변을 입력하세요. (Enter 제출 / Shift+Enter 줄바꿈)"}
                rows={3}
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
              />
              {loading ? (
                <button type="button" onClick={stopAI}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition-colors self-end">
                  ■ 정지
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={!answer.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end">
                  제출
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 bg-gray-900 border-t border-gray-800">
          <div className="max-w-2xl mx-auto space-y-3">
            <p className="text-gray-400 text-sm text-center">면접이 종료됐습니다.</p>
            <div className="flex gap-2 justify-center">
              {!feedbackVisible && (
                <button
                  type="button"
                  onClick={() => loadFeedback(messages)}
                  disabled={feedbackLoading}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  {feedbackLoading ? "피드백 생성 중…" : "📊 피드백 보기"}
                </button>
              )}
              <button type="button" onClick={onClose}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors">
                대시보드로 돌아가기
              </button>
            </div>
            {feedbackVisible && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-400 font-semibold mb-3 text-center">📊 면접 피드백</p>
                {feedbackLoading && !feedbackContent ? (
                  <div className="flex justify-center gap-1 py-4">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded-2xl px-4 py-3 text-gray-100 text-sm leading-relaxed prose prose-sm prose-invert max-w-none max-h-[40vh] overflow-y-auto">
                    <ReactMarkdown>{feedbackContent}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
