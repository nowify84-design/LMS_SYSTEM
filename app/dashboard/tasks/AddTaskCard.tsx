"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Course = { id: number; courseName: string };

export default function AddTaskCard({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dueTime, setDueTime] = useState("23:59");
  const [courseId, setCourseId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle,
          startDate: startDate || new Date().toISOString().slice(0, 10),
          endDate: endDate || startDate || new Date().toISOString().slice(0, 10),
          dueTime: dueTime || undefined,
          status: "To-Do",
          courseId: courseId || undefined,
        }),
      });
      if (res.ok) {
        setTaskTitle("");
        setStartDate("");
        setEndDate("");
        setCourseId("");
        setOpen(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="rounded-2xl border border-nowify-border bg-nowify-card shadow-md p-4">
      {courses.length === 0 ? (
        <p className="text-sm text-nowify-muted">Enroll in a course first to add tasks.</p>
      ) : !open ? (
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded-lg border-2 border-nowify-primary text-nowify-primary hover:bg-nowify-primary hover:text-white transition-colors"
          onClick={() => setOpen(true)}
        >
          + Add task
        </button>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-sm font-medium text-nowify-text mb-1">Task name</label>
            <input
              type="text"
              className="w-full rounded border border-nowify-border px-2 py-1.5 text-sm text-nowify-text focus:border-nowify-primary focus:ring-1 focus:ring-nowify-primary"
              placeholder="e.g. Complete report"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-sm font-medium text-nowify-text mb-1">Start</label>
              <input
                type="date"
                className="w-full rounded border border-nowify-border px-2 py-1.5 text-sm text-nowify-text focus:border-nowify-primary focus:ring-1 focus:ring-nowify-primary"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={today}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nowify-text mb-1">End</label>
              <input
                type="date"
                className="w-full rounded border border-nowify-border px-2 py-1.5 text-sm text-nowify-text focus:border-nowify-primary focus:ring-1 focus:ring-nowify-primary"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || today}
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium text-nowify-text mb-1">Course</label>
            <select
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
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-1.5 text-sm rounded-lg bg-nowify-primary text-white font-medium hover:bg-nowify-primary-dark disabled:opacity-60 transition-colors"
              disabled={loading}
            >
              {loading ? "…" : "Add"}
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-lg border border-nowify-border text-nowify-text font-medium hover:bg-nowify-bg transition-colors"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
