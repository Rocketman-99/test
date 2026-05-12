"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { UserSpec, Application } from "@/types/user";
import type { InterviewSettings } from "@/app/api/interview-session/route";

interface Message {
  role: "ai" | "user";
  content: string;
  elapsed?: number;
}

type Phase = "preparing" | "ready" | "interviewing";
type TurnState = "processing" | "ai_speaking" | "listening" | "finished";

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

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export default function VoiceInterviewSession({ spec, application, settings, apiKey, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("preparing");
  const [questionBank, setQuestionBank] = useState("");
  const [bankProgress, setBankProgress] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [turnState, setTurnState] = useState<TurnState>("processing");
  const [questionNumber, setQuestionNumber] = useState(0);

  const [transcript, setTranscript] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [sttSupported, setSttSupported] = useState(true);
  const [fallbackText, setFallbackText] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const profile = {
    ...spec,
    jobPosting: application?.jobPosting ?? { url: "", text: "" },
  };

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) setSttSupported(false);

    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    };
  }, []);

  // Question bank generation
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
          profile,
          interviewType: settings.interviewType,
          difficulty: settings.difficulty,
          totalQuestions: settings.totalQuestions,
          apiKey: apiKey || undefined,
        }),
      });

      if (!res.ok || !res.body) { setQuestionBank("[오류]"); setPhase("ready"); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const lines = accumulated.split("\n").filter((l) => l.trim());
        setBankProgress(lines[lines.length - 1] ?? "");
      }
      setQuestionBank(accumulated);
      setPhase("ready");
    } catch {
      setQuestionBank("[오류]");
      setPhase("ready");
    }
  }

  // Timer
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, turnState]);

  // TTS
  function speakText(text: string, onEnd: () => void) {
    window.speechSynthesis.cancel();
    const clean = stripMarkdown(text);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "ko-KR";
    utterance.rate = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const koVoice = voices.find((v) => v.lang.startsWith("ko"));
    if (koVoice) utterance.voice = koVoice;

    utterance.onend = onEnd;
    utterance.onerror = () => onEnd();
    window.speechSynthesis.speak(utterance);
  }

  function skipTTS() {
    window.speechSynthesis.cancel();
    beginListening();
  }

  // STT
  function beginListening() {
    setTranscript("");
    setFallbackText("");
    setElapsed(0);
    setTimerRunning(true);
    setTurnState("listening");
    isListeningRef.current = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setTranscript(t);
    };

    recognition.onend = () => {
      // 사용자가 아직 제출 안 했으면 자동 재시작
      if (isListeningRef.current) {
        try { recognition.start(); } catch { /* already started */ }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      if (e.error === "not-allowed") setSttSupported(false);
    };

    recognition.start();
  }

  function stopListening() {
    isListeningRef.current = false;
    recognitionRef.current?.stop();
    setTimerRunning(false);
  }

  const sendToAI = useCallback(async (history: Message[], qNum: number, bank: string) => {
    setTurnState("processing");
    setMessages((prev) => [...prev, { role: "ai", content: "" }]);

    const isLast = qNum > 0 && qNum >= settings.totalQuestions;
    const currentSettings: InterviewSettings = { ...settings, questionNumber: qNum, isLastQuestion: isLast };
    const apiMessages = history.map((m) => ({
      role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

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
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "ai", content: "[오류] 서버 요청에 실패했습니다." };
          return next;
        });
        setTurnState("listening");
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
        setTurnState("finished");
        speakText(accumulated, () => {});
      } else {
        setTurnState("ai_speaking");
        speakText(accumulated, () => beginListening());
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "ai", content: "[오류] 네트워크 오류가 발생했습니다." };
        return next;
      });
      setTurnState("listening");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, profile, apiKey]);

  function handleStart() {
    setPhase("interviewing");
    sendToAI([], 0, questionBank);
  }

  function handleSubmit() {
    const answer = sttSupported ? transcript : fallbackText;
    if (!answer.trim() || turnState !== "listening") return;

    stopListening();
    const answerElapsed = elapsed;
    const userMsg: Message = { role: "user", content: answer.trim(), elapsed: answerElapsed };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setTranscript("");
    setFallbackText("");

    const nextQ = questionNumber + 1;
    setQuestionNumber(nextQ);
    sendToAI(newHistory, nextQ, questionBank);
  }

  const difficultyLabel = settings.difficulty === "normal" ? "일반" : "압박";
  const typeLabel = settings.interviewType === "job_round" ? "1차 직무" : "2차 임원";
  const progress = Math.min(questionNumber, settings.totalQuestions);
  const currentAiMsg = messages[messages.length - 1]?.role === "ai" ? messages[messages.length - 1] : null;

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
                : "질문 뱅크 준비 완료. 면접관의 말을 듣고 음성으로 답변하세요."}
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
              <div className="bg-gray-900 rounded-2xl p-4 text-left space-y-2 border border-gray-800">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">면접 설정</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 bg-blue-900 text-blue-300 rounded-full">{typeLabel} 면접</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${settings.difficulty === "pressure" ? "bg-red-900 text-red-300" : "bg-green-900 text-green-300"}`}>
                    {difficultyLabel}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded-full">질문 {settings.totalQuestions}개</span>
                  <span className="text-xs px-2 py-1 bg-purple-900 text-purple-300 rounded-full">🎙️ 음성 모드</span>
                  {application && (
                    <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded-full">{application.label}</span>
                  )}
                </div>
                {!sttSupported && (
                  <p className="text-xs text-yellow-400 pt-1">
                    ⚠ 이 브라우저는 음성 인식을 지원하지 않아요. Chrome/Edge를 권장합니다. 텍스트 입력으로 대체됩니다.
                  </p>
                )}
              </div>
              <button type="button" onClick={handleStart}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base transition-colors">
                음성 면접 시작 →
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
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-sm">🎙️ 음성 면접</span>
          {application && <span className="text-gray-400 text-xs">{application.label}</span>}
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">{typeLabel}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${settings.difficulty === "pressure" ? "bg-red-900 text-red-300" : "bg-green-900 text-green-300"}`}>
            {difficultyLabel}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {turnState !== "finished" && <span className="text-gray-400 text-xs">{progress} / {settings.totalQuestions}</span>}
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
      {turnState !== "finished" && (
        <div className="h-1 bg-gray-800">
          <div className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${(progress / settings.totalQuestions) * 100}%` }} />
        </div>
      )}

      {/* 메인 */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* 이전 대화 이력 (현재 AI 메시지 제외) */}
          {messages.length > 1 && (
            <div className="space-y-2 opacity-50">
              {messages.slice(0, -1).map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "ai" ? (
                    <div className="bg-gray-800 rounded-xl px-3 py-2 text-gray-400 text-xs max-w-sm leading-relaxed line-clamp-2">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="bg-blue-900/60 rounded-xl px-3 py-2 text-blue-300 text-xs max-w-sm leading-relaxed">
                      {msg.elapsed !== undefined && (
                        <span className="text-blue-500 mr-2">{formatTime(msg.elapsed)}</span>
                      )}
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 현재 AI 메시지 (크게 표시) */}
          {currentAiMsg && (
            <div className={`bg-gray-800 rounded-2xl p-5 border transition-all
              ${turnState === "ai_speaking" ? "border-blue-500/50" : "border-gray-700"}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm shrink-0
                  ${turnState === "ai_speaking" ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-800" : ""}`}>
                  면
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 text-xs font-medium">면접관</span>
                  {turnState === "ai_speaking" && (
                    <span className="flex gap-0.5 items-end h-4">
                      {[0, 100, 200, 300, 400].map((d, idx) => (
                        <span key={d}
                          className="w-0.5 bg-blue-400 rounded-full animate-bounce"
                          style={{ height: `${[8, 14, 10, 16, 8][idx]}px`, animationDelay: `${d}ms` }} />
                      ))}
                    </span>
                  )}
                  {turnState === "processing" && (
                    <span className="flex gap-1">
                      {[0, 150, 300].map((d) => (
                        <span key={d} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                          style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </span>
                  )}
                </div>
              </div>
              {currentAiMsg.content ? (
                <p className="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">{currentAiMsg.content}</p>
              ) : (
                <div className="flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"
                      style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 답변 중 라이브 트랜스크립트 미리보기 */}
          {turnState === "listening" && (transcript || fallbackText) && (
            <div className="flex justify-end">
              <div className="bg-blue-900/40 border border-blue-700/50 rounded-2xl px-4 py-3 max-w-md">
                <p className="text-blue-200 text-sm leading-relaxed">{sttSupported ? transcript : fallbackText}</p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* 하단 컨트롤 */}
      <div className="px-4 py-5 bg-gray-900 border-t border-gray-800">
        <div className="max-w-2xl mx-auto">

          {turnState === "processing" && (
            <div className="flex justify-center items-center gap-2 text-gray-400 text-sm py-3">
              <span className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
              <span>면접관이 답변 생성 중…</span>
            </div>
          )}

          {turnState === "ai_speaking" && (
            <div className="space-y-3">
              <div className="flex justify-center items-center gap-2 text-blue-300 text-sm">
                <span className="flex gap-0.5 items-end h-5">
                  {[0, 100, 200, 300, 400].map((d, idx) => (
                    <span key={d}
                      className="w-1 bg-blue-400 rounded-full animate-bounce"
                      style={{ height: `${[10, 18, 12, 20, 10][idx]}px`, animationDelay: `${d}ms` }} />
                  ))}
                </span>
                <span>면접관이 말하는 중…</span>
              </div>
              <button type="button" onClick={skipTTS}
                className="w-full py-2.5 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-xl text-sm transition-colors">
                건너뛰고 바로 답변하기 →
              </button>
            </div>
          )}

          {turnState === "listening" && (
            <div className="space-y-3">
              {elapsed > 90 && (
                <p className={`text-xs text-center ${elapsed > 120 ? "text-red-400" : "text-yellow-400"}`}>
                  {elapsed > 120 ? "⚠ 2분 초과 — 답변을 마무리해주세요" : "💡 1분 30초 경과 — 곧 마무리해주세요"}
                </p>
              )}

              {sttSupported ? (
                <div className="flex items-center gap-3">
                  {/* 마이크 애니메이션 */}
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center">
                      <span className="text-2xl">🎙️</span>
                    </div>
                    <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-25" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-500 text-xs mb-1">말씀하세요… (한국어)</p>
                    <p className="text-gray-200 text-sm leading-relaxed">
                      {transcript || <span className="text-gray-600 italic">음성 인식 대기 중…</span>}
                    </p>
                  </div>
                  <button type="button" onClick={handleSubmit}
                    disabled={!transcript.trim()}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                    제출
                  </button>
                </div>
              ) : (
                /* STT 미지원 시 텍스트 입력 폴백 */
                <div className="space-y-2">
                  <p className="text-xs text-yellow-400">⚠ 음성 인식 미지원 — 텍스트로 입력해주세요.</p>
                  <div className="flex gap-2">
                    <textarea
                      value={fallbackText}
                      onChange={(e) => setFallbackText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                      placeholder="답변을 입력하세요. (Enter 제출 / Shift+Enter 줄바꿈)"
                      rows={3}
                      className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <button type="button" onClick={handleSubmit}
                      disabled={!fallbackText.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end">
                      제출
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {turnState === "finished" && (
            <div className="text-center space-y-3">
              <p className="text-gray-400 text-sm">면접이 종료됐습니다.</p>
              <button type="button" onClick={onClose}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors">
                대시보드로 돌아가기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
