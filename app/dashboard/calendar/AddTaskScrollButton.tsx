"use client";

export default function AddTaskScrollButton() {
  return (
    <button
      type="button"
      onClick={() =>
        document.getElementById("add-task-form")?.scrollIntoView({ behavior: "smooth" })
      }
      className="w-9 h-9 rounded-full bg-neutral-700 hover:bg-neutral-600 text-white flex items-center justify-center text-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary"
      aria-label="Add a task"
    >
      +
    </button>
  );
}
