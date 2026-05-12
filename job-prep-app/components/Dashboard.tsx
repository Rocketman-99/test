"use client";

import { useState, useCallback } from "react";
import { UserProfile } from "@/types/user";
import AiResultPanel from "./AiResultPanel";

interface Props {
  profile: UserProfile;
  onReset: () => void;
}

type FeatureKey = "organize" | "resume" | "cover-letter" | "interview";

const FEATURE_CONFIG: Record<
  FeatureKey,
  { icon: string; label: string; endpoint: string; description: string }
> = {
  organize: { icon: "🗂️", label: "경험 자동 정리", endpoint: "/api/organize-experience", description: "자유 입력 → 이력서 항목" },
  resume: { icon: "📝", label: "이력서 자동 생성", endpoint: "/api/generate-resume", description: "공고 맞춤 이력서" },
  "cover-letter": { icon: "✍️", label: "자소서 작성", endpoint: "/api/generate-cover-letter", description: "공고 최적화 자소서" },
  interview: { icon: "🎤", label: "면접 질문 생성", endpoint: "/api/interview-questions", description: "예상 질문 + 답변 가이드" },
};

export default function Dashboard({ profile, onReset }: Props) {
  const { basicInfo, experienceRaw, goals, jobPosting } = profile;

  const hasPosting = jobPosting.url || jobPosting.text;

  const [apiKey, setApiKey] = useState(
    () => (typeof window !== "undefined" ? localStorage.getItem("anthropic-api-key") ?? "" : "")
  );
  const [showKeyInput, setShowKeyInput] = useState(false);

  const [activeFeature, setActiveFeature] = useState<FeatureKey | null>(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function saveApiKey(key: string) {
    setApiKey(key);
    localStorage.setItem("anthropic-api-key", key);
  }

  const runFeature = useCallback(
    async (feature: FeatureKey) => {
      setActiveFeature(feature);
      setResult("");
      setCopied(false);
      setLoading(true);

      try {
        const res = await fetch(FEATURE_CONFIG[feature].endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, apiKey: apiKey || undefined }),
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
      } catch {
        setResult("[오류] 네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [profile, apiKey]
  );

  function handleCopy() {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                안녕하세요, {basicInfo.name}님!
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {goals.targetRole} · {goals.targetIndustry} 준비 중
              </p>
            </div>
            <span className="text-3xl">👋</span>
          </div>
        </div>

        {/* 요약 카드들 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SummaryCard title="기본 정보" icon="📋">
            <InfoRow label="학교" value={`${basicInfo.school} ${basicInfo.major}`} />
            <InfoRow label="이메일" value={basicInfo.email} />
            {basicInfo.languageScores.length > 0 && (
              <InfoRow
                label="어학"
                value={basicInfo.languageScores.map((s) => `${s.type} ${s.score}`).join(", ")}
              />
            )}
            {basicInfo.certifications.length > 0 && (
              <InfoRow label="자격증" value={basicInfo.certifications.join(", ")} />
            )}
          </SummaryCard>

          <SummaryCard title="목표" icon="🎯">
            <InfoRow label="희망 직무" value={goals.targetRole} />
            <InfoRow label="희망 업종" value={goals.targetIndustry} />
            <InfoRow
              label="기업 규모"
              value={
                { large: "대기업", startup: "스타트업", public: "공기업", any: "무관" }[
                  goals.companySize
                ]
              }
            />
            {goals.weakPoints.length > 0 && (
              <InfoRow label="집중 영역" value={goals.weakPoints.join(", ")} />
            )}
          </SummaryCard>

          <SummaryCard title="경험 요약" icon="💼">
            <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">
              {experienceRaw.text}
            </p>
          </SummaryCard>

          <SummaryCard title="채용 공고" icon="📄">
            {hasPosting ? (
              <>
                {jobPosting.url && (
                  <p className="text-sm text-blue-600 break-all line-clamp-2">{jobPosting.url}</p>
                )}
                {jobPosting.text && (
                  <p className="text-sm text-gray-600 line-clamp-4">{jobPosting.text}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">공고가 입력되지 않았어요.</p>
            )}
          </SummaryCard>
        </div>

        {/* API 키 설정 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🔑</span>
              <span className="text-sm font-semibold text-gray-700">Anthropic API 키</span>
              {apiKey && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  설정됨
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowKeyInput((v) => !v)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showKeyInput ? "닫기" : apiKey ? "변경" : "입력"}
            </button>
          </div>
          {showKeyInput && (
            <div className="mt-3 space-y-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => saveApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              />
              <p className="text-xs text-gray-400">
                키는 브라우저 로컬스토리지에만 저장되며 서버로 전송됩니다.
                서버에 ANTHROPIC_API_KEY 환경변수가 설정된 경우 생략 가능합니다.
              </p>
            </div>
          )}
        </div>

        {/* AI 기능 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
          <h2 className="font-bold text-gray-800">AI 기능</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.entries(FEATURE_CONFIG) as [FeatureKey, (typeof FEATURE_CONFIG)[FeatureKey]][]).map(
              ([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => runFeature(key)}
                  disabled={loading && activeFeature === key}
                  className="flex flex-col items-start gap-1.5 p-3 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-left rounded-xl border border-blue-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-700 leading-tight">{item.label}</p>
                    <p className="text-xs text-blue-500 mt-0.5">{item.description}</p>
                  </div>
                </button>
              )
            )}
          </div>
          {!apiKey && (
            <p className="text-xs text-amber-600">
              ⚠ API 키를 입력하거나 서버에 환경변수를 설정해야 AI 기능을 사용할 수 있습니다.
            </p>
          )}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={onReset}
            className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            처음부터 다시 입력하기
          </button>
        </div>
      </div>

      {activeFeature && (
        <AiResultPanel
          title={FEATURE_CONFIG[activeFeature].label}
          content={result}
          loading={loading}
          onClose={() => {
            if (!loading) setActiveFeature(null);
          }}
          onCopy={handleCopy}
          copied={copied}
        />
      )}
    </div>
  );
}

function SummaryCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-400 shrink-0 w-16">{label}</span>
      <span className="text-gray-700 break-all">{value}</span>
    </div>
  );
}
