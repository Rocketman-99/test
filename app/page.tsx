"use client";

import { useState, useEffect } from "react";
import { UserSpec, Application } from "@/types/user";
import { loadSpec, isSpecComplete, loadApplications } from "@/lib/store";
import OnboardingFlow from "@/components/OnboardingFlow";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [spec, setSpec] = useState<UserSpec | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = loadSpec();
    if (isSpecComplete(saved)) {
      setSpec(saved);
      setApplications(loadApplications());
    }
    setLoading(false);
  }, []);

  function handleReset() {
    localStorage.removeItem("job-prep-spec");
    localStorage.removeItem("job-prep-applications");
    localStorage.removeItem("job-prep-profile");
    setSpec(null);
    setApplications([]);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-gray-400 text-sm">불러오는 중...</div>
      </div>
    );
  }

  if (spec) {
    return (
      <Dashboard
        spec={spec}
        applications={applications}
        onSpecChange={setSpec}
        onApplicationsChange={setApplications}
        onReset={handleReset}
      />
    );
  }

  return (
    <OnboardingFlow
      onComplete={(newSpec, firstApps) => {
        setSpec(newSpec);
        setApplications(firstApps);
      }}
    />
  );
}
