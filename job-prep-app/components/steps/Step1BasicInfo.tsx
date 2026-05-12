"use client";

import { useState } from "react";
import { BasicInfo, LanguageScore } from "@/types/user";

interface Props {
  initialData: Partial<BasicInfo>;
  onNext: (data: BasicInfo) => void;
  submitLabel?: string;
}

const EMPTY_BASIC: BasicInfo = {
  name: "",
  email: "",
  phone: "",
  school: "",
  major: "",
  gpa: "",
  graduationStatus: "graduated",
  graduationYear: "",
  languageScores: [],
  certifications: [],
};

export default function Step1BasicInfo({ initialData, onNext, submitLabel = "다음 단계 →" }: Props) {
  const [form, setForm] = useState<BasicInfo>({ ...EMPTY_BASIC, ...initialData });
  const [certInput, setCertInput] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof BasicInfo, string>>>({});

  function set<K extends keyof BasicInfo>(key: K, value: BasicInfo[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function addLanguageScore() {
    set("languageScores", [...form.languageScores, { type: "", score: "" }]);
  }

  function updateLanguageScore(idx: number, field: keyof LanguageScore, value: string) {
    const updated = form.languageScores.map((s, i) =>
      i === idx ? { ...s, [field]: value } : s
    );
    set("languageScores", updated);
  }

  function removeLanguageScore(idx: number) {
    set("languageScores", form.languageScores.filter((_, i) => i !== idx));
  }

  function addCertification() {
    const trimmed = certInput.trim();
    if (!trimmed) return;
    set("certifications", [...form.certifications, trimmed]);
    setCertInput("");
  }

  function removeCertification(idx: number) {
    set("certifications", form.certifications.filter((_, i) => i !== idx));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof BasicInfo, string>> = {};
    if (!form.name.trim()) errs.name = "이름을 입력해주세요.";
    if (!form.email.trim()) errs.email = "이메일을 입력해주세요.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "올바른 이메일 형식이 아닙니다.";
    if (!form.phone.trim()) errs.phone = "연락처를 입력해주세요.";
    if (!form.school.trim()) errs.school = "학교를 입력해주세요.";
    if (!form.major.trim()) errs.major = "전공을 입력해주세요.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (validate()) onNext(form);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">기본 정보</h2>
        <p className="text-sm text-gray-500">이력서에 들어갈 기본 정보를 입력해주세요.</p>
      </div>

      {/* 개인 정보 */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b pb-1">개인 정보</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="이름" required error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="홍길동"
              className={inputCls(!!errors.name)}
            />
          </Field>
          <Field label="이메일" required error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="example@email.com"
              className={inputCls(!!errors.email)}
            />
          </Field>
          <Field label="연락처" required error={errors.phone}>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="010-0000-0000"
              className={inputCls(!!errors.phone)}
            />
          </Field>
        </div>
      </section>

      {/* 학력 */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b pb-1">학력</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="학교명" required error={errors.school}>
            <input
              type="text"
              value={form.school}
              onChange={(e) => set("school", e.target.value)}
              placeholder="OO대학교"
              className={inputCls(!!errors.school)}
            />
          </Field>
          <Field label="전공" required error={errors.major}>
            <input
              type="text"
              value={form.major}
              onChange={(e) => set("major", e.target.value)}
              placeholder="컴퓨터공학과"
              className={inputCls(!!errors.major)}
            />
          </Field>
          <Field label="학점 (선택)">
            <input
              type="text"
              value={form.gpa}
              onChange={(e) => set("gpa", e.target.value)}
              placeholder="3.8 / 4.5"
              className={inputCls(false)}
            />
          </Field>
          <Field label="졸업 연도 (선택)">
            <input
              type="text"
              value={form.graduationYear}
              onChange={(e) => set("graduationYear", e.target.value)}
              placeholder="2024"
              className={inputCls(false)}
            />
          </Field>
          <Field label="졸업 여부">
            <select
              value={form.graduationStatus}
              onChange={(e) => set("graduationStatus", e.target.value as BasicInfo["graduationStatus"])}
              className={inputCls(false)}
            >
              <option value="graduated">졸업</option>
              <option value="enrolled">재학 중</option>
              <option value="leave">휴학 중</option>
            </select>
          </Field>
        </div>
      </section>

      {/* 어학 성적 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b pb-1">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">어학 성적</h3>
          <button
            type="button"
            onClick={addLanguageScore}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + 추가
          </button>
        </div>
        {form.languageScores.length === 0 && (
          <p className="text-sm text-gray-400 py-2">어학 성적이 없으면 건너뛰어도 됩니다.</p>
        )}
        {form.languageScores.map((ls, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input
              type="text"
              value={ls.type}
              onChange={(e) => updateLanguageScore(idx, "type", e.target.value)}
              placeholder="TOEIC"
              className={`${inputCls(false)} flex-1`}
            />
            <input
              type="text"
              value={ls.score}
              onChange={(e) => updateLanguageScore(idx, "score", e.target.value)}
              placeholder="950"
              className={`${inputCls(false)} w-28`}
            />
            <button
              type="button"
              onClick={() => removeLanguageScore(idx)}
              className="text-gray-400 hover:text-red-500 text-lg leading-none px-1"
            >
              ×
            </button>
          </div>
        ))}
      </section>

      {/* 자격증 */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide border-b pb-1">자격증</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={certInput}
            onChange={(e) => setCertInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCertification()}
            placeholder="정보처리기사 (Enter로 추가)"
            className={`${inputCls(false)} flex-1`}
          />
          <button
            type="button"
            onClick={addCertification}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
          >
            추가
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {form.certifications.map((cert, idx) => (
            <span
              key={idx}
              className="flex items-center gap-1 bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full"
            >
              {cert}
              <button
                type="button"
                onClick={() => removeCertification(idx)}
                className="text-blue-400 hover:text-blue-700 leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <div className="flex justify-end pt-4">
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

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors
    ${hasError ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:ring-blue-200 focus:border-blue-400"}`;
}
