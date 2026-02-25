import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TaskBoard from "./TaskBoard";
import AddTaskCard from "./AddTaskCard";

export default async function TasksPage() {
  const studentId = await getSession();
  if (!studentId) return null;
  const courses = await prisma.course.findMany({
    where: { studentId },
    select: { id: true, courseName: true },
  });

  return (
    <>
      <h1 className="text-2xl font-semibold text-nowify-text border-b-2 border-nowify-primary pb-2 mb-6 inline-block">Academic load / Task board</h1>
      <div className="mb-6">
        <AddTaskCard courses={courses} />
      </div>
      <TaskBoard />
    </>
  );
}
