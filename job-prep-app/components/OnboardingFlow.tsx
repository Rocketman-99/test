"use client";

import { useState, useEffect } from "react";
import { UserProfile } from "@/types/user";
import { saveProfile, loadProfile } from "@/lib/store";
import StepIndicator from "./StepIndicator";
import Step1BasicInfo from "./steps/Step1BasicInfo";
import Step2Experience from "./steps/Step2Experience";
import Step3Goals from "./steps/Step3Goals";
import Step4JobPosting from "./steps/Step4JobPosting";

interface Props {
  onComplete: (profile: UserProfile) => void;
}

export default function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  function handleStep1(basicInfo: UserProfile["basicInfo"]) {
    const updated = { ...profile, basicInfo };
    setProfile(updated);
    saveProfile(updated);
    setStep(2);
  }

  function handleStep2(experienceRaw: UserProfile["experienceRaw"]) {
    const updated = { ...profile, experienceRaw };
    setProfile(updated);
    saveProfile(updated);
    setStep(3);
  }

  function handleStep3(goals: UserProfile["goals"]) {
    const updated = { ...profile, goals };
    setProfile(updated);
    saveProfile(updated);
    setStep(4);
  }

  function handleStep4(jobPosting: UserProfile["jobPosting"]) {
    const completed = { ...profile, jobPosting } as UserProfile;
    saveProfile(completed);
    onComplete(completed);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">취준 도우미</h1>
          <p className="text-sm text-gray-500 mt-1">맞춤형 이력서·자소서·면접 준비를 도와드릴게요.</p>
        </div>
        <StepIndicator currentStep={step} />
        {step === 1 && (
          <Step1BasicInfo initialData={profile.basicInfo ?? {}} onNext={handleStep1} />
        )}
        {step === 2 && (
          <Step2Experience
            initialData={profile.experienceRaw ?? {}}
            onNext={handleStep2}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3Goals
            initialData={profile.goals ?? {}}
            onNext={handleStep3}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && (
          <Step4JobPosting
            initialData={profile.jobPosting ?? {}}
            onSubmit={handleStep4}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  );
}
