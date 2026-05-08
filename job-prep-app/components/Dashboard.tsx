"use client";

import { UserProfile } from "@/types/user";

interface Props {
  profile: UserProfile;
  onReset: () => void;
}

export default function Dashboard({ profile, onReset }: Props) {
  const { basicInfo, experienceRaw, goals, jobPosting } = profile;

  const hasPosting = jobPosting.url || jobPosting.text;

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
              value={{ large: "대기업", startup: "스타트업", public: "공기업", any: "무관" }[goals.companySize]}
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

        {/* AI 기능 예고 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
          <h2 className="font-bold text-gray-800">다음 단계</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: "📝", label: "이력서 자동 생성", ready: false },
              { icon: "✍️", label: "자소서 작성", ready: false },
              { icon: "🎤", label: "면접 질문 생성", ready: false },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200"
              >
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400">AI 연동 준비 중</p>
                </div>
              </div>
            ))}
          </div>
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
