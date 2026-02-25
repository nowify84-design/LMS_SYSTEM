import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const studentId = await getSession();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const exams = await prisma.exam.findMany({
    where: { course: { studentId } },
    include: { course: { select: { courseName: true } } },
    orderBy: { examDate: "asc" },
  });
  return NextResponse.json(exams);
}
