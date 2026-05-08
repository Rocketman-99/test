import { UserProfile } from "@/types/user";

const STORAGE_KEY = "job-prep-profile";

export function saveProfile(profile: Partial<UserProfile>) {
  if (typeof window === "undefined") return;
  const existing = loadProfile();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...profile }));
}

export function loadProfile(): Partial<UserProfile> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
