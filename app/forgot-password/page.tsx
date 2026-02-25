import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4 bg-nowify-bg">
      <div className="w-full max-w-md rounded-2xl border border-nowify-border bg-nowify-card shadow-lg p-8">
        <h1 className="text-xl font-semibold text-nowify-text mb-2">Forgot your password?</h1>
        <p className="text-nowify-muted text-sm mb-6">
          Contact your university IT support or administrator to reset your password.
        </p>
        <Link
          href="/login"
          className="text-nowify-primary hover:underline text-sm"
        >
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
