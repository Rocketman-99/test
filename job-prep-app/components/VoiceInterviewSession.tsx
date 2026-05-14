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

  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const [ttsRate, setTtsRate] = useState(1.3);
  const [ttsPitch, setTtsPitch] = useState(0.3);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const feedbackAbortRef = useRef<AbortController | null>(null);

  const profile = {
    ...spec,
    jobPosting: application?.jobPosting ?? { url: "", text: "" },
  };

  useEffect(() => {
    function loadVoices() {
      const voices = window.speechSynthesis.getVoices().filter(
        (v) => v.lang.startsWith("ko") || v.lang.startsWith("KO")
      );
      if (voices.length > 0) setAvailableVoices(voices);
    }
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis?.cancel();
      mediaRecorderRef.current?.stop();
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          spec,
          application,
          interviewType: settings.interviewType,
          difficulty: settings.difficulty,
          totalQuestions: settings.totalQuestions,
          coverLetter: settings.coverLetter || undefined,
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
    utterance.rate = ttsRate;
    utterance.pitch = ttsPitch;

    const allVoices = window.speechSynthesis.getVoices();
    const koVoices = allVoices.filter((v) => v.lang.startsWith("ko") || v.lang.startsWith("KO"));
    const chosen = koVoices.find((v) => v.name === selectedVoiceName) ?? koVoices[0] ?? null;
    if (chosen) utterance.voice = chosen;

    utterance.onend = onEnd;
    utterance.onerror = () => onEnd();
    window.speechSynthesis.speak(utterance);
  }

  function skipTTS() {
    window.speechSynthesis.cancel();
    setTurnState("recording_ready");
  }

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

  function updateLatestRecordFeedback(feedback: string) {
    if (typeof window === "undefined" || !application || !feedback) return;
    const key = `interview-history-${application.id}`;
    let existing: InterviewRecord[] = [];
    try { existing = JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { existing = []; }
    if (existing.length === 0) return;
    existing[0] = { ...existing[0], feedback };
    localStorage.setItem(key, JSON.stringify(existing));
  }

  async function loadFeedback(finalMessages: Message[]) {
    feedbackAbortRef.current?.abort();
    const controller = new AbortController();
    feedbackAbortRef.current = controller;
    setFeedbackLoading(true);
    setFeedbackContent("");
    setFeedbackVisible(true);
    let accumulated = "";
    try {
      const res = await fetch("/api/interview-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          profile,
          messages: finalMessages,
          settings,
          apiKey: apiKey || undefined,
        }),
      });
      if (!res.ok || !res.body) {
        setFeedbackContent("[오류] 피드백 생성에 실패했습니다.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        if (controller.signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setFeedbackContent(accumulated);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setFeedbackContent("[오류] 네트워크 오류가 발생했습니다.");
      }
    } finally {
      updateLatestRecordFeedback(accumulated);
      setFeedbackLoading(false);
    }
  }

  function stopFeedback() {
    feedbackAbortRef.current?.abort();
    setFeedbackLoading(false);
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
      sendToAI(newHistory, nextQ, questionBank);
    } catch {
      setAnalyzeError("음성 분석 중 오류가 발생했습니다.");
      setTurnState("recording_ready");
    }
  }

  const sendToAI = useCallback(async (history: Message[], qNum: number, bank: string) => {
    setTurnState("processing");
    setMessages((prev) => [...prev, { role: "ai", content: "" }]);

    const isLast = qNum > 0 && qNum > settings.totalQuestions;
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
        setMessages((prev) => prev.slice(0, -1)); // rollback empty AI bubble
        setAnalyzeError("서버 요청에 실패했습니다. 다시 녹음해주세요.");
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

      if (accumulated.startsWith("[오류]")) {
        setMessages((prev) => prev.slice(0, -1));
        setAnalyzeError(accumulated.replace("[오류] ", ""));
        setTurnState("recording_ready");
        return;
      }

      // Successful response — now increment counter
      setQuestionNumber(qNum);

      if (isLast) {
        setTurnState("finished");
        speakText(accumulated, () => {});
        const finalMessages = [...history, { role: "ai" as const, content: accumulated }];
        saveInterviewRecord(finalMessages);
      } else {
        setTurnState("ai_speaking");
        speakText(accumulated, () => setTurnState("recording_ready"));
      }
    } catch {
      setMessages((prev) => prev.slice(0, -1));
      setAnalyzeError("네트워크 오류가 발생했습니다. 다시 녹음해주세요.");
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
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-sm">🎙️ 음성 면접</span>
            {application && <span className="text-gray-400 text-xs">{application.label}</span>}
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">{typeLabel}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${settings.difficulty === "pressure" ? "bg-red-900 text-red-300" : "bg-green-900 text-green-300"}`}>
              {difficultyLabel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {turnState !== "finished" && <span className="text-gray-400 text-xs">{progress} / {settings.totalQuestions}</span>}
            {timerRunning && (
              <span className={`font-mono text-sm font-bold ${elapsed > 120 ? "text-red-400" : elapsed > 90 ? "text-yellow-400" : "text-green-400"}`}>
                {formatTime(elapsed)}
              </span>
            )}
            <button type="button" onClick={() => setShowVoiceSettings((v) => !v)}
              className={`text-xs px-2 py-1.5 border rounded-lg transition-colors ${showVoiceSettings ? "border-blue-500 text-blue-400" : "border-gray-700 text-gray-400 hover:text-white"}`}>
              🔊 음성 설정
            </button>
            <button type="button" onClick={onClose}
              className="text-gray-400 hover:text-white text-sm px-3 py-1.5 border border-gray-700 rounded-lg transition-colors">
              종료
            </button>
          </div>
        </div>

        {/* 음성 설정 패널 */}
        {showVoiceSettings && (
          <div className="px-6 py-3 border-t border-gray-800 bg-gray-900/80 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>속도</span>
                  <span className="font-mono">{ttsRate.toFixed(2)}x</span>
                </div>
                <input type="range" min={0.5} max={1.5} step={0.05} value={ttsRate}
                  onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer" />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>느림</span><span>보통</span><span>빠름</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>피치 (음높이)</span>
                  <span className="font-mono">{ttsPitch.toFixed(2)}</span>
                </div>
                <input type="range" min={0.3} max={2.0} step={0.05} value={ttsPitch}
                  onChange={(e) => setTtsPitch(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer" />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>낮음</span><span>보통</span><span>높음</span>
                </div>
              </div>
            </div>
            {availableVoices.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-400">음성 선택 <span className="text-gray-600">(브라우저/OS에 따라 다름)</span></p>
                <div className="flex flex-wrap gap-2">
                  {availableVoices.map((v) => (
                    <button key={v.name} type="button"
                      onClick={() => setSelectedVoiceName(v.name)}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors ${selectedVoiceName === v.name || (!selectedVoiceName && availableVoices[0]?.name === v.name) ? "border-blue-500 bg-blue-900/40 text-blue-300" : "border-gray-700 text-gray-400 hover:border-gray-500"}`}>
                      {v.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600">⚠ 브라우저 기본 한국어 음성은 대부분 여성입니다. Microsoft Edge나 Windows 사용 시 남성 음성이 추가로 제공될 수 있습니다.</p>
              </div>
            )}
          </div>
        )}
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
              {elapsed > 0 && (
                <p className="text-center font-mono text-2xl font-bold text-white">{formatTime(elapsed)}</p>
              )}
              {elapsed >= 30 && elapsed < 60 && (
                <p className="text-xs text-center text-yellow-400">💡 30초 경과</p>
              )}
              {elapsed >= 60 && elapsed < 90 && (
                <p className="text-xs text-center text-yellow-400">⏱ 1분 경과</p>
              )}
              {elapsed >= 90 && elapsed < 120 && (
                <p className="text-xs text-center text-yellow-400">💡 1분 30초 경과 — 곧 마무리해주세요</p>
              )}
              {elapsed >= 120 && (
                <p className="text-xs text-center text-red-400">⚠ 2분 초과 — 답변을 마무리해주세요</p>
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
              <p className="text-center font-mono text-2xl font-bold text-white">{formatTime(elapsed)}</p>
              {elapsed >= 30 && elapsed < 60 && (
                <p className="text-xs text-center text-yellow-400">💡 30초 경과</p>
              )}
              {elapsed >= 60 && elapsed < 90 && (
                <p className="text-xs text-center text-yellow-400">⏱ 1분 경과</p>
              )}
              {elapsed >= 90 && elapsed < 120 && (
                <p className="text-xs text-center text-yellow-400">💡 1분 30초 경과 — 곧 마무리해주세요</p>
              )}
              {elapsed >= 120 && (
                <p className="text-xs text-center text-red-400">⚠ 2분 초과 — 답변을 마무리해주세요</p>
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
            <div className="space-y-3">
              <p className="text-gray-400 text-sm text-center">면접이 종료됐습니다.</p>
              <div className="flex gap-2 justify-center">
                {!feedbackVisible && !feedbackLoading && (
                  <button
                    type="button"
                    onClick={() => loadFeedback(messages)}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-colors"
                  >
                    📊 피드백 보기
                  </button>
                )}
                {feedbackLoading && (
                  <button
                    type="button"
                    onClick={stopFeedback}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition-colors"
                  >
                    ■ 생성 중지
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
          )}

        </div>
      </div>
    </div>
  );
}
