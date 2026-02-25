import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DashboardSidebar from "./DashboardSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const studentId = await getSession();
  if (!studentId) {
    redirect("/login");
  }
  return (
    <div className="min-h-screen flex bg-nowify-bg">
      <div className="flex-shrink-0 py-4 pl-4">
        <DashboardSidebar />
      </div>
      <div className="flex flex-col flex-grow min-w-0">
        <main className="flex-grow p-6 md:p-8 max-w-5xl w-full mx-auto">{children}</main>
        <footer className="border-t border-nowify-border bg-nowify-card py-4 flex items-center justify-center gap-2 text-sm text-nowify-muted">
          <img src="/images/logo_nowify.png" alt="" className="w-5 h-5 object-contain" aria-hidden />
          <span>Nowify – Procrastination Monitor · King Khalid University</span>
        </footer>
      </div>
    </div>
  );
}
