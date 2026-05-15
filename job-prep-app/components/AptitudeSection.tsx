"use client";

import { useState } from "react";
import type { AptitudeFolder, AptitudeNote } from "@/types/user";
import { loadFolders, saveFolders, loadNotes, saveNotes } from "@/lib/aptitude-store";
import AptitudeFolderViewModal from "./AptitudeFolderViewModal";

interface Props {
  folders: AptitudeFolder[];
  notes: AptitudeNote[];
  apiKey?: string;
  geminiKey?: string;
  onFoldersChange: (folders: AptitudeFolder[]) => void;
  onNotesChange: (notes: AptitudeNote[]) => void;
}

export default function AptitudeSection({ folders, notes, apiKey, geminiKey, onFoldersChange, onNotesChange }: Props) {
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [viewFolder, setViewFolder] = useState<AptitudeFolder | null>(null);

  const rootFolders = folders.filter((f) => !f.parentId);

  function totalNoteCountFor(folderId: string): number {
    const subIds = folders.filter((f) => f.parentId === folderId).map((f) => f.id);
    return notes.filter((n) => n.folderId === folderId || subIds.includes(n.folderId)).length;
  }

  function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const folder: AptitudeFolder = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    };
    const updated = [...folders, folder];
    saveFolders(updated);
    onFoldersChange(updated);
    setNewFolderName("");
    setShowNewFolder(false);
  }

  function handleDeleteFolder(id: string) {
    const subIds = folders.filter((f) => f.parentId === id).map((f) => f.id);
    const allDeleteIds = new Set([id, ...subIds]);
    const updatedFolders = folders.filter((f) => !allDeleteIds.has(f.id));
    const updatedNotes = notes.filter((n) => !allDeleteIds.has(n.folderId));
    saveFolders(updatedFolders);
    saveNotes(updatedNotes);
    onFoldersChange(updatedFolders);
    onNotesChange(updatedNotes);
    if (viewFolder && allDeleteIds.has(viewFolder.id)) setViewFolder(null);
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800">📋 인적성 오답노트</h2>
          <button
            type="button"
            onClick={() => setShowNewFolder((v) => !v)}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            + 폴더 만들기
          </button>
        </div>

        {showNewFolder && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setShowNewFolder(false); }}
              placeholder="예: SKCT, 삼성 GSAT"
              autoFocus
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button type="button" onClick={handleCreateFolder}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-medium transition-colors">
              만들기
            </button>
            <button type="button" onClick={() => setShowNewFolder(false)}
              className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs rounded-lg transition-colors">
              취소
            </button>
          </div>
        )}

        {rootFolders.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            아직 폴더가 없어요.<br />
            <span className="text-xs">기업 단위로 상위 폴더를 만들고, 안에 영역별 하위 폴더를 추가하세요.</span>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {rootFolders.map((folder) => {
              const count = totalNoteCountFor(folder.id);
              const subCount = folders.filter((f) => f.parentId === folder.id).length;
              const isEmpty = count === 0;
              return (
                <div key={folder.id} className={`group relative border rounded-xl p-3 transition-colors ${isEmpty ? "border-gray-100 bg-gray-50" : "border-blue-100 bg-blue-50"}`}>
                  <p className={`text-sm font-medium truncate ${isEmpty ? "text-gray-400" : "text-gray-800"}`}>{folder.name}</p>
                  <p className={`text-xs mt-0.5 ${isEmpty ? "text-gray-300" : "text-blue-500"}`}>
                    {subCount > 0 ? `${subCount}개 영역 · ` : ""}{count}개 문제
                  </p>
                  <div className="flex gap-1 mt-2">
                    <button
                      type="button"
                      onClick={() => setViewFolder(folder)}
                      className="flex-1 text-xs py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg transition-colors"
                    >
                      열기
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFolder(folder.id)}
                      className="text-xs px-2 py-1 text-gray-300 hover:text-red-400 border border-gray-200 hover:border-red-200 bg-white rounded-lg transition-colors"
                      title="폴더 삭제"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewFolder && (
        <AptitudeFolderViewModal
          rootFolder={viewFolder}
          folders={folders}
          notes={notes}
          apiKey={apiKey}
          geminiKey={geminiKey}
          onFoldersChange={onFoldersChange}
          onNotesChange={onNotesChange}
          onClose={() => setViewFolder(null)}
        />
      )}
    </>
  );
}
