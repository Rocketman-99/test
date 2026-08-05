import { UserSpec, Application, UserProfile } from "@/types/user";

const SPEC_KEY = "job-prep-spec";
const APPS_KEY = "job-prep-applications";
const LEGACY_KEY = "job-prep-profile";

// ── Spec ──────────────────────────────────────────────────

export function saveSpec(spec: Partial<UserSpec>) {
  if (typeof window === "undefined") return;
  const existing = loadSpec();
  localStorage.setItem(SPEC_KEY, JSON.stringify({ ...existing, ...spec }));
}

export function loadSpec(): Partial<UserSpec> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(SPEC_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      // string → string[] 마이그레이션, 그리고 글자 배열(spread 오류) 정리
      if (parsed.goals) {
        if (typeof parsed.goals.targetRole === "string") {
          parsed.goals.targetRole = parsed.goals.targetRole ? [parsed.goals.targetRole] : [];
        }
        if (typeof parsed.goals.targetIndustry === "string") {
          parsed.goals.targetIndustry = parsed.goals.targetIndustry ? [parsed.goals.targetIndustry] : [];
        }
        // 글자 배열 제거 (예: ["프","론","트",...] → 유효한 선택지만 유지)
        if (Array.isArray(parsed.goals.targetRole)) {
          parsed.goals.targetRole = parsed.goals.targetRole.filter((v: string) => typeof v === "string" && v.length >= 2);
        }
        if (Array.isArray(parsed.goals.targetIndustry)) {
          parsed.goals.targetIndustry = parsed.goals.targetIndustry.filter((v: string) => typeof v === "string" && v.length >= 2);
        }
      }
      return parsed;
    } catch { return {}; }
  }
  // migrate from legacy profile
  const legacy = loadLegacyProfile();
  if (legacy.basicInfo) {
    const goals = legacy.goals;
    if (goals) {
      const g = goals as unknown as Record<string, unknown>;
      if (typeof g.targetRole === "string") {
        g.targetRole = g.targetRole ? [g.targetRole] : [];
      }
      if (typeof g.targetIndustry === "string") {
        g.targetIndustry = g.targetIndustry ? [g.targetIndustry] : [];
      }
    }
    const spec: Partial<UserSpec> = {
      basicInfo: legacy.basicInfo,
      experienceRaw: legacy.experienceRaw,
      goals: goals as UserSpec["goals"],
    };
    localStorage.setItem(SPEC_KEY, JSON.stringify(spec));
    return spec;
  }
  return {};
}

export function isSpecComplete(spec: Partial<UserSpec>): spec is UserSpec {
  return !!(spec.basicInfo && spec.experienceRaw && spec.goals);
}

// ── Applications ──────────────────────────────────────────

export function loadApplications(): Application[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(APPS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch { return []; }
  }
  // migrate: create first application from legacy job posting
  const legacy = loadLegacyProfile();
  if (legacy.jobPosting && (legacy.jobPosting.url || legacy.jobPosting.text)) {
    const apps: Application[] = [{
      id: crypto.randomUUID(),
      label: "첫 번째 공고",
      jobPosting: legacy.jobPosting,
      createdAt: new Date().toISOString(),
    }];
    localStorage.setItem(APPS_KEY, JSON.stringify(apps));
    return apps;
  }
  return [];
}

export function saveApplications(apps: Application[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(APPS_KEY, JSON.stringify(apps));
}

export function addApplication(app: Application) {
  const apps = loadApplications();
  saveApplications([...apps, app]);
}

export function deleteApplication(id: string) {
  const apps = loadApplications();
  saveApplications(apps.filter((a) => a.id !== id));
}

// ── Legacy (read-only) ────────────────────────────────────

function loadLegacyProfile(): Partial<UserProfile> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// ── Legacy shim (used by OnboardingFlow) ─────────────────

export function saveProfile(profile: Partial<UserProfile>) {
  if (typeof window === "undefined") return;
  const existing = loadLegacyProfile();
  localStorage.setItem(LEGACY_KEY, JSON.stringify({ ...existing, ...profile }));
}

export function loadProfile(): Partial<UserProfile> {
  return loadLegacyProfile();
}
