"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function PatternBg({ dark = false }: { dark?: boolean }) {
  const stroke = dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)";
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 0 20 L 40 20 M 20 0 L 20 40" stroke={stroke} strokeWidth="0.5" fill="none" />
          </pattern>
          <pattern id="tri" width="24" height="21" patternUnits="userSpaceOnUse">
            <polygon points="12,0 24,21 0,21" stroke={stroke} strokeWidth="0.5" fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <rect width="100%" height="100%" fill="url(#tri)" />
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [universityId, setUniversityId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universityId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }
      const me = await fetch("/api/auth/me");
      const meData = await me.json();
      if (meData.dataConsentAt) {
        router.push("/dashboard");
      } else {
        router.push("/consent");
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4 bg-nowify-bg">
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden border border-nowify-border bg-nowify-card shadow-lg flex flex-col sm:flex-row">
        {/* Left: welcome */}
        <div className="relative w-full sm:w-2/5 min-h-[200px] sm:min-h-[420px] bg-[var(--nowify-primary-dark)] text-white flex flex-col justify-between p-8">
          <PatternBg dark />
          <div className="relative">
            <img src="/images/logo_nowify.png" alt="Nowify" className="w-14 h-14 sm:w-16 sm:h-16 mb-4 object-contain" />
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">welcome back!</h1>
            <p className="mt-3 text-white/90 text-sm sm:text-base max-w-[220px]">
              login to your account in your Learning Management System
            </p>
          </div>
          <div className="relative h-24 sm:h-32" />
        </div>

        {/* Right: form */}
        <div className="relative w-full sm:w-3/5 min-h-[360px] flex flex-col justify-center p-8 sm:p-10 bg-nowify-form-panel">
          <PatternBg />
          <div className="relative">
            <h2 className="text-xl font-semibold text-nowify-text mb-6">
              login to your student account
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="username" className="block text-sm font-medium text-nowify-text mb-1">
                  Username:
                </label>
                <input
                  id="username"
                  type="text"
                  className="w-full rounded-lg border border-nowify-border bg-white px-3 py-2.5 text-nowify-text focus:border-nowify-primary focus:ring-1 focus:ring-nowify-primary focus:outline-none"
                  value={universityId}
                  onChange={(e) => setUniversityId(e.target.value)}
                  placeholder="University ID (e.g. 443254632)"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="password" className="block text-sm font-medium text-nowify-text mb-1">
                  Password:
                </label>
                <input
                  id="password"
                  type="password"
                  className="w-full rounded-lg border border-nowify-border bg-white px-3 py-2.5 text-nowify-text focus:border-nowify-primary focus:ring-1 focus:ring-nowify-primary focus:outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div
                  className="rounded-lg py-2 px-3 text-sm text-nowify-danger bg-nowify-danger/10 border border-nowify-danger/30 mb-4"
                  role="alert"
                >
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="w-full py-3 rounded-lg bg-nowify-primary text-white font-medium hover:bg-nowify-primary-dark disabled:opacity-60 transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary focus:ring-offset-2"
                disabled={loading}
              >
                {loading ? "Signing in…" : "Login"}
              </button>
            </form>
            <p className="mt-5 text-center">
              <Link
                href="/forgot-password"
                className="text-sm text-nowify-primary hover:underline"
              >
                Forgot your password?
              </Link>
            </p>
            <p className="mt-6 text-sm text-center text-nowify-muted">
              <Link href="/" className="text-nowify-primary hover:underline">
                ← Back to home
              </Link>
              </p>
          </div>
        </div>
        
      </div>
     
    </div>
  );
}
