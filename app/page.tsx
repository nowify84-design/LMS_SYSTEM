export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-nowify-bg">
      <div className="container mx-auto px-4 py-12 flex-grow flex flex-col justify-center max-w-2xl">
        <div className="rounded-lg bg-nowify-primary text-white text-center py-10 px-6 mb-8">
          <img src="/images/logo_nowify.png" alt="Nowify" className="mx-auto w-20 h-20 mb-3 object-contain" />
          <h1 className="text-3xl font-bold mb-2">Nowify</h1>
          <p className="text-lg opacity-95 mb-0">
            Intelligent system for studying the effect of procrastination on academic performance
          </p>
          <p className="mt-2 text-sm opacity-90">King Khalid University</p>
        </div>
        <div className="text-center">
          <p className="text-nowify-muted mb-6">
            Sign in with your university account to view your procrastination level and manage your tasks.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-nowify-primary text-white font-medium hover:bg-nowify-primary-dark transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary focus:ring-offset-2"
            >
              Login
            </a>
            <a
              href="/lms"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border-2 border-nowify-border text-nowify-text font-medium hover:bg-nowify-bg transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary focus:ring-offset-2"
            >
              LMS Home
            </a>
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
