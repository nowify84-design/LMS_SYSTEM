import Link from "next/link";

export default function LMSHomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-nowify-bg">
      <nav className="bg-nowify-primary text-white shadow-sm">
        <div className="container mx-auto px-4 flex items-center justify-between h-14 gap-3">
          <img src="/images/logo_nowify.png" alt="Nowify" className="h-8 w-8 object-contain" />
          <span className="font-semibold">Learning Management System</span>
          <div className="flex gap-2">
            <Link href="/login" className="px-3 py-1.5 rounded border border-white/80 text-sm hover:bg-white/10 transition-colors">
              Login
            </Link>
            <Link href="/dashboard" className="px-3 py-1.5 rounded bg-white text-nowify-text text-sm font-medium hover:bg-gray-100 transition-colors">
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
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-nowify-border bg-nowify-card shadow-md overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-nowify-border font-semibold text-white bg-nowify-card-header rounded-t-2xl">
              My courses
            </div>
            <div className="p-4 flex-grow">
              <p className="text-nowify-muted text-sm mb-0">
                Your enrolled courses and progress are available in Nowify Dashboard after you sign in.
              </p>
              <a
                href="/login"
                className="inline-block mt-4 px-4 py-2.5 rounded-lg bg-nowify-primary text-white text-sm font-medium hover:bg-nowify-primary-dark transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary focus:ring-offset-2"
              >
                Sign in
              </a>
            </div>
          </div>
          <div className="rounded-2xl border border-nowify-border bg-nowify-card shadow-md overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-nowify-border font-semibold text-white bg-nowify-card-header rounded-t-2xl">
              Nowify Dashboard
            </div>
            <div className="p-4 flex-grow">
              <p className="text-nowify-muted text-sm mb-0">
                View your procrastination level, upcoming assignments and exams, task board, and calendar.
              </p>
              <a
                href="/dashboard"
                className="inline-block mt-4 px-4 py-2.5 rounded-lg border-2 border-nowify-primary text-nowify-primary text-sm font-medium hover:bg-nowify-primary hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary focus:ring-offset-2"
              >
                Open Dashboard
              </a>
            </div>
          </div>
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
