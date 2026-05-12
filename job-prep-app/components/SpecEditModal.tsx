"use client";

import { useState } from "react";
import { UserSpec } from "@/types/user";
import { saveSpec } from "@/lib/store";
import Step1BasicInfo from "./steps/Step1BasicInfo";
import Step2Experience from "./steps/Step2Experience";
import Step3Goals from "./steps/Step3Goals";

interface Props {
  spec: UserSpec;
  onSave: (updated: UserSpec) => void;
  onClose: () => void;
}

const STEP_LABELS = ["기본 정보", "경험", "목표"];

export default function SpecEditModal({ spec, onSave, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<UserSpec>(spec);

  function handleStep1(basicInfo: UserSpec["basicInfo"]) {
    const updated = { ...draft, basicInfo };
    setDraft(updated);
    setStep(2);
  }

  function handleStep2(experienceRaw: UserSpec["experienceRaw"]) {
    const updated = { ...draft, experienceRaw };
    setDraft(updated);
    setStep(3);
  }

  function handleStep3(goals: UserSpec["goals"]) {
    const updated = { ...draft, goals };
    saveSpec(updated);
    onSave(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">내 스펙 편집</h2>
            <p className="text-xs text-gray-400 mt-0.5">{STEP_LABELS[step - 1]} 수정 중</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
          >
            ✕
          </button>
        </div>

        {/* 스텝 탭 */}
        <div className="flex border-b border-gray-100 px-6">
          {STEP_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i + 1)}
              className={`py-2.5 px-3 text-sm font-medium border-b-2 -mb-px transition-colors
                ${step === i + 1
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 1 && (
            <Step1BasicInfo
              initialData={draft.basicInfo}
              onNext={handleStep1}
              submitLabel="다음 →"
            />
          )}
          {step === 2 && (
            <Step2Experience
              initialData={draft.experienceRaw}
              onNext={handleStep2}
              onBack={() => setStep(1)}
              submitLabel="다음 →"
            />
          )}
          {step === 3 && (
            <Step3Goals
              initialData={draft.goals}
              onNext={handleStep3}
              onBack={() => setStep(2)}
              submitLabel="저장하기"
            />
          )}
        </div>
      </div>
    </div>
  );
}
