"use client";

type SerializedItem = {
  title: string;
  type: string;
  course?: string | null;
  start: string;
  end: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const sameDay =
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0;
  if (sameDay) return formatDate(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
              Start
            </th>
            <th className="text-left px-4 py-3 font-semibold text-nowify-text">
              End
            </th>
            <th className="text-left px-4 py-3 font-semibold text-nowify-text">
              Course
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, i) => (
            <tr
              key={i}
              className="border-b border-nowify-border/50 hover:bg-nowify-bg/50"
            >
              <td className="px-4 py-3 font-medium text-nowify-text">
                {item.title}
              </td>
              <td className="px-4 py-3 text-nowify-muted">{item.type}</td>
              <td className="px-4 py-3 text-nowify-muted">
                {formatDateTime(item.start)}
              </td>
              <td className="px-4 py-3 text-nowify-muted">
                {formatDateTime(item.end)}
              </td>
              <td className="px-4 py-3 text-nowify-muted">
                {item.course ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
