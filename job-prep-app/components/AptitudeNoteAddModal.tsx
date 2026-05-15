"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { AptitudeFolder, AptitudeNote } from "@/types/user";
import { loadNotes, saveNotes } from "@/lib/aptitude-store";

interface Props {
  folders: AptitudeFolder[];
  defaultFolderId?: string;
  apiKey?: string;
  geminiKey?: string;
  onSave: (note: AptitudeNote) => void;
  onNotesChange: (notes: AptitudeNote[]) => void;
  onClose: () => void;
}

export default function AptitudeNoteAddModal({ folders, defaultFolderId, apiKey, geminiKey, onSave, onNotesChange, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [claudeSolution, setClaudeSolution] = useState("");
  const [geminiSolution, setGeminiSolution] = useState("");
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState(defaultFolderId ?? folders[0]?.id ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const claudeAbortRef = useRef<AbortController | null>(null);
  const geminiAbortRef = useRef<AbortController | null>(null);

  function applyImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, data] = dataUrl.split(",");
      const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
      setImageBase64(data);
      setImageMimeType(mime);
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) applyImageFile(file);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) applyImageFile(blob);
        return;
      }
    }
    // 이미지 없으면 기본 텍스트 붙여넣기 동작 유지
  }

  function clearImage() {
    setImageBase64(null);
    setImageMimeType(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSolveClaude() {
    if (!questionText.trim() && !imageBase64) return;
    claudeAbortRef.current?.abort();
    const controller = new AbortController();
    claudeAbortRef.current = controller;
    setClaudeLoading(true);
    setClaudeSolution("");
    try {
      const res = await fetch("/api/solve-aptitude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: questionText || undefined,
          imageBase64: imageBase64 || undefined,
          imageMimeType: imageMimeType || undefined,
          apiKey: apiKey || undefined,
        }),
        signal: controller.signal,
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setClaudeSolution(accumulated);
      }
    } catch {
      // aborted or error
    } finally {
      setClaudeLoading(false);
    }
  }

  async function handleSolveGemini() {
    if (!questionText.trim() && !imageBase64) return;
    geminiAbortRef.current?.abort();
    const controller = new AbortController();
    geminiAbortRef.current = controller;
    setGeminiLoading(true);
    setGeminiSolution("");
    try {
      const res = await fetch("/api/solve-aptitude-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: questionText || undefined,
          imageBase64: imageBase64 || undefined,
          imageMimeType: imageMimeType || undefined,
          geminiApiKey: geminiKey || undefined,
        }),
        signal: controller.signal,
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setGeminiSolution(accumulated);
      }
    } catch {
      // aborted or error
    } finally {
      setGeminiLoading(false);
    }
  }

  function handleSave() {
    if (!claudeSolution) return;
    const note: AptitudeNote = {
      id: crypto.randomUUID(),
      folderId: selectedFolderId,
      title: title.trim() || undefined,
      questionText: questionText.trim() || undefined,
      imageBase64: imageBase64 ?? undefined,
      imageMimeType: imageMimeType ?? undefined,
      claudeSolution,
      geminiSolution: geminiSolution || undefined,
      createdAt: new Date().toISOString(),
    };
    const existing = loadNotes();
    const updated = [...existing, note];
    saveNotes(updated);
    onNotesChange(updated);
    onSave(note);
    onClose();
  }

  // 폴더 선택 옵션: 루트 폴더 → 하위 폴더 순으로 계층 표시
  const rootFolders = folders.filter((f) => !f.parentId);
  const folderOptions = rootFolders.flatMap((root) => {
    const subs = folders.filter((f) => f.parentId === root.id);
    return [root, ...subs];
  });

  const canSolve = !!(questionText.trim() || imageBase64);
  const canSave = !!claudeSolution && !!selectedFolderId;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-800 text-base">📋 문제 추가</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl px-1">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* 제목 입력 */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">문제 제목 (선택)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 수열추리 3번, SKCT 2024 언어 Q12"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* 통합 입력창 */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">문제 입력</label>
            <div className="relative border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-transparent">
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                onPaste={handlePaste}
                placeholder="텍스트를 입력하거나 이미지를 붙여넣기 하세요 (Ctrl+V / Cmd+V)..."
                rows={5}
                className="w-full px-4 pt-3 pb-10 text-sm text-gray-900 focus:outline-none resize-none rounded-xl bg-transparent"
              />
              {/* 📷 버튼 — textarea 우하단 */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2.5 right-3 text-gray-400 hover:text-blue-500 transition-colors text-lg"
                title="이미지 파일 업로드"
              >
                📷
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          {/* 이미지 미리보기 */}
          {imagePreview && (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="문제 이미지" className="max-h-48 rounded-xl border border-gray-200 object-contain" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
              >
                ✕
              </button>
            </div>
          )}

          {/* Claude 풀이 버튼 */}
          <button
            type="button"
            onClick={handleSolveClaude}
            disabled={!canSolve || claudeLoading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {claudeLoading ? "Claude 풀이 중..." : "🤖 Claude로 풀기"}
          </button>

          {/* Claude 풀이 결과 */}
          {claudeSolution && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Claude 풀이</p>
              <div className="bg-blue-50 rounded-xl p-4 prose prose-sm prose-gray max-w-none max-h-60 overflow-y-auto">
                <ReactMarkdown>{claudeSolution}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Gemini 풀이 버튼 */}
          {claudeSolution && !claudeLoading && (
            <button
              type="button"
              onClick={handleSolveGemini}
              disabled={geminiLoading}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {geminiLoading ? "Gemini 풀이 중..." : "✨ Gemini로도 풀기"}
            </button>
          )}

          {/* Gemini 풀이 결과 */}
          {geminiSolution && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Gemini 풀이</p>
              <div className="bg-purple-50 rounded-xl p-4 prose prose-sm prose-gray max-w-none max-h-60 overflow-y-auto">
                <ReactMarkdown>{geminiSolution}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* 폴더 선택 — Claude 풀이 완료 후 표시 */}
          {claudeSolution && (
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">저장할 폴더</label>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {folderOptions.map((f) => {
                  const isSub = !!f.parentId;
                  return (
                    <option key={f.id} value={f.id}>
                      {isSub ? `  ㄴ ${f.name}` : f.name}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* 저장 버튼 */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-lg text-sm font-medium transition-colors">
            취소
          </button>
          <button type="button" onClick={handleSave} disabled={!canSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
