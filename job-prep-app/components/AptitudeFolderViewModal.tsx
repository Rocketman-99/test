"use client";

import { useState } from "react";
import type { AptitudeFolder, AptitudeNote } from "@/types/user";
import { loadNotes, saveNotes } from "@/lib/aptitude-store";
import AptitudeNoteAddModal from "./AptitudeNoteAddModal";

interface Props {
  folder: AptitudeFolder;
  folders: AptitudeFolder[];
  notes: AptitudeNote[];
  apiKey?: string;
  geminiKey?: string;
  onNotesChange: (notes: AptitudeNote[]) => void;
  onClose: () => void;
}

export default function AptitudeFolderViewModal({ folder, folders, notes, apiKey, geminiKey, onNotesChange, onClose }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, "claude" | "gemini">>({});
  const [showAdd, setShowAdd] = useState(false);

  const folderNotes = notes.filter((n) => n.folderId === folder.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function handleDelete(noteId: string) {
    const updated = notes.filter((n) => n.id !== noteId);
    saveNotes(updated);
    onNotesChange(updated);
    if (expandedId === noteId) setExpandedId(null);
  }

  function handleNoteAdded(note: AptitudeNote) {
    const all = loadNotes();
    onNotesChange(all);
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
            <div>
              <h2 className="font-bold text-gray-800 text-base">📁 {folder.name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{folderNotes.length}개 문제</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                + 문제 추가
              </button>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl px-1">✕</button>
            </div>
          </div>

          {/* 문제 목록 */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {folderNotes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                아직 추가된 문제가 없어요.<br />
                <span className="text-xs">+ 문제 추가 버튼을 눌러 시작하세요.</span>
              </p>
            ) : (
              folderNotes.map((note) => {
                const isExpanded = expandedId === note.id;
                const tab = getTab(note.id);
                return (
                  <div key={note.id} className="relative group border border-gray-100 rounded-xl overflow-hidden">
                    {/* 카드 헤더 */}
                    <div className="flex items-start gap-3 p-4">
                      {note.imageBase64 && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`data:${note.imageMimeType};base64,${note.imageBase64}`}
                          alt="문제 이미지"
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200 shrink-0"
                        />
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
                            <span className="text-xs text-purple-500">✨ Gemini 풀이 있음</span>
                          )}
                        </div>
                      </div>
                      {/* 삭제 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-sm transition-opacity shrink-0"
                        title="삭제"
                      >
                        ✕
                      </button>
                    </div>

                    {/* 확장 풀이 영역 */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 pb-4">
                        {/* 탭 */}
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
                        <div className={`rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed ${tab === "claude" ? "bg-blue-50" : "bg-purple-50"}`}>
                          {tab === "claude" ? note.claudeSolution : note.geminiSolution}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <AptitudeNoteAddModal
          folders={folders}
          defaultFolderId={folder.id}
          apiKey={apiKey}
          geminiKey={geminiKey}
          onSave={handleNoteAdded}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  );
}
