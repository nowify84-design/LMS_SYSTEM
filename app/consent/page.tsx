"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ConsentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.error && data.error === "Unauthorized") {
          router.push("/login");
          return;
        }
        if (data.dataConsentAt) {
          router.push("/dashboard");
          return;
        }
        setChecking(false);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  async function handleAllow() {
    setLoading(true);
    try {
      const res = await fetch("/api/consent", { method: "POST" });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDeny() {
    router.push("/lms");
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nowify-bg">
        <div className="w-8 h-8 border-2 border-nowify-primary border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4 bg-nowify-bg">
      <div className="w-full max-w-lg rounded-2xl border border-nowify-border bg-nowify-card shadow-lg p-8">
        <h2 className="text-xl font-semibold text-nowify-text mb-3">Data use permission</h2>
        <p className="text-nowify-muted mb-2">
          Do you allow Nowify to use your learning activity data to support and improve your academic progress?
        </p>
        <p className="text-sm text-nowify-muted mb-6">
          This helps provide accurate procrastination insights and personalized recommendations. You can change this later.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg bg-nowify-primary text-white font-medium hover:bg-nowify-primary-dark disabled:opacity-60 transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary focus:ring-offset-2"
            onClick={handleAllow}
            disabled={loading}
          >
            {loading ? "…" : "Allow"}
          </button>
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg border-2 border-nowify-border text-nowify-text font-medium hover:bg-nowify-bg transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary focus:ring-offset-2"
            onClick={handleDeny}
          >
            Deny
          </button>
        </div>
        <p className="mt-6 text-sm text-nowify-muted">
          <Link href="/dashboard" className="text-nowify-primary hover:underline">Skip to dashboard</Link>
          {" "}(some features may be limited without consent)
        </p>
      </div>
    </div>
  );
}
