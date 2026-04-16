"use client";

type SerializedItem = {
  title: string;
  type: string;
  status: string;
  course?: string | null;
  start: string;
  end: string;
};

/** Parse YYYY-MM-DD from ISO string without timezone shift */
function formatDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * For Tasks: show "Apr 8, 2026" if same day, or "Apr 8, 2026 → Apr 10, 2026" if multi-day.
 * For Assignments/Exams: show due date only (no artificial time columns).
 */
function formatDateRange(startISO: string, endISO: string) {
  const startDay = startISO.slice(0, 10);
  const endDay = endISO.slice(0, 10);
  if (startDay === endDay) return formatDate(startISO);
  return `${formatDate(startISO)} → ${formatDate(endISO)}`;
}

export default function AllTasksTable({
  items,
}: {
  items: SerializedItem[];
}) {
  const sorted = [...items].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  if (sorted.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-nowify-muted text-sm">
        No assignments, exams, or tasks yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-nowify-border bg-nowify-bg">
            <th className="text-left px-4 py-3 font-semibold text-nowify-text">
              Title
            </th>
            <th className="text-left px-4 py-3 font-semibold text-nowify-text">
              Type
            </th>
            <th className="text-left px-4 py-3 font-semibold text-nowify-text">
              Status
            </th>
            <th className="text-left px-4 py-3 font-semibold text-nowify-text">
              Deadline Date
            </th>
            <th className="text-left px-4 py-3 font-semibold text-nowify-text">
              Course
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, i) => {
            const endDate = new Date(item.end);
            const now = new Date();
            const isOverdue = endDate < now && !["Done", "Completed"].includes(item.status);
            let displayStatus = item.status;
            let statusBadge = {
              "To-Do": "bg-gray-100 text-gray-800",
              "In Progress": "bg-yellow-100 text-yellow-800", 
              "In Review": "bg-orange-100 text-orange-800",
              "Done": "bg-green-100 text-green-800",
              "Pending": "bg-blue-100 text-blue-800",
              "Completed": "bg-emerald-100 text-emerald-800",
            }[item.status] || "bg-gray-100 text-gray-800";

            if (isOverdue) {
              displayStatus = "Overdue";
              statusBadge = "bg-red-100 text-red-800 border border-red-200";
            }

            return (
              <tr
                key={i}
                className={`border-b border-nowify-border/50 hover:bg-nowify-bg/50 ${isOverdue ? "bg-red-50/50" : ""}`}
              >
                <td className={`px-4 py-3 font-medium ${isOverdue ? "text-red-800" : "text-nowify-text"}`}>
                  {item.title}
                </td>
                <td className="px-4 py-3 text-nowify-muted">{item.type}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge}`}>
                    {displayStatus}
                  </span>
                </td>
                <td className={`px-4 py-3 ${isOverdue ? "text-red-700 font-medium" : "text-nowify-muted"}`}>
                  {item.type === "Task"
                    ? formatDateRange(item.start, item.end)
                    : formatDate(item.start)}
                </td>
                <td className="px-4 py-3 text-nowify-muted">
                  {item.course ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
