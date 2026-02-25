import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildFeatureVector, featureVectorToPayload, type FeatureVector } from "@/lib/featureVector";
import { getMessageLines, type PredictionLevel } from "@/lib/messageRules";

const FLASK_API_URL = process.env.FLASK_API_URL || "http://127.0.0.1:5000";

function fallbackRiskScore(v: FeatureVector): number {
  return (
    (1 - v.early_login_consistency) * 0.4 +
    v.late_registration_score * 0.35 +
    v.workload_level * 0.25
  );
}

async function getDashboardData(studentId: number) {
  const [student, courses, assignments, exams, tasks] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId } }),
    prisma.course.findMany({
      where: { studentId },
      include: { assignments: true, exams: true },
    }),
    prisma.assignment.findMany({
      where: { course: { studentId } },
      include: { course: { select: { courseName: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.exam.findMany({
      where: { course: { studentId } },
      include: { course: { select: { courseName: true } } },
      orderBy: { examDate: "asc" },
    }),
    prisma.task.findMany({
      where: { studentId },
      include: { course: { select: { courseName: true } } },
      orderBy: { endDate: "asc" },
    }),
  ]);

  const featureVector = await buildFeatureVector(prisma, studentId);
  const predictPayload = featureVectorToPayload(featureVector);
  let level: PredictionLevel = "Low";
  let percentage = 15;
  try {
    const res = await fetch(`${FLASK_API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(predictPayload),
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      level = data.level ?? level;
      percentage = typeof data.percentage === "number" ? data.percentage : percentage;
    } else {
      const score = fallbackRiskScore(featureVector);
      percentage = Math.round(Math.min(100, Math.max(0, score * 100)));
      if (percentage >= 60) level = "High";
      else if (percentage >= 30) level = "Medium";
    }
  } catch {
    const score = fallbackRiskScore(featureVector);
    percentage = Math.round(Math.min(100, Math.max(0, score * 100)));
    if (percentage >= 60) level = "High";
    else if (percentage >= 30) level = "Medium";
  }

  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  type UpcomingItem = { type: "assignment" | "exam" | "task"; title: string; due: Date; course: string | null };
  const upcoming: UpcomingItem[] = [
    ...assignments
      .filter((a: (typeof assignments)[0]) => a.status === "Pending" && a.dueDate >= now && a.dueDate <= in14Days)
      .map((a: (typeof assignments)[0]) => ({ type: "assignment" as const, title: a.assignmentTitle, due: a.dueDate, course: a.course.courseName })),
    ...exams
      .filter((e: (typeof exams)[0]) => e.status === "Pending" && e.examDate >= now && e.examDate <= in14Days)
      .map((e: (typeof exams)[0]) => ({ type: "exam" as const, title: e.examTitle, due: e.examDate, course: e.course.courseName })),
    ...tasks
      .filter((t: (typeof tasks)[0]) => ["To-Do", "In Progress"].includes(t.status) && t.endDate >= now && t.endDate <= in14Days)
      .map((t: (typeof tasks)[0]) => ({ type: "task" as const, title: t.taskTitle, due: t.endDate, course: t.course?.courseName ?? null })),
  ].sort((a, b) => a.due.getTime() - b.due.getTime());

  // Progress by course: count completed vs total from actual assignments + exams (not cached Course columns)
  const coursesWithProgress = courses.map((c: (typeof courses)[0]) => {
    const total = c.assignments.length + c.exams.length;
    const completed =
      c.assignments.filter((a: { status: string }) => a.status === "Completed").length +
      c.exams.filter((e: { status: string }) => e.status === "Completed").length;
    return { courseName: c.courseName, progress_pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  });

  const dueDatesSet = new Set(upcoming.map((u) => u.due.getDate()));

  return {
    student,
    level,
    percentage,
    messageLines: getMessageLines(level),
    coursesWithProgress,
    upcoming: upcoming.slice(0, 10),
    dueDatesSet,
  };
}

function formatDue(d: Date): { text: string; urgent: boolean } {
  const now = new Date();
  const hours = (d.getTime() - now.getTime()) / (60 * 60 * 1000);
  const days = Math.floor(hours / 24);
  if (hours <= 0) return { text: "Due today", urgent: true };
  if (hours <= 24) return { text: "24 hours remaining.", urgent: true };
  if (hours <= 48) return { text: "48 hours remaining.", urgent: false };
  if (days <= 3) return { text: `${days} days remaining`, urgent: false };
  if (days <= 7) return { text: `${days} days left`, urgent: false };
  return { text: `due in ${days} days`, urgent: false };
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function MiniCalendar({ dueDatesSet }: { dueDatesSet: Set<number> }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) week.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="p-4">
      <p className="text-center text-sm font-semibold text-nowify-text mb-3" aria-live="polite">
        {MONTH_NAMES[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
        {weekDays.map((w) => (
          <div key={w} className="font-medium text-nowify-muted py-1">
            {w}
          </div>
        ))}
        {weeks.flat().map((d, i) =>
          d === null ? (
            <div key={`e-${i}`} className="py-2" />
          ) : (
            <div key={d} className="relative py-2">
              <span
                className={
                  dueDatesSet.has(d)
                    ? "font-semibold text-nowify-primary"
                    : d === today
                      ? "font-bold text-nowify-primary bg-nowify-primary/10 rounded-full w-7 h-7 inline-flex items-center justify-center"
                      : "text-nowify-text"
                }
              >
                {d}
              </span>
              {dueDatesSet.has(d) && d !== today && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-nowify-danger text-[8px]" aria-hidden>
                  ◆
                </span>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

const COURSE_ICONS: Record<string, string> = {
  "Artificial Intelligence": "brain",
  "Database Systems": "database",
  "Software Engineering": "code",
  "Computer Networks": "globe",
  "Systems Rules Management": "server",
  "Data Structures": "layers",
  "Operating Systems": "cpu",
  "Web Technologies": "globe",
  "Communication skills": "message",
  "mathematics": "calculator",
  "chemistry": "flask",
};

function CourseIcon({ name }: { name: string }) {
  const key = Object.keys(COURSE_ICONS).find((k) => name.toLowerCase().includes(k.toLowerCase())) ?? "default";
  const icon = COURSE_ICONS[key] || "book";
  const size = "w-10 h-10";
  const stroke = "currentColor";
  const cls = `${size} text-nowify-neutral`;
  if (icon === "brain") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <path d="M12 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
        <path d="M9 14c-1.5 1-2.5 2.5-2.5 4.5 0 2 2 3.5 4 3.5s4-1.5 4-3.5c0-2-1-3.5-2.5-4.5" />
      </svg>
    );
  }
  if (icon === "calculator") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="16" y2="14" />
        <line x1="8" y1="18" x2="16" y2="18" />
      </svg>
    );
  }
  if (icon === "database") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      </svg>
    );
  }
  if (icon === "globe") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
  if (icon === "server") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    );
  }
  if (icon === "code") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  }
  if (icon === "cpu") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="1" x2="9" y2="4" />
        <line x1="15" y1="1" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="23" />
        <line x1="15" y1="20" x2="15" y2="23" />
        <line x1="20" y1="9" x2="23" y2="9" />
        <line x1="20" y1="14" x2="23" y2="14" />
        <line x1="1" y1="9" x2="4" y2="9" />
        <line x1="1" y1="14" x2="4" y2="14" />
      </svg>
    );
  }
  if (icon === "message") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  if (icon === "flask") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <path d="M9 2v6l-4 8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2l-4-8V2" />
        <line x1="9" y1="2" x2="15" y2="2" />
      </svg>
    );
  }
  if (icon === "layers") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export default async function DashboardPage() {
  const studentId = await getSession();
  if (!studentId) return null;
  const data = await getDashboardData(studentId);
  if (!data.student) return <p className="text-nowify-muted">Student not found.</p>;

  const student = data.student;
  const majorLower = student.major.toLowerCase();

  return (
    <div className="space-y-6">
      {/* Top row: 3 cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Profile + Procrastination */}
        <div className="rounded-2xl border border-nowify-border bg-nowify-card shadow-md overflow-hidden p-6">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-nowify-avatar-bg flex items-center justify-center text-nowify-neutral">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-nowify-text">{student.name}</h2>
              <p className="text-nowify-muted text-sm">{majorLower}</p>
            </div>
          </div>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <span
                className={`text-sm font-medium ${
                  data.level === "Medium"
                    ? "text-nowify-warning"
                    : data.level === "High"
                      ? "text-nowify-danger"
                      : "text-nowify-text"
                }`}
              >
                Procrastination Level ({data.level})
              </span>
              <span
                className={`text-sm font-bold ${
                  data.level === "Medium"
                    ? "text-nowify-warning"
                    : data.level === "High"
                      ? "text-nowify-danger"
                      : "text-nowify-text"
                }`}
              >
                %{data.percentage}
              </span>
            </div>
            <div
              className="h-2.5 bg-nowify-avatar-bg rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={data.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Procrastination level ${data.percentage} percent`}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  data.level === "Medium"
                    ? "bg-nowify-warning"
                    : data.level === "High"
                      ? "bg-nowify-danger"
                      : "bg-nowify-primary"
                }`}
                style={{ width: `${data.percentage}%` }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-nowify-text bg-nowify-message-bg rounded-lg px-3 py-2">
              {data.messageLines[0]}
            </p>
            {data.messageLines[1] && (
              <p className="text-sm text-nowify-text bg-nowify-primary/15 rounded-lg px-3 py-2 font-medium">
                {data.messageLines[1]}
              </p>
            )}
          </div>
        </div>

        {/* Middle: Quote + Calendar */}
        <div className="rounded-2xl border border-nowify-border bg-nowify-card shadow-md overflow-hidden">
          <div className="bg-nowify-neutral text-white px-4 py-3 text-center">
            <p className="text-sm font-bold leading-snug">
              Progress doesn&apos;t have to be perfect just start now!
            </p>
          </div>
          <MiniCalendar dueDatesSet={data.dueDatesSet} />
        </div>

        {/* Right: Upcoming tasks (pink/purple tint) */}
        <div className="rounded-2xl border border-nowify-border bg-nowify-upcoming-bg shadow-md overflow-hidden">
          <div className="px-5 py-4 border-b border-nowify-border/50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-nowify-text">Upcoming tasks</h3>
            {data.upcoming.length > 0 && (
              <Link href="/dashboard/calendar" className="text-xs text-nowify-primary hover:underline">Calendar</Link>
            )}
          </div>
          <ul className="divide-y divide-nowify-border/50 max-h-[340px] overflow-y-auto">
            {data.upcoming.length === 0 ? (
              <li className="px-5 py-6 text-center">
                <p className="text-nowify-muted text-sm mb-2">No upcoming items in the next 14 days.</p>
                <Link href="/dashboard/tasks" className="text-sm text-nowify-primary hover:underline">View task board</Link>
                <span className="text-nowify-muted mx-1">·</span>
                <Link href="/dashboard/calendar" className="text-sm text-nowify-primary hover:underline">Calendar</Link>
              </li>
            ) : (
              data.upcoming.map((u, i) => {
                const { text, urgent } = formatDue(u.due);
                const typeLabel = u.type === "assignment" ? "Assignment" : u.type === "exam" ? "Exam" : "Task";
                return (
                  <li key={i} className="px-5 py-3">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-nowify-muted">{typeLabel}</span>
                    {u.course && <span className="text-[10px] text-nowify-muted ml-1">· {u.course}</span>}
                    <p className="text-sm font-medium text-nowify-text mt-0.5">{u.title}</p>
                    <p className={`text-xs mt-0.5 ${urgent ? "text-nowify-danger" : "text-nowify-muted"}`}>
                      {text}
                    </p>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      {/* Bottom: Course progress cards 2x3 */}
      <div>
        <h3 className="text-lg font-bold text-nowify-text mb-4">Progress by course</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.coursesWithProgress.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-nowify-border bg-nowify-bg/50 py-8 text-center">
              <p className="text-nowify-muted text-sm mb-2">No courses yet.</p>
              <p className="text-xs text-nowify-muted">Courses and progress appear when you have enrolled courses in the system.</p>
            </div>
          ) : (
            data.coursesWithProgress.map((c: { courseName: string; progress_pct: number }, i: number) => (
              <div
                key={i}
                className="rounded-2xl border border-nowify-border bg-nowify-card shadow-md p-5 flex flex-col items-center text-center"
              >
                <div className="mb-3">
                  <CourseIcon name={c.courseName} />
                </div>
                <p className="text-sm font-medium text-nowify-text mb-2 capitalize">
                  {c.courseName.toLowerCase()}
                </p>
                <p className="text-xs text-nowify-muted mb-1 w-full text-left">
                  progress in {c.courseName.toLowerCase()}
                </p>
                <div className="flex items-center gap-2 w-full">
                  <div
                    className="flex-1 h-2 bg-nowify-avatar-bg rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={c.progress_pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progress in ${c.courseName}: ${c.progress_pct} percent`}
                  >
                    <div
                      className={`h-full rounded-full ${c.progress_pct >= 50 ? "bg-nowify-primary" : "bg-nowify-neutral/40"}`}
                      style={{ width: `${c.progress_pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-nowify-text">%{c.progress_pct}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
