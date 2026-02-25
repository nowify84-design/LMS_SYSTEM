import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildFeatureVector, featureVectorToPayload } from "@/lib/featureVector";
import { getMessageForLevel, type PredictionLevel } from "@/lib/messageRules";

const FLASK_API_URL = process.env.FLASK_API_URL || "http://127.0.0.1:5000";

export async function GET() {
  const studentId = await getSession();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      courses: { include: { assignments: true, exams: true } },
      lmsActivity: true,
      tasks: true,
    },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const featureVector = await buildFeatureVector(prisma, studentId);

  let level: PredictionLevel = "Low";
  let percentage = 15;

  try {
    const res = await fetch(`${FLASK_API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(featureVectorToPayload(featureVector)),
    });
    if (res.ok) {
      const data = await res.json();
      level = data.level ?? level;
      percentage = typeof data.percentage === "number" ? data.percentage : percentage;
    }
  } catch {
    // Flask unreachable: use fallback from early signals
    const score =
      (1 - featureVector.early_login_consistency) * 0.4 +
      featureVector.late_registration_score * 0.35 +
      featureVector.workload_level * 0.25;
    percentage = Math.round(Math.min(100, Math.max(0, score * 100)));
    if (percentage >= 60) level = "High";
    else if (percentage >= 30) level = "Medium";
  }

  const message = getMessageForLevel(level, percentage);

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingAssignments = student.courses.flatMap((c) =>
    c.assignments
      .filter((a) => a.status === "Pending" && a.dueDate >= now && a.dueDate <= in7Days)
      .map((a) => ({
        id: a.id,
        title: a.assignmentTitle,
        dueDate: a.dueDate,
        courseName: c.courseName,
      }))
  );
  const upcomingExams = student.courses.flatMap((c) =>
    c.exams
      .filter((e) => e.status === "Pending" && e.examDate >= now && e.examDate <= in7Days)
      .map((e) => ({
        id: e.id,
        title: e.examTitle,
        dueDate: e.examDate,
        courseName: c.courseName,
      }))
  );
  const upcomingTasks = student.tasks
    .filter((t) => ["To-Do", "In Progress"].includes(t.status) && t.endDate >= now && t.endDate <= in7Days)
    .map((t) => ({
      id: t.id,
      title: t.taskTitle,
      endDate: t.endDate,
      courseName: t.courseName,
    }));

  const coursesWithProgress = student.courses.map((c) => {
    const total = c.totalAssignments + c.totalExams;
    const completed = c.completedAssignments + c.completedExams;
    const progress_pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { courseName: c.courseName, progress_pct };
  });

  return NextResponse.json({
    prediction: { level, percentage },
    message,
    coursesWithProgress,
    upcomingAssignments: upcomingAssignments.slice(0, 10),
    upcomingExams: upcomingExams.slice(0, 5),
    upcomingTasks: upcomingTasks.slice(0, 10),
  });
}
