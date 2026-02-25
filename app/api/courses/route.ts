import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const studentId = await getSession();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const courses = await prisma.course.findMany({
    where: { studentId },
    include: {
      assignments: true,
      exams: true,
    },
  });
  const withProgress = courses.map((c) => {
    const total = c.totalAssignments + c.totalExams;
    const completed = c.completedAssignments + c.completedExams;
    const progress_pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { ...c, progress_pct };
  });
  return NextResponse.json(withProgress);
}
