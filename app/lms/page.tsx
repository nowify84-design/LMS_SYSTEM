import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function LMSHomePage() {
  const studentId = await getSession();
  if (!studentId) {
    redirect("/login");
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { dataConsentAt: true },
  });

  const nowifyTarget = !student || !student.dataConsentAt ? "/consent" : "/dashboard";

  return (
    <div className="min-h-screen flex flex-col bg-nowify-bg">
      <nav className="bg-nowify-primary text-white shadow-sm">
        <div className="container mx-auto px-4 flex items-center justify-between h-14 gap-3">
          <img src="/images/logo_nowify.png" alt="Nowify" className="h-8 w-8 object-contain" />
          <span className="font-semibold">Learning Management System</span>
          <div className="flex gap-2">
            <Link href="/logout" className="px-3 py-1.5 rounded border border-white/80 text-sm hover:bg-white/10 transition-colors">
              Logout
            </Link>
            <Link href={nowifyTarget} className="px-3 py-1.5 rounded bg-white text-nowify-text text-sm font-medium hover:bg-gray-100 transition-colors">
              Nowify Dashboard
            </Link>
          </div>
        </div>
      </nav>
      <div className="container mx-auto px-4 py-8 flex-grow max-w-4xl">
        <h1 className="text-2xl font-semibold text-nowify-text border-b-2 border-nowify-primary pb-2 mb-6 inline-block">
          Welcome to the LMS
        </h1>
        <p className="text-nowify-muted mb-6">
          Learning Management System. Sign in and open <strong>Nowify Dashboard</strong> to monitor your procrastination level and manage tasks.
        </p>
        <div className="max-w-md">
          <Link
            href={nowifyTarget}
            className="block rounded-2xl border border-nowify-border bg-nowify-card shadow-md overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div className="px-4 py-3 border-b border-nowify-border font-semibold text-white bg-nowify-card-header rounded-t-2xl">
              Nowify
            </div>
            <div className="p-5 flex items-center gap-4">
              <img src="/images/logo_nowify.png" alt="Nowify Logo" className="h-10 w-10 object-contain" />
              <div>
                <p className="text-nowify-text font-semibold">Open Nowify Dashboard</p>
                <p className="text-nowify-muted text-sm">Click this card to continue to your dashboard.</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
      <footer className="mt-auto border-t border-nowify-border bg-nowify-card py-4 text-center text-sm text-nowify-muted">
        <div className="container mx-auto px-4">
          Nowify – Intelligent system for studying the effect of procrastination on academic performance · King Khalid University
        </div>
      </footer>
    </div>
  );
}
