import Anthropic from "@anthropic-ai/sdk";
import type { UserProfile } from "@/types/user";

export function getClient(apiKey?: string) {
  return new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
}

export function buildProfileContext(profile: UserProfile): string {
  const { basicInfo, experienceRaw, goals, jobPosting } = profile;

  const langScores =
    basicInfo.languageScores.length > 0
      ? basicInfo.languageScores.map((s) => `${s.type} ${s.score}`).join(", ")
      : "없음";
  const certs =
    basicInfo.certifications.length > 0
      ? basicInfo.certifications.join(", ")
      : "없음";

  const companySizeMap: Record<string, string> = {
    large: "대기업",
    startup: "스타트업",
    public: "공기업",
    any: "무관",
  };

  const stageMap: Record<string, string> = {
    early: "취준 초기",
    mid: "서류 준비 중",
    late: "면접 준비 중",
  };

  const weakMap: Record<string, string> = {
    resume: "이력서",
    cover_letter: "자기소개서",
    interview: "면접",
    portfolio: "포트폴리오",
    networking: "네트워킹",
  };

  const weakPoints =
    goals.weakPoints.length > 0
      ? goals.weakPoints.map((w) => weakMap[w] ?? w).join(", ")
      : "없음";

  const postingSection =
    jobPosting.url || jobPosting.text
      ? `채용 공고:\n${jobPosting.url ? `URL: ${jobPosting.url}\n` : ""}${jobPosting.text ? jobPosting.text : ""}`
      : "채용 공고: 미입력";

  return `[지원자 프로필]
이름: ${basicInfo.name}
이메일: ${basicInfo.email}
전화: ${basicInfo.phone}
학교/전공: ${basicInfo.school} ${basicInfo.major}
학점: ${basicInfo.gpa || "미입력"}
졸업 상태: ${basicInfo.graduationStatus} (${basicInfo.graduationYear || "미입력"})
어학: ${langScores}
자격증: ${certs}

[경험]
${experienceRaw.text}

[목표]
희망 직무: ${goals.targetRole}
희망 업종: ${goals.targetIndustry}
기업 규모: ${companySizeMap[goals.companySize] ?? goals.companySize}
준비 단계: ${stageMap[goals.preparationStage] ?? goals.preparationStage}
집중 영역: ${weakPoints}

${postingSection}`;
}
