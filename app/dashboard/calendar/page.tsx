import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AllTasksTable from "./AllTasksTable";
import CalendarView from "./CalendarView";

export default async function CalendarPage() {
  const studentId = await getSession();
  if (!studentId) return null;

  const [assignments, exams, tasks, courses] = await Promise.all([
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
      orderBy: { endDate: "asc" },
    }),
    prisma.course.findMany({
      where: { studentId },
      select: { id: true, courseName: true },
    }),
  ]);

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();

  const items: {
    date: Date;
    title: string;
    type: string;
    course?: string | null;
    start: Date;
    end: Date;
  }[] = [];

  assignments.forEach((a) => {
    const d = new Date(a.dueDate);
    const start = new Date(d);
    start.setHours(9, 0, 0, 0);
    const end = new Date(d);
    end.setHours(10, 0, 0, 0);
    items.push({
      date: d,
      title: a.assignmentTitle,
      type: "Assignment",
      course: a.course.courseName,
      start,
      end,
    });
  });
  exams.forEach((e) => {
    const d = new Date(e.examDate);
    const start = new Date(d);
    start.setHours(13, 30, 0, 0);
    const end = new Date(d);
    end.setHours(14, 30, 0, 0);
    items.push({
      date: d,
      title: e.examTitle,
      type: "Exam",
      course: e.course.courseName,
      start,
      end,
    });
  });
  const courseById = new Map(courses.map((c) => [c.id, c.courseName]));
  tasks.forEach((t) => {
    const taskWithCourseId = t as { courseId?: number | null };
    const courseName = taskWithCourseId.courseId != null ? courseById.get(taskWithCourseId.courseId) ?? null : null;
    items.push({
      date: new Date(t.endDate),
      title: t.taskTitle,
      type: "Task",
      course: courseName,
      start: new Date(t.startDate),
      end: new Date(t.endDate),
    });
  });

  const serializedItems = items.map((item) => ({
    date: item.date.toISOString(),
    title: item.title,
    type: item.type,
    course: item.course ?? null,
    start: item.start.toISOString(),
    end: item.end.toISOString(),
  }));

  return (
    <>
      <h1 className="text-2xl font-semibold text-nowify-text border-b-4 border-nowify-primary pb-2 mb-6 inline-block">
        Calendar
      </h1>
      <CalendarView
        items={serializedItems}
        initialMonthISO={new Date(thisYear, thisMonth, 1).toISOString()}
      />
      <div className="mt-6 rounded-2xl border-2 border-nowify-border bg-nowify-card shadow-md overflow-hidden">
        <div className="px-4 py-3 border-b border-nowify-border bg-nowify-bg rounded-t-2xl">
          <h2 className="text-lg font-semibold text-nowify-text">All Tasks</h2>
          <p className="text-xs text-nowify-muted mt-0.5">
            Assignments, exams, and tasks with start and end dates
          </p>
        </div>
        <AllTasksTable items={serializedItems} />
      </div>
    </>
  );
}
