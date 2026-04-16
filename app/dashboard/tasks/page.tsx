import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TaskBoard from "./TaskBoard";
import AddTaskCard from "./AddTaskCard";

export default async function TasksPage() {
  const studentId = await getSession();
  if (!studentId) return null;
  
  const [courses, tasks] = await Promise.all([
    prisma.course.findMany({
      where: { studentId },
      select: { id: true, courseName: true },
    }),
    prisma.task.findMany({
      where: { studentId },
      include: { course: { select: { courseName: true } } },
      orderBy: { endDate: "asc" },
    }),
  ]);

  const boardTasks = tasks.map((t) => ({
    id: t.id,
    taskTitle: t.taskTitle,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
    dueTime: t.dueTime,
    status: t.status,
    course: t.course,
  }));

  return (
    <>
      <h1 className="text-2xl font-semibold text-nowify-text border-b-2 border-nowify-primary pb-2 mb-6 inline-block">Academic load / Task board</h1>
      <div className="mb-6">
        <AddTaskCard courses={courses} />
      </div>
      <TaskBoard initialTasks={boardTasks} />
    </>
  );
}
