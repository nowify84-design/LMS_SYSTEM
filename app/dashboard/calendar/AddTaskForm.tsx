"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Course = { id: number; courseName: string };

export default function AddTaskForm({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [taskTitle, setTaskTitle] = useState("");
  const [date, setDate] = useState("");
  const [timeStart, setTimeStart] = useState("09:00");
  const [timeFinish, setTimeFinish] = useState("10:00");
  const [courseId, setCourseId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const d = date || new Date().toISOString().slice(0, 10);
      const [sh, sm] = timeStart.split(":").map(Number);
      const [eh, em] = timeFinish.split(":").map(Number);
      const [y, mo, day] = d.split("-").map(Number);
      const startDate = new Date(y, mo - 1, day, sh, sm, 0);
      const endDate = new Date(y, mo - 1, day, eh, em, 0);
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          dueTime: timeFinish,
          status: "To-Do",
          courseId: courseId || undefined,
        }),
      });
      if (res.ok) {
        setTaskTitle("");
        setDate("");
        setTimeStart("09:00");
        setTimeFinish("10:00");
        setCourseId("");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  if (courses.length === 0) {
    return (
      <p className="text-sm text-nowify-muted">
        Enroll in a course first to add tasks.
      </p>
    );
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label
          htmlFor="task-title"
          className="block text-sm font-medium text-nowify-text mb-1"
        >
          title of task:
        </label>
        <input
          id="task-title"
          type="text"
          className="w-full rounded-lg border border-nowify-border px-2 py-1.5 text-sm text-nowify-text focus:border-nowify-primary focus:ring-1 focus:ring-nowify-primary bg-nowify-card"
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
          required
        />
      </div>
      <div>
        <label
          htmlFor="time-start"
          className="block text-sm font-medium text-nowify-text mb-1"
        >
          time it start:
        </label>
        <input
          id="time-start"
          type="time"
          className="w-full rounded-lg border border-nowify-border px-2 py-1.5 text-sm text-nowify-text focus:border-nowify-primary focus:ring-1 focus:ring-nowify-primary bg-nowify-card"
          value={timeStart}
          onChange={(e) => setTimeStart(e.target.value)}
        />
      </div>
      <div>
        <label
          htmlFor="time-finish"
          className="block text-sm font-medium text-nowify-text mb-1"
        >
          time it finish:
        </label>
        <input
          id="time-finish"
          type="time"
          className="w-full rounded-lg border border-nowify-border px-2 py-1.5 text-sm text-nowify-text focus:border-nowify-primary focus:ring-1 focus:ring-nowify-primary bg-nowify-card"
          value={timeFinish}
          onChange={(e) => setTimeFinish(e.target.value)}
        />
      </div>
      <div>
        <label
          htmlFor="task-date"
          className="block text-sm font-medium text-nowify-text mb-1"
        >
          date:
        </label>
        <input
          id="task-date"
          type="date"
          className="w-full rounded-lg border border-nowify-border px-2 py-1.5 text-sm text-nowify-text focus:border-nowify-primary focus:ring-1 focus:ring-nowify-primary bg-nowify-card"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={today}
        />
      </div>
      <div>
        <label
          htmlFor="task-course"
          className="block text-sm font-medium text-nowify-text mb-1"
        >
          course:
        </label>
        <select
          id="task-course"
          className="w-full rounded-lg border border-nowify-border px-2 py-1.5 text-sm text-nowify-text focus:border-nowify-primary focus:ring-1 focus:ring-nowify-primary bg-nowify-card"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : "")}
          required
        >
          <option value="">Choose a course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.courseName}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="w-full px-4 py-2.5 text-sm rounded-lg bg-nowify-primary text-white font-medium hover:bg-nowify-primary-dark disabled:opacity-60 transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary focus:ring-offset-2"
        disabled={loading}
      >
        {loading ? "Adding…" : "Add task"}
      </button>
    </form>
  );
}
