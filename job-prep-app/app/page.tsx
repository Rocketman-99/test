"use client";

import { useState, useEffect } from "react";
import { UserProfile } from "@/types/user";
import { loadProfile } from "@/lib/store";
import OnboardingFlow from "@/components/OnboardingFlow";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = loadProfile();
    if (
      saved.basicInfo &&
      saved.experienceRaw &&
      saved.goals &&
      saved.jobPosting !== undefined
    ) {
      setProfile(saved as UserProfile);
    }
    setLoading(false);
  }, []);

  function handleReset() {
    localStorage.removeItem("job-prep-profile");
    setProfile(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-gray-400 text-sm">불러오는 중...</div>
      </div>
    );
  }

  if (profile) {
    return <Dashboard profile={profile} onReset={handleReset} />;
  }

  return <OnboardingFlow onComplete={setProfile} />;
}
