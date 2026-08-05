"use client";

const STEPS = [
  { num: 1, label: "기본 정보" },
  { num: 2, label: "경험 작성" },
  { num: 3, label: "목표 설정" },
  { num: 4, label: "채용 공고" },
];

interface Props {
  currentStep: number;
}

export default function StepIndicator({ currentStep }: Props) {
  return (
    <div className="flex items-center justify-center mb-10">
      {STEPS.map((step, idx) => (
        <div key={step.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                ${currentStep === step.num ? "bg-blue-600 text-white" : ""}
                ${currentStep > step.num ? "bg-blue-200 text-blue-700" : ""}
                ${currentStep < step.num ? "bg-gray-100 text-gray-400" : ""}
              `}
            >
              {currentStep > step.num ? "✓" : step.num}
            </div>
            <span
              className={`mt-1 text-xs whitespace-nowrap ${
                currentStep === step.num ? "text-blue-600 font-semibold" : "text-gray-400"
              }`}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={`w-16 h-0.5 mx-1 mb-5 transition-colors ${
                currentStep > step.num ? "bg-blue-300" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
