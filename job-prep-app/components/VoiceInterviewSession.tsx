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
type TurnState = "processing" | "ai_speaking" | "recording_ready" | "recording" | "analyzing" | "finished";

interface Props {
  spec: UserSpec;
  application: Application | null;
  settings: InterviewSettings;
  apiKey: string;
  geminiKey: string;
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
    .replace(/【발화 분석】[\s\S]*$/, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function VoiceInterviewSession({ spec, application, settings, apiKey, geminiKey, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("preparing");
  const [questionBank, setQuestionBank] = useState("");
  const [bankProgress, setBankProgress] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [turnState, setTurnState] = useState<TurnState>("processing");
  const [questionNumber, setQuestionNumber] = useState(0);
  const [analyzeError, setAnalyzeError] = useState("");

  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const profile = {
    ...spec,
    jobPosting: application?.jobPosting ?? { url: "", text: "" },
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      mediaRecorderRef.current?.stop();
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
    setTurnState("recording_ready");
  }

  // Recording
  async function startRecording() {
    setAnalyzeError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(200);
      setElapsed(0);
      setTimerRunning(true);
      setTurnState("recording");
    } catch {
      setAnalyzeError("마이크 접근 권한이 필요합니다. 브라우저 설정에서 허용해주세요.");
    }
  }

  async function stopAndAnalyze() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    setTimerRunning(false);
    setTurnState("analyzing");

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    });

    const mimeType = recorder.mimeType.split(";")[0];
    const blob = new Blob(audioChunksRef.current, { type: mimeType });

    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch("/api/analyze-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          audioMimeType: mimeType,
          geminiApiKey: geminiKey || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setAnalyzeError(err.error ?? "음성 분석 실패");
        setTurnState("recording_ready");
        return;
      }

      const { transcript, deliveryNotes } = await res.json() as { transcript: string; deliveryNotes: string };

      if (!transcript?.trim()) {
        setAnalyzeError("음성이 인식되지 않았습니다. 다시 녹음해주세요.");
        setTurnState("recording_ready");
        return;
      }

      // 전사 + 발화 분석을 사용자 메시지로 구성
      const answerElapsed = elapsed;
      const content = `${transcript}\n\n【발화 분석】\n${deliveryNotes}`;
      const userMsg: Message = { role: "user", content, elapsed: answerElapsed };
      const newHistory = [...messages, userMsg];
      setMessages(newHistory);

      const nextQ = questionNumber + 1;
      setQuestionNumber(nextQ);
      sendToAI(newHistory, nextQ, questionBank);
    } catch {
      setAnalyzeError("음성 분석 중 오류가 발생했습니다.");
      setTurnState("recording_ready");
    }
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
        setTurnState("recording_ready");
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
        speakText(accumulated, () => setTurnState("recording_ready"));
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "ai", content: "[오류] 네트워크 오류가 발생했습니다." };
        return next;
      });
      setTurnState("recording_ready");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, profile, apiKey]);

  function handleStart() {
    setPhase("interviewing");
    sendToAI([], 0, questionBank);
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
                : "Gemini가 음성을 직접 분석합니다. 말투·자신감·속도까지 피드백해드려요."}
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
                  <span className="text-xs px-2 py-1 bg-purple-900 text-purple-300 rounded-full">🎙️ 음성 분석</span>
                  {application && (
                    <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded-full">{application.label}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 pt-1">
                  Gemini AI가 음성 내용 + 발화 방식을 분석 후 Claude가 면접 피드백을 드립니다.
                </p>
                {!geminiKey && (
                  <p className="text-xs text-yellow-400 pt-1">
                    ⚠ Gemini API 키가 없습니다. 대시보드 설정에서 입력해주세요.
                  </p>
                )}
              </div>
              <button type="button" onClick={handleStart} disabled={!geminiKey && !process.env.GEMINI_API_KEY}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-base transition-colors">
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

          {/* 이전 대화 이력 */}
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
                      {/* 발화 분석 섹션 제거하고 전사 내용만 표시 */}
                      {msg.content.split("【발화 분석】")[0].trim()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 현재 AI 메시지 */}
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
                        <span key={d} className="w-0.5 bg-blue-400 rounded-full animate-bounce"
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

          <div ref={bottomRef} />
        </div>
      </div>

      {/* 하단 컨트롤 */}
      <div className="px-4 py-5 bg-gray-900 border-t border-gray-800">
        <div className="max-w-2xl mx-auto space-y-3">

          {analyzeError && (
            <p className="text-xs text-red-400 text-center">{analyzeError}</p>
          )}

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

          {turnState === "analyzing" && (
            <div className="flex justify-center items-center gap-2 text-purple-300 text-sm py-3">
              <span className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
              <span>Gemini가 음성 분석 중… (내용 + 발화 방식)</span>
            </div>
          )}

          {turnState === "ai_speaking" && (
            <div className="space-y-2">
              <div className="flex justify-center items-center gap-2 text-blue-300 text-sm">
                <span className="flex gap-0.5 items-end h-5">
                  {[0, 100, 200, 300, 400].map((d, idx) => (
                    <span key={d} className="w-1 bg-blue-400 rounded-full animate-bounce"
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

          {turnState === "recording_ready" && (
            <div className="space-y-2">
              {elapsed > 0 && elapsed > 90 && (
                <p className={`text-xs text-center ${elapsed > 120 ? "text-red-400" : "text-yellow-400"}`}>
                  {elapsed > 120 ? "⚠ 2분 초과 — 답변을 마무리해주세요" : "💡 1분 30초 경과 — 곧 마무리해주세요"}
                </p>
              )}
              <button type="button" onClick={startRecording}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-3">
                <span className="text-2xl">🎙️</span>
                <span>녹음 시작</span>
              </button>
              <p className="text-xs text-gray-500 text-center">버튼을 눌러 답변을 녹음하세요</p>
            </div>
          )}

          {turnState === "recording" && (
            <div className="space-y-3">
              {elapsed > 90 && (
                <p className={`text-xs text-center ${elapsed > 120 ? "text-red-400" : "text-yellow-400"}`}>
                  {elapsed > 120 ? "⚠ 2분 초과 — 답변을 마무리해주세요" : "💡 1분 30초 경과 — 곧 마무리해주세요"}
                </p>
              )}
              <button type="button" onClick={stopAndAnalyze}
                className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-3">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
                </span>
                <span>녹음 중… 눌러서 완료</span>
              </button>
              <p className="text-xs text-gray-500 text-center">버튼을 누르면 Gemini가 음성을 분석합니다</p>
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
