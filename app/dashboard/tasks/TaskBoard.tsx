"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Task = {
  id: number;
  taskTitle: string;
  startDate: string;
  endDate: string;
  dueTime: string | null;
  status: string;
  course?: { courseName: string } | null;
};

const STATUSES = ["To-Do", "In Progress", "In Review", "Done"];

function formatDue(endDate: string) {
  const end = new Date(endDate);
  const now = new Date();
  const hours = (end.getTime() - now.getTime()) / (60 * 60 * 1000);
  if (hours < 0) return "Overdue";
  if (hours <= 24) return "24 hours remaining";
  if (hours <= 48) return "48 hours remaining";
  if (hours <= 72) return "Due in 72 hours";
  return `${Math.ceil(hours / 24)} days left`;
}

export default function TaskBoard() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data) => {
        setTasks(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(taskId: number, status: string) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status } : t))
      );
      router.refresh();
    }
  }

  async function deleteTask(taskId: number) {
    if (!confirm("Delete this task?")) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      router.refresh();
    }
  }

  if (loading) return <div className="text-nowify-muted text-sm">Loading tasks…</div>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STATUSES.map((status) => (
        <div key={status} className="flex flex-col">
          <div className="rounded-2xl border border-nowify-border bg-nowify-card shadow-md flex flex-col min-h-[200px] overflow-hidden">
            <div className="px-3 py-2 border-b border-nowify-border border-l-4 border-l-nowify-primary font-semibold text-sm text-nowify-text bg-nowify-bg rounded-t-2xl">
              {status}
            </div>
            <div className="p-2 flex-grow min-h-[120px]">
              {tasks.filter((t) => t.status === status).length === 0 ? (
                <div className="py-6 text-center text-nowify-muted text-sm">No tasks</div>
              ) : (
                tasks
                  .filter((t) => t.status === status)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="border border-nowify-border rounded-lg p-2 mb-2 bg-nowify-card"
                    >
                      <div className="text-nowify-muted text-sm">
                        {t.course?.courseName && `${t.course.courseName} · `}
                        {formatDue(t.endDate)}
                      </div>
                      <div className="font-medium text-sm mt-1 text-nowify-text">{t.taskTitle}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {STATUSES.filter((s) => s !== t.status).map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="px-2 py-1 text-xs rounded border border-nowify-border text-nowify-text hover:bg-nowify-bg transition-colors"
                            onClick={() => updateStatus(t.id, s)}
                          >
                            → {s}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="px-2 py-1 text-xs rounded border border-nowify-danger text-nowify-danger hover:bg-nowify-danger/10 transition-colors"
                          onClick={() => deleteTask(t.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
