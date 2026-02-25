import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getTask(studentId: number, id: string) {
  const taskId = parseInt(id, 10);
  if (Number.isNaN(taskId)) return null;
  return prisma.task.findFirst({
    where: { id: taskId, studentId },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const studentId = await getSession();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const task = await getTask(studentId, (await params).id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  return NextResponse.json(task);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const studentId = await getSession();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const task = await getTask(studentId, (await params).id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  try {
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.taskTitle !== undefined) data.taskTitle = body.taskTitle;
    if (body.startDate !== undefined) data.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) data.endDate = new Date(body.endDate);
    if (body.dueTime !== undefined) data.dueTime = body.dueTime;
    if (body.status !== undefined) data.status = body.status;
    if (body.courseName !== undefined) data.courseName = body.courseName;
    const updated = await prisma.task.update({
      where: { id: task.id },
      data,
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("Task update error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const studentId = await getSession();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const task = await getTask(studentId, (await params).id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  await prisma.task.delete({ where: { id: task.id } });
  return NextResponse.json({ ok: true });
}
