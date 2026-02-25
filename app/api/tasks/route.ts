import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const studentId = await getSession();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tasks = await prisma.task.findMany({
    where: { studentId },
    include: { course: { select: { courseName: true } } },
    orderBy: { endDate: "asc" },
  });
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const studentId = await getSession();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { taskTitle, startDate, endDate, dueTime, status, courseId } = body;
    if (!taskTitle || !startDate || !endDate) {
      return NextResponse.json(
        { error: "taskTitle, startDate, and endDate required" },
        { status: 400 }
      );
    }
    let courseIdResolved: number | null = null;
    if (courseId != null && courseId !== "") {
      const cid = typeof courseId === "number" ? courseId : Number(courseId);
      if (!Number.isInteger(cid) || cid <= 0) {
        return NextResponse.json(
          { error: "courseId must be a positive integer when provided" },
          { status: 400 }
        );
      }
      const enrolled = await prisma.course.findFirst({
        where: { studentId, id: cid },
        select: { id: true },
      });
      if (!enrolled) {
        return NextResponse.json(
          { error: "Course must be one of your enrolled courses" },
          { status: 400 }
        );
      }
      courseIdResolved = cid;
    }
    const task = await prisma.task.create({
      data: {
        studentId,
        courseId: courseIdResolved,
        taskTitle,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        dueTime: dueTime ?? null,
        status: status || "To-Do",
      },
      include: { course: { select: { courseName: true } } },
    });
    return NextResponse.json(task);
  } catch (e) {
    console.error("Task create error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
