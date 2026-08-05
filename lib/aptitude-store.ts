import type { AptitudeFolder, AptitudeNote } from "@/types/user";

const FOLDERS_KEY = "aptitude-folders";
const NOTES_KEY = "aptitude-notes";

export function loadFolders(): AptitudeFolder[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveFolders(folders: AptitudeFolder[]) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

export function loadNotes(): AptitudeNote[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveNotes(notes: AptitudeNote[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}
