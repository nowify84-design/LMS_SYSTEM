import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function StudentInfoPage() {
  const studentId = await getSession();
  if (!studentId) return null;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      name: true,
      universityId: true,
      email: true,
      major: true,
      degree: true,
      academicStatus: true,
      phone: true,
      campus: true,
    },
  });
  if (!student) return <p className="text-nowify-muted">Student not found.</p>;

  const displayName = student.name;
  const majorLower = student.major.toLowerCase();

  return (
    <div className="rounded-2xl border border-nowify-border bg-nowify-card shadow-md overflow-hidden">
      {/* Header bar */}
      <div className="bg-nowify-card-header text-white px-6 py-4 rounded-t-2xl">
        <h1 className="text-xl font-bold tracking-tight">student information</h1>
      </div>

      <div className="p-6 md:p-8">
        {/* Profile row: avatar + name + major */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex-shrink-0 w-20 h-20 rounded-full bg-nowify-avatar-bg flex items-center justify-center text-nowify-neutral">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-nowify-text">{displayName}</h2>
            <p className="text-nowify-muted text-sm mt-0.5">{majorLower}</p>
          </div>
        </div>

        {/* Student Information */}
        <section className="mb-6">
          <h3 className="text-lg font-bold text-nowify-text mb-3 pb-2 border-b border-nowify-border">Student Information</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-nowify-muted text-sm">Name:</dt>
              <dd className="font-medium text-nowify-text">{student.name}</dd>
            </div>
            <div>
              <dt className="text-nowify-muted text-sm">Id:</dt>
              <dd className="font-medium text-nowify-text">{student.universityId}</dd>
            </div>
            <div>
              <dt className="text-nowify-muted text-sm">Major:</dt>
              <dd className="font-medium text-nowify-text">{majorLower}</dd>
            </div>
            <div>
              <dt className="text-nowify-muted text-sm">Degree:</dt>
              <dd className="font-medium text-nowify-text">{student.degree}</dd>
            </div>
            <div>
              <dt className="text-nowify-muted text-sm">Status:</dt>
              <dd className="font-medium text-nowify-text">{student.academicStatus}</dd>
            </div>
            <div>
              <dt className="text-nowify-muted text-sm">Mobile:</dt>
              <dd className="font-medium text-nowify-text">{student.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-nowify-muted text-sm">Email:</dt>
              <dd className="font-medium text-nowify-text">{student.email}</dd>
            </div>
          </dl>
        </section>

        {/* Campus */}
        <section>
          <h3 className="text-lg font-bold text-nowify-text mb-3 pb-2 border-b border-nowify-border">Campus</h3>
          <p className="text-nowify-text">
            <span className="text-nowify-muted">Campus: </span>
            <span className="font-medium">{student.campus || "—"}</span>
          </p>
        </section>
      </div>
    </div>
  );
}
