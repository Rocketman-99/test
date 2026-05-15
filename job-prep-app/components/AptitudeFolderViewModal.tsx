"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { AptitudeFolder, AptitudeNote } from "@/types/user";
import { saveFolders, saveNotes } from "@/lib/aptitude-store";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, "claude" | "gemini">>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [showNewSub, setShowNewSub] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const isRoot = !currentFolder.parentId;
  const subFolders = folders.filter((f) => f.parentId === currentFolder.id);
  const currentNotes = notes.filter((n) => n.folderId === currentFolder.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function handleBack() {
    setCurrentFolder(rootFolder);
    setExpandedId(null);
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
    if (expandedId === noteId) setExpandedId(null);
  }

  function handleNoteSaved() {
    // notes are saved by the modal; parent re-reads from store via onNotesChange
  }

  function getTab(noteId: string): "claude" | "gemini" {
    return activeTab[noteId] ?? "claude";
  }

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
            {/* 하위 폴더 생성 인라인 입력 */}
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

            {/* 루트 폴더 뷰: 하위 폴더 그리드 */}
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
                          onClick={() => { setCurrentFolder(sub); setExpandedId(null); }}
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
                    const isExpanded = expandedId === note.id;
                    const tab = getTab(note.id);
                    return (
                      <div key={note.id} className="relative group border border-gray-100 rounded-xl overflow-hidden">
                        <div className="flex items-start gap-3 p-4">
                          {note.imageBase64 && (
                            <button
                              type="button"
                              onClick={() => setLightboxImage(`data:${note.imageMimeType};base64,${note.imageBase64}`)}
                              className="shrink-0"
                              title="이미지 전체 보기"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`data:${note.imageMimeType};base64,${note.imageBase64}`}
                                alt="문제 이미지"
                                className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity cursor-zoom-in"
                              />
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            {note.questionText && (
                              <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">{note.questionText}</p>
                            )}
                            {!note.questionText && !note.imageBase64 && (
                              <p className="text-sm text-gray-400 italic">내용 없음</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">{new Date(note.createdAt).toLocaleDateString("ko-KR")}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : note.id)}
                                className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors font-medium"
                              >
                                {isExpanded ? "풀이 닫기" : "풀이 보기"}
                              </button>
                              {note.geminiSolution && (
                                <span className="text-xs text-purple-500">✨ Gemini 있음</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-sm transition-opacity shrink-0"
                            title="삭제"
                          >
                            ✕
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-gray-100 px-4 pb-4">
                            <div className="flex gap-1 pt-3 pb-2">
                              <button
                                type="button"
                                onClick={() => setActiveTab((prev) => ({ ...prev, [note.id]: "claude" }))}
                                className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${tab === "claude" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                              >
                                🤖 Claude
                              </button>
                              {note.geminiSolution && (
                                <button
                                  type="button"
                                  onClick={() => setActiveTab((prev) => ({ ...prev, [note.id]: "gemini" }))}
                                  className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${tab === "gemini" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                                >
                                  ✨ Gemini
                                </button>
                              )}
                            </div>
                            <div className={`rounded-xl p-3 prose prose-sm prose-gray max-w-none ${tab === "claude" ? "bg-blue-50" : "bg-purple-50"}`}>
                              <ReactMarkdown>{tab === "claude" ? note.claudeSolution : (note.geminiSolution ?? "")}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxImage}
            alt="문제 이미지 전체"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {showAdd && (
        <AptitudeNoteAddModal
          folders={folders}
          defaultFolderId={currentFolder.id}
          apiKey={apiKey}
          geminiKey={geminiKey}
          onSave={handleNoteSaved}
          onNotesChange={onNotesChange}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  );
}
