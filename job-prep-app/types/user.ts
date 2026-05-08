export interface BasicInfo {
  name: string;
  email: string;
  phone: string;
  photo?: string;
  school: string;
  major: string;
  gpa: string;
  graduationStatus: "graduated" | "enrolled" | "leave";
  graduationYear: string;
  languageScores: LanguageScore[];
  certifications: string[];
}

export interface LanguageScore {
  type: string;
  score: string;
}

export interface ExperienceRaw {
  text: string;
}

export interface Goals {
  targetRole: string;
  targetIndustry: string;
  companySize: "large" | "startup" | "public" | "any";
  preparationStage: "resume" | "interview" | "both";
  weakPoints: string[];
}

export interface JobPosting {
  url: string;
  text: string;
}

export interface UserProfile {
  basicInfo: BasicInfo;
  experienceRaw: ExperienceRaw;
  goals: Goals;
  jobPosting: JobPosting;
}
