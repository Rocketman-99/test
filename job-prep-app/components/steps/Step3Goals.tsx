"use client";

import { useState } from "react";
import { Goals } from "@/types/user";

interface Props {
  initialData: Partial<Goals>;
  onNext: (data: Goals) => void;
  onBack: () => void;
  submitLabel?: string;
}

const ROLES = ["프론트엔드 개발", "백엔드 개발", "풀스택 개발", "데이터 분석", "AI/ML 엔지니어", "기획/PM", "마케터", "디자이너", "영업/MD", "경영/전략", "회계/재무", "HR", "기타"];
const INDUSTRIES = ["IT/소프트웨어", "금융/핀테크", "게임", "커머스/유통", "미디어/콘텐츠", "제조/반도체", "바이오/헬스케어", "공공/공기업", "컨설팅", "기타"];
const WEAK_POINTS = ["자소서 작성", "면접 답변", "직무 역량 정리", "스펙/포트폴리오", "취업 전략"];

const EMPTY_GOALS: Goals = {
  targetRole: "",
  targetIndustry: "",
  companySize: "any",
  preparationStage: "both",
  weakPoints: [],
};

export default function Step3Goals({ initialData, onNext, onBack, submitLabel = "다음 단계 →" }: Props) {
  const [form, setForm] = useState<Goals>({ ...EMPTY_GOALS, ...initialData });
  const [errors, setErrors] = useState<{ role?: string; industry?: string }>({});

  function toggleWeakPoint(point: string) {
    setForm((prev) => ({
      ...prev,
      weakPoints: prev.weakPoints.includes(point)
        ? prev.weakPoints.filter((p) => p !== point)
        : [...prev.weakPoints, point],
    }));
  }

  function validate() {
    const errs: { role?: string; industry?: string } = {};
    if (!form.targetRole) errs.role = "희망 직무를 선택해주세요.";
    if (!form.targetIndustry) errs.industry = "희망 업종을 선택해주세요.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (validate()) onNext(form);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">목표 설정</h2>
        <p className="text-sm text-gray-600">취업 목표를 알려주시면 맞춤형으로 도와드릴게요.</p>
      </div>

      {/* 희망 직무 */}
      <section className="space-y-2">
        <label className="text-sm font-medium text-gray-900">
          희망 직무 <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => {
                setForm((prev) => ({ ...prev, targetRole: role }));
                setErrors((prev) => ({ ...prev, role: undefined }));
              }}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors
                ${form.targetRole === role
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-gray-300 text-gray-800 hover:border-blue-400"
                }`}
            >
              {role}
            </button>
          ))}
        </div>
        {errors.role && <p className="text-xs text-red-500">{errors.role}</p>}
      </section>

      {/* 희망 업종 */}
      <section className="space-y-2">
        <label className="text-sm font-medium text-gray-900">
          희망 업종 <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map((ind) => (
            <button
              key={ind}
              type="button"
              onClick={() => {
                setForm((prev) => ({ ...prev, targetIndustry: ind }));
                setErrors((prev) => ({ ...prev, industry: undefined }));
              }}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors
                ${form.targetIndustry === ind
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-gray-300 text-gray-800 hover:border-blue-400"
                }`}
            >
              {ind}
            </button>
          ))}
        </div>
        {errors.industry && <p className="text-xs text-red-500">{errors.industry}</p>}
      </section>

      {/* 희망 기업 규모 */}
      <section className="space-y-2">
        <label className="text-sm font-medium text-gray-900">희망 기업 규모</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            { value: "large", label: "대기업" },
            { value: "startup", label: "스타트업" },
            { value: "public", label: "공기업/공공기관" },
            { value: "any", label: "무관" },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, companySize: value }))}
              className={`py-2.5 rounded-lg text-sm border transition-colors font-medium
                ${form.companySize === value
                  ? "bg-blue-50 border-blue-500 text-blue-700"
                  : "bg-white border-gray-200 text-gray-800 hover:border-gray-400"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* 준비 단계 */}
      <section className="space-y-2">
        <label className="text-sm font-medium text-gray-900">현재 준비 단계</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {([
            { value: "resume", label: "서류 준비 중", desc: "이력서·자소서 작성 집중" },
            { value: "interview", label: "면접 준비 중", desc: "면접 답변 코칭 집중" },
            { value: "both", label: "둘 다 필요", desc: "전반적인 취업 준비" },
          ] as const).map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, preparationStage: value }))}
              className={`p-3 rounded-lg text-left border transition-colors
                ${form.preparationStage === value
                  ? "bg-blue-50 border-blue-500"
                  : "bg-white border-gray-200 hover:border-gray-400"
                }`}
            >
              <p className={`text-sm font-medium ${form.preparationStage === value ? "text-blue-700" : "text-gray-800"}`}>
                {label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* 취약한 부분 */}
      <section className="space-y-2">
        <label className="text-sm font-medium text-gray-900">
          도움이 필요한 부분 <span className="text-gray-400 font-normal">(복수 선택 가능)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {WEAK_POINTS.map((point) => (
            <button
              key={point}
              type="button"
              onClick={() => toggleWeakPoint(point)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors
                ${form.weakPoints.includes(point)
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-gray-300 text-gray-800 hover:border-indigo-400"
                }`}
            >
              {point}
            </button>
          ))}
        </div>
      </section>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
        >
          ← 이전
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
