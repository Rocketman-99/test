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
    try { return JSON.parse(raw); } catch { return {}; }
  }
  // migrate from legacy profile
  const legacy = loadLegacyProfile();
  if (legacy.basicInfo) {
    const spec: Partial<UserSpec> = {
      basicInfo: legacy.basicInfo,
      experienceRaw: legacy.experienceRaw,
      goals: legacy.goals,
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
