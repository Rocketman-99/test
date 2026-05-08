"use client";

import { useState } from "react";
import { ExperienceRaw } from "@/types/user";

interface Props {
  initialData: Partial<ExperienceRaw>;
  onNext: (data: ExperienceRaw) => void;
  onBack: () => void;
}

const PLACEHOLDER = `경험을 자유롭게 작성해주세요. 형식에 맞추지 않아도 됩니다.

예시)
- 2023년 여름방학에 스타트업 ABC에서 3개월 인턴했어요. 주로 React로 대시보드 만들었고, 사용자가 30% 늘었대요.
- 학교 동아리에서 앱 개발 팀장했고, 팀원 5명 이끌면서 졸업작품으로 중고거래 앱 만들었어요. 앱스토어 출시까지 했음.
- 공모전 나가서 데이터분석 대상 받은 적 있어요. 서울시 공공데이터로 버스 노선 최적화 분석했어요.
- 알바는 카페, 과외 등 했고 특별한 건 없는데 시간 관리 잘 하는 편이에요.`;

export default function Step2Experience({ initialData, onNext, onBack }: Props) {
  const [text, setText] = useState(initialData.text ?? "");
  const [error, setError] = useState("");

  function handleNext() {
    if (text.trim().length < 20) {
      setError("경험을 좀 더 자세히 작성해주세요. (최소 20자)");
      return;
    }
    setError("");
    onNext({ text });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">경험 작성</h2>
        <p className="text-sm text-gray-500">
          인턴, 프로젝트, 대외활동, 수상 등 모든 경험을 자유롭게 적어주세요.
          <br />
          AI가 이력서에 맞게 정리해드릴게요.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 space-y-1">
        <p className="font-semibold">작성 팁</p>
        <ul className="list-disc list-inside space-y-1 text-amber-700">
          <li>형식 없이 편하게 써도 돼요</li>
          <li>기간, 조직명, 역할, 성과가 포함되면 더 좋아요</li>
          <li>작은 경험도 빠뜨리지 말고 다 적어주세요</li>
        </ul>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">
          나의 경험 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          placeholder={PLACEHOLDER}
          rows={14}
          className={`w-full px-4 py-3 border rounded-lg text-sm leading-relaxed focus:outline-none focus:ring-2 transition-colors resize-none
            ${error ? "border-red-400 focus:ring-red-200" : "border-gray-300 focus:ring-blue-200 focus:border-blue-400"}`}
        />
        <div className="flex justify-between items-center">
          {error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : (
            <span />
          )}
          <p className="text-xs text-gray-400">{text.length}자</p>
        </div>
      </div>

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
          다음 단계 →
        </button>
      </div>
    </div>
  );
}
