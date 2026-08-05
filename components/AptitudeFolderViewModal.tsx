"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { AptitudeFolder, AptitudeNote } from "@/types/user";
import { loadNotes, saveFolders, saveNotes } from "@/lib/aptitude-store";
import AptitudeNoteAddModal from "./AptitudeNoteAddModal";

interface Props {
  rootFolder: AptitudeFolder;
  folders: AptitudeFolder[];
  notes: AptitudeNote[];
  apiKey?: string;
  geminiKey?: string;
  onFoldersChange: (folders: AptitudeFolder[]) => void;
  onNotesChange: (notes: AptitudeNote[]) => void;
  onClose: () => void;
}

export default function AptitudeFolderViewModal({
  rootFolder, folders, notes, apiKey, geminiKey, onFoldersChange, onNotesChange, onClose,
}: Props) {
  const [currentFolder, setCurrentFolder] = useState<AptitudeFolder>(rootFolder);
  const [detailNote, setDetailNote] = useState<AptitudeNote | null>(null);
  const [detailTab, setDetailTab] = useState<"claude" | "gemini">("claude");
  const [showAdd, setShowAdd] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [showNewSub, setShowNewSub] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const isRoot = !currentFolder.parentId;
  const subFolders = folders.filter((f) => f.parentId === currentFolder.id);
  const currentNotes = notes.filter((n) => n.folderId === currentFolder.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function handleBack() {
    setCurrentFolder(rootFolder);
    setDetailNote(null);
  }

  function handleCreateSub() {
    const name = newSubName.trim();
    if (!name) return;
    const sub: AptitudeFolder = {
      id: crypto.randomUUID(),
      name,
      parentId: currentFolder.id,
      createdAt: new Date().toISOString(),
    };
    const updated = [...folders, sub];
    saveFolders(updated);
    onFoldersChange(updated);
    setNewSubName("");
    setShowNewSub(false);
  }

  function handleDeleteSub(subId: string) {
    const updatedFolders = folders.filter((f) => f.id !== subId);
    const updatedNotes = notes.filter((n) => n.folderId !== subId);
    saveFolders(updatedFolders);
    saveNotes(updatedNotes);
    onFoldersChange(updatedFolders);
    onNotesChange(updatedNotes);
  }

  function handleDeleteNote(noteId: string) {
    const updated = notes.filter((n) => n.id !== noteId);
    saveNotes(updated);
    onNotesChange(updated);
    if (detailNote?.id === noteId) setDetailNote(null);
  }

  function saveTitle(noteId: string, title: string) {
    const updated = notes.map((n) =>
      n.id === noteId ? { ...n, title: title.trim() || undefined } : n
    );
    saveNotes(updated);
    onNotesChange(updated);
    if (detailNote?.id === noteId) setDetailNote((prev) => prev ? { ...prev, title: title.trim() || undefined } : prev);
    setEditingTitleId(null);
  }

  function getNoteLabel(note: AptitudeNote): string {
    if (note.title) return note.title;
    if (note.questionText) return note.questionText.slice(0, 40) + (note.questionText.length > 40 ? "…" : "");
    return "이미지 문제";
  }

  // 상세 뷰
  if (detailNote) {
    const tab = detailTab;
    const label = getNoteLabel(detailNote);
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            {/* 상세 뷰 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button type="button" onClick={() => setDetailNote(null)}
                  className="text-xs px-2 py-1 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-lg transition-colors shrink-0">
                  ← 목록
                </button>
                {editingTitleId === detailNote.id ? (
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveTitle(detailNote.id, draftTitle);
                      if (e.key === "Escape") setEditingTitleId(null);
                    }}
                    onBlur={() => saveTitle(detailNote.id, draftTitle)}
                    autoFocus
                    className="flex-1 px-2 py-1 border border-blue-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200 min-w-0"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditingTitleId(detailNote.id); setDraftTitle(detailNote.title ?? ""); }}
                    className="flex-1 text-left text-sm font-semibold text-gray-800 truncate hover:text-blue-600 transition-colors min-w-0"
                    title="클릭하여 제목 편집"
                  >
                    {label}
                    <span className="ml-1.5 text-gray-300 text-xs font-normal">✏️</span>
                  </button>
                )}
              </div>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl px-1 shrink-0">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* 전체 이미지 */}
              {detailNote.imageBase64 && (
                <div className="w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${detailNote.imageMimeType};base64,${detailNote.imageBase64}`}
                    alt="문제 이미지"
                    className="w-full max-h-80 object-contain rounded-xl border border-gray-100"
                  />
                </div>
              )}

              {/* 문제 텍스트 */}
              {detailNote.questionText && (
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-4">
                  {detailNote.questionText}
                </div>
              )}

              {/* 풀이 */}
              <div className="space-y-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setDetailTab("claude")}
                    className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${tab === "claude" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    🤖 Claude
                  </button>
                  {detailNote.geminiSolution && (
                    <button
                      type="button"
                      onClick={() => setDetailTab("gemini")}
                      className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${tab === "gemini" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >
                      ✨ Gemini
                    </button>
                  )}
                </div>
                <div className={`rounded-xl p-4 prose prose-sm prose-gray max-w-none ${tab === "claude" ? "bg-blue-50" : "bg-purple-50"}`}>
                  <ReactMarkdown>{tab === "claude" ? detailNote.claudeSolution : (detailNote.geminiSolution ?? "")}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showAdd && (
          <AptitudeNoteAddModal
            folders={folders}
            defaultFolderId={currentFolder.id}
            apiKey={apiKey}
            geminiKey={geminiKey}
            onSave={() => {}}
            onNotesChange={onNotesChange}
            onClose={() => setShowAdd(false)}
          />
        )}
      </>
    );
  }

  // 목록 뷰
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {!isRoot && (
                <button type="button" onClick={handleBack}
                  className="text-xs px-2 py-1 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-lg transition-colors shrink-0">
                  ← 뒤로
                </button>
              )}
              <div className="min-w-0">
                <h2 className="font-bold text-gray-800 text-base truncate">
                  {isRoot ? `📁 ${currentFolder.name}` : `📁 ${rootFolder.name} › ${currentFolder.name}`}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{currentNotes.length}개 문제</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isRoot && (
                <button type="button" onClick={() => setShowNewSub((v) => !v)}
                  className="text-xs px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-lg font-medium transition-colors">
                  + 하위 폴더
                </button>
              )}
              <button type="button" onClick={() => setShowAdd(true)}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                + 문제 추가
              </button>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl px-1">✕</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* 하위 폴더 생성 인라인 */}
            {showNewSub && isRoot && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateSub(); if (e.key === "Escape") setShowNewSub(false); }}
                  placeholder="하위 폴더명 예: 수열추리, 자료해석"
                  autoFocus
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button type="button" onClick={handleCreateSub}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium transition-colors">
                  만들기
                </button>
                <button type="button" onClick={() => setShowNewSub(false)}
                  className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs rounded-lg transition-colors">
                  취소
                </button>
              </div>
            )}

            {/* 하위 폴더 그리드 */}
            {isRoot && subFolders.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">하위 폴더</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {subFolders.map((sub) => {
                    const count = notes.filter((n) => n.folderId === sub.id).length;
                    return (
                      <div key={sub.id} className="group relative border border-gray-100 rounded-xl p-3 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                        <button
                          type="button"
                          onClick={() => { setCurrentFolder(sub); setDetailNote(null); }}
                          className="w-full text-left"
                        >
                          <p className="text-sm font-medium text-gray-700 truncate">📂 {sub.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{count}개 문제</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSub(sub.id)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-opacity"
                          title="삭제"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 노트 목록 */}
            {(currentNotes.length > 0 || !isRoot || subFolders.length === 0) && (
              <div className="space-y-3">
                {isRoot && subFolders.length > 0 && currentNotes.length > 0 && (
                  <p className="text-xs font-medium text-gray-500">이 폴더의 문제</p>
                )}
                {currentNotes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    아직 추가된 문제가 없어요.<br />
                    <span className="text-xs">+ 문제 추가 버튼을 눌러 시작하세요.</span>
                  </p>
                ) : (
                  currentNotes.map((note) => {
                    const label = getNoteLabel(note);
                    return (
                      <div key={note.id} className="relative group border border-gray-100 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          {/* 썸네일 */}
                          {note.imageBase64 && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`data:${note.imageMimeType};base64,${note.imageBase64}`}
                              alt="문제 이미지"
                              className="w-14 h-14 object-cover rounded-lg border border-gray-200 shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            {/* 제목 영역 */}
                            {editingTitleId === note.id ? (
                              <input
                                type="text"
                                value={draftTitle}
                                onChange={(e) => setDraftTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveTitle(note.id, draftTitle);
                                  if (e.key === "Escape") setEditingTitleId(null);
                                }}
                                onBlur={() => saveTitle(note.id, draftTitle)}
                                autoFocus
                                className="w-full px-2 py-1 border border-blue-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              />
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium text-gray-800 truncate">{label}</p>
                                <button
                                  type="button"
                                  onClick={() => { setEditingTitleId(note.id); setDraftTitle(note.title ?? ""); }}
                                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 text-xs transition-opacity shrink-0"
                                  title="제목 편집"
                                >
                                  ✏️
                                </button>
                              </div>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">{new Date(note.createdAt).toLocaleDateString("ko-KR")}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => { setDetailNote(note); setDetailTab("claude"); }}
                                className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors font-medium"
                              >
                                풀이 보기
                              </button>
                              {note.geminiSolution && (
                                <span className="text-xs text-purple-500">✨ Gemini 있음</span>
                              )}
                            </div>
                          </div>
                          {/* 삭제 */}
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-sm transition-opacity shrink-0"
                            title="삭제"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <AptitudeNoteAddModal
          folders={folders}
          defaultFolderId={currentFolder.id}
          apiKey={apiKey}
          geminiKey={geminiKey}
          onSave={() => {}}
          onNotesChange={onNotesChange}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  );
}
