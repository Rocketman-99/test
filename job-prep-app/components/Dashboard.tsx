"use client";

import { useState, useCallback, useRef } from "react";
import { UserSpec, Application } from "@/types/user";
import { saveApplications } from "@/lib/store";
import AiResultPanel from "./AiResultPanel";
import SpecEditModal from "./SpecEditModal";
import AddApplicationModal from "./AddApplicationModal";
import InterviewSetupModal from "./InterviewSetupModal";
import InterviewSession from "./InterviewSession";
import VoiceInterviewSession from "./VoiceInterviewSession";
import type { InterviewSettings } from "@/app/api/interview-session/route";

interface Props {
  spec: UserSpec;
  applications: Application[];
  onSpecChange: (spec: UserSpec) => void;
  onApplicationsChange: (apps: Application[]) => void;
  onReset: () => void;
}

type DocFeature = "resume" | "cover-letter" | "interview";

const DOC_FEATURES: Record<DocFeature, { icon: string; label: string; endpoint: string }> = {
  resume: { icon: "📝", label: "이력서", endpoint: "/api/generate-resume" },
  "cover-letter": { icon: "✍️", label: "자소서", endpoint: "/api/generate-cover-letter" },
  interview: { icon: "🎤", label: "면접 질문", endpoint: "/api/interview-questions" },
};

export default function Dashboard({ spec, applications, onSpecChange, onApplicationsChange, onReset }: Props) {
  const { basicInfo, goals } = spec;

  const [apiKey, setApiKey] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem("anthropic-api-key") ?? "" : "")
  );
  const [geminiKey, setGeminiKey] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem("gemini-api-key") ?? "" : "")
  );
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [draftApiKey, setDraftApiKey] = useState(apiKey);
  const [draftGeminiKey, setDraftGeminiKey] = useState(geminiKey);
  const [keySaved, setKeySaved] = useState(false);
  const [showSpecEdit, setShowSpecEdit] = useState(false);
  const [addAppFor, setAddAppFor] = useState<Application | "new" | null>(null);
  const [interviewSetupFor, setInterviewSetupFor] = useState<Application | null>(null);
  const [interviewSession, setInterviewSession] = useState<{ app: Application | null; settings: InterviewSettings } | null>(null);

  // AI panel state
  const [panelTitle, setPanelTitle] = useState("");
  const [panelEndpoint, setPanelEndpoint] = useState("");
  const [panelApp, setPanelApp] = useState<Application | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verifyResult, setVerifyResult] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [activeFeatureKey, setActiveFeatureKey] = useState<DocFeature | "organize" | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function saveApiKey(key: string) {
    setApiKey(key);
    localStorage.setItem("anthropic-api-key", key);
  }

  function saveGeminiKey(key: string) {
    setGeminiKey(key);
    localStorage.setItem("gemini-api-key", key);
  }

  function handleSaveKeys() {
    saveApiKey(draftApiKey);
    saveGeminiKey(draftGeminiKey);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  }

  function handleDeleteApp(id: string) {
    const updated = applications.filter((a) => a.id !== id);
    saveApplications(updated);
    onApplicationsChange(updated);
  }

  function handleSaveApp(app: Application) {
    const exists = applications.find((a) => a.id === app.id);
    const updated = exists
      ? applications.map((a) => (a.id === app.id ? app : a))
      : [...applications, app];
    saveApplications(updated);
    onApplicationsChange(updated);
    setAddAppFor(null);
  }

  const openPanel = useCallback(
    (featureKey: DocFeature | "organize", title: string, endpoint: string, app: Application | null) => {
      setPanelTitle(title);
      setPanelEndpoint(endpoint);
      setPanelApp(app);
      setActiveFeatureKey(featureKey);
      setResult("");
      setVerifyResult("");
      setCopied(false);
    },
    []
  );

  function stopGenerate() {
    abortRef.current?.abort();
  }

  const runGenerate = useCallback(
    async (endpoint: string, app: Application | null) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setResult("");
      setLoading(true);

      const profileForAI = {
        ...spec,
        jobPosting: app?.jobPosting ?? { url: "", text: "" },
      };

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: profileForAI, apiKey: apiKey || undefined }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          setResult("[오류] 서버 요청에 실패했습니다.");
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
          setResult(accumulated);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setResult("[오류] 네트워크 오류가 발생했습니다.");
        }
      } finally {
        setLoading(false);
      }
    },
    [spec, apiKey]
  );

  const runVerify = useCallback(
    async (claudeOutput: string) => {
      setVerifyResult("");
      setVerifying(true);

      const profileForAI = {
        ...spec,
        jobPosting: panelApp?.jobPosting ?? { url: "", text: "" },
      };

      try {
        const res = await fetch("/api/verify-with-gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: profileForAI,
            claudeOutput,
            feature: activeFeatureKey,
            geminiApiKey: geminiKey || undefined,
          }),
        });

        if (!res.ok || !res.body) {
          setVerifyResult("[오류] Gemini 요청에 실패했습니다.");
          setVerifying(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setVerifyResult(accumulated);
        }
      } catch {
        setVerifyResult("[오류] 네트워크 오류가 발생했습니다.");
      } finally {
        setVerifying(false);
      }
    },
    [spec, panelApp, activeFeatureKey, geminiKey]
  );

  const [revising, setRevising] = useState(false);

  const runRevise = useCallback(
    async (instruction: string) => {
      setRevising(true);
      setResult("");
      setVerifyResult("");

      const profileForAI = {
        ...spec,
        jobPosting: panelApp?.jobPosting ?? { url: "", text: "" },
      };

      const featureLabel = panelTitle.replace(/\s*—.*$/, "").trim();

      try {
        const res = await fetch("/api/revise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile: profileForAI,
            originalContent: result,
            instruction,
            featureLabel,
            apiKey: apiKey || undefined,
          }),
        });

        if (!res.ok || !res.body) {
          setResult("[오류] 수정 요청에 실패했습니다.");
          setRevising(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setResult(accumulated);
        }
      } catch {
        setResult("[오류] 네트워크 오류가 발생했습니다.");
      } finally {
        setRevising(false);
      }
    },
    [spec, panelApp, panelTitle, result, apiKey]
  );

  const isPanelOpen = panelEndpoint !== "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 py-8">
      <div className="w-full max-w-2xl mx-auto space-y-4">

        {/* 헤더 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">안녕하세요, {basicInfo.name}님!</h1>
              <p className="text-sm text-gray-500 mt-1">{(Array.isArray(goals.targetRole) ? goals.targetRole : [goals.targetRole]).join(", ")} · {(Array.isArray(goals.targetIndustry) ? goals.targetIndustry : [goals.targetIndustry]).join(", ")} 준비 중</p>
            </div>
            <span className="text-3xl">👋</span>
          </div>
        </div>

        {/* 내 스펙 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800">내 스펙</h2>
            <button
              type="button"
              onClick={() => setShowSpecEdit(true)}
              className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            >
              편집
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SpecCard title="기본 정보" icon="📋">
              <InfoRow label="학교" value={`${basicInfo.school} ${basicInfo.major}`} />
              <InfoRow label="이메일" value={basicInfo.email} />
              {basicInfo.languageScores.length > 0 && (
                <InfoRow label="어학" value={basicInfo.languageScores.map((s) => `${s.type} ${s.score}`).join(", ")} />
              )}
              {basicInfo.certifications.length > 0 && (
                <InfoRow label="자격증" value={basicInfo.certifications.join(", ")} />
              )}
            </SpecCard>
            <SpecCard title="목표" icon="🎯">
              <InfoRow label="직무" value={(Array.isArray(goals.targetRole) ? goals.targetRole : [goals.targetRole]).join(", ")} />
              <InfoRow label="업종" value={(Array.isArray(goals.targetIndustry) ? goals.targetIndustry : [goals.targetIndustry]).join(", ")} />
              <InfoRow label="규모" value={{ large: "대기업", startup: "스타트업", public: "공기업", any: "무관" }[goals.companySize]} />
            </SpecCard>
            <SpecCard title="경험 요약" icon="💼">
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-4">{spec.experienceRaw.text}</p>
            </SpecCard>
          </div>

          {/* 경험 정리 버튼 */}
          <button
            type="button"
            onClick={() => {
              openPanel("organize", "경험 자동 정리", "/api/organize-experience", null);
              runGenerate("/api/organize-experience", null);
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors font-medium"
          >
            <span>🗂️</span> 경험 자동 정리
          </button>
        </div>

        {/* 지원 공고 목록 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800">지원 공고</h2>
            <button
              type="button"
              onClick={() => setAddAppFor("new")}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              + 공고 추가
            </button>
          </div>

          {applications.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              아직 추가된 공고가 없어요.<br />
              <span className="text-xs">공고를 추가하면 맞춤형 이력서·자소서를 생성할 수 있어요.</span>
            </p>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div key={app.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{app.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(app.createdAt).toLocaleDateString("ko-KR")}
                        {app.jobPosting.url && (
                          <span className="ml-2 text-blue-400 truncate max-w-[200px] inline-block align-bottom">
                            {app.jobPosting.url.replace(/^https?:\/\//, "").substring(0, 40)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAddAppFor(app)}
                        className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteApp(app.id)}
                        className="text-xs px-2 py-1 border border-red-100 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {/* AI 기능 버튼 */}
                  <div className="flex gap-2 flex-wrap">
                    {(Object.entries(DOC_FEATURES) as [DocFeature, typeof DOC_FEATURES[DocFeature]][]).map(
                      ([key, feat]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            openPanel(key, `${feat.label} — ${app.label}`, feat.endpoint, app);
                            runGenerate(feat.endpoint, app);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg transition-colors"
                        >
                          <span>{feat.icon}</span>{feat.label}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => setInterviewSetupFor(app)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-lg transition-colors"
                    >
                      <span>🎤</span>모의 면접
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API 키 설정 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>🔑</span>
              <span className="text-sm font-semibold text-gray-700">API 키 설정</span>
            </div>
            <button type="button" onClick={() => setShowKeyInput((v) => !v)} className="text-xs text-blue-600 hover:underline">
              {showKeyInput ? "닫기" : "설정"}
            </button>
          </div>
          <div className="flex gap-4 text-xs">
            <span className={apiKey ? "text-green-600" : "text-gray-400"}>{apiKey ? "✓" : "○"} Claude</span>
            <span className={geminiKey ? "text-green-600" : "text-gray-400"}>{geminiKey ? "✓" : "○"} Gemini</span>
          </div>
          {showKeyInput && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Anthropic API 키</label>
                <input type="password" value={draftApiKey} onChange={(e) => setDraftApiKey(e.target.value)} placeholder="sk-ant-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Gemini API 키 (교차검증용)</label>
                <input type="password" value={draftGeminiKey} onChange={(e) => setDraftGeminiKey(e.target.value)} placeholder="AIza..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveKeys}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  저장
                </button>
                {keySaved && <span className="text-sm text-green-600 font-medium">✓ 저장됨</span>}
              </div>
              <p className="text-xs text-gray-400">키는 브라우저 로컬스토리지에만 저장됩니다. 서버 환경변수(ANTHROPIC_API_KEY, GEMINI_API_KEY)가 있으면 생략 가능합니다.</p>
            </div>
          )}
        </div>

        <div className="text-center">
          <button type="button" onClick={onReset} className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2">
            처음부터 다시 입력하기
          </button>
        </div>
      </div>

      {/* 모의 면접 */}
      {interviewSetupFor && (
        <InterviewSetupModal
          applicationLabel={interviewSetupFor.label}
          onStart={(s) => {
            setInterviewSession({ app: interviewSetupFor, settings: s });
            setInterviewSetupFor(null);
          }}
          onClose={() => setInterviewSetupFor(null)}
        />
      )}
      {interviewSession && (
        interviewSession.settings.mode === "voice" ? (
          <VoiceInterviewSession
            spec={spec}
            application={interviewSession.app}
            settings={interviewSession.settings}
            apiKey={apiKey}
            geminiKey={geminiKey}
            onClose={() => setInterviewSession(null)}
          />
        ) : (
          <InterviewSession
            spec={spec}
            application={interviewSession.app}
            settings={interviewSession.settings}
            apiKey={apiKey}
            onClose={() => setInterviewSession(null)}
          />
        )
      )}

      {/* 모달들 */}
      {showSpecEdit && (
        <SpecEditModal
          spec={spec}
          onSave={(updated) => { onSpecChange(updated); setShowSpecEdit(false); }}
          onClose={() => setShowSpecEdit(false)}
        />
      )}
      {addAppFor !== null && (
        <AddApplicationModal
          initial={addAppFor === "new" ? undefined : addAppFor}
          onSave={handleSaveApp}
          onClose={() => setAddAppFor(null)}
        />
      )}
      {isPanelOpen && (
        <AiResultPanel
          title={panelTitle}
          content={result}
          loading={loading}
          onClose={() => {
            if (!loading && !revising && !verifying) {
              setPanelEndpoint("");
              setResult("");
              setVerifyResult("");
            }
          }}
          onStop={stopGenerate}
          onCopy={() => {
            navigator.clipboard.writeText(result).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          copied={copied}
          onRegenerate={() => runGenerate(panelEndpoint, panelApp)}
          onRevise={runRevise}
          revising={revising}
          onVerify={() => runVerify(result)}
          verifying={verifying}
          verifyResult={verifyResult}
          canVerify={!!geminiKey}
        />
      )}
    </div>
  );
}

function SpecCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-semibold text-gray-600">{title}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5 text-xs">
      <span className="text-gray-400 shrink-0 w-10">{label}</span>
      <span className="text-gray-600 break-all">{value}</span>
    </div>
  );
}
