"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST" }).then(() => {
      router.push("/");
      router.refresh();
    });
  }, [router]);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-nowify-bg">
      <div className="w-10 h-10 border-2 border-nowify-primary border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading" />
      <p className="text-sm text-nowify-muted">Signing out…</p>
    </div>
  );
}
