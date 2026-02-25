"use client";

import { useMemo, useState } from "react";

export type CalendarItemPayload = {
  date: Date;
  title: string;
  type: string;
  course?: string | null;
  start: Date;
  end: Date;
};

type SerializedCalendarItem = {
  date: string;
  title: string;
  type: string;
  course?: string | null;
  start: string;
  end: string;
};

function parseItems(serialized: SerializedCalendarItem[]): CalendarItemPayload[] {
  return serialized.map((s) => ({
    date: new Date(s.date),
    title: s.title,
    type: s.type,
    course: s.course ?? null,
    start: new Date(s.start),
    end: new Date(s.end),
  }));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function CalendarView({
  items: serializedItems,
  initialMonthISO,
}: {
  items: SerializedCalendarItem[];
  initialMonthISO: string;
}) {
  const items = useMemo(() => parseItems(serializedItems), [serializedItems]);
  const initialMonth = useMemo(() => new Date(initialMonthISO), [initialMonthISO]);
  const [viewMonth, setViewMonth] = useState(() => new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1));
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const now = new Date();
    return getWeekStart(now);
  });

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const gridDays: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) gridDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) gridDays.push(d);

  const datesWithDeadlines = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const start = new Date(item.start);
      const end = new Date(item.end);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    });
    return set;
  }, [items]);

  const itemsInMonth = useMemo(() => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    return items.filter(
      (item) =>
        item.start.getTime() <= monthEnd.getTime() &&
        item.end.getTime() >= monthStart.getTime()
    );
  }, [items, year, month]);

  function getItemsForDate(d: number | null): typeof items {
    if (d === null) return [];
    const cellDate = new Date(year, month, d);
    cellDate.setHours(0, 0, 0, 0);
    const cellEnd = new Date(cellDate);
    cellEnd.setHours(23, 59, 59, 999);
    return itemsInMonth.filter(
      (item) =>
        item.start.getTime() <= cellEnd.getTime() &&
        item.end.getTime() >= cellDate.getTime()
    );
  }

  const weeks = useMemo(() => {
    const result: (number | null)[][] = [];
    let week: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) week.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) {
        result.push(week);
        week = [];
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(null);
      result.push(week);
    }
    return result;
  }, [startPad, daysInMonth]);

  function handlePrevMonth() {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }
  function handleNextMonth() {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly calendar */}
        <div className="rounded-2xl border-2 border-nowify-border bg-nowify-card shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-nowify-border bg-nowify-bg rounded-t-2xl">
            <h2 className="text-lg font-semibold text-nowify-text">My Calendar</h2>
            <p className="text-xs text-nowify-muted mt-0.5">
              Calendar page shows your monthly and weekly tasks.
            </p>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-nowify-text hover:bg-nowify-bg transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary"
                aria-label="Previous month"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-base font-semibold text-nowify-text">
                {MONTH_NAMES[month]} {year}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-nowify-text hover:bg-nowify-bg transition-colors focus:outline-none focus:ring-2 focus:ring-nowify-primary"
                aria-label="Next month"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
              {WEEKDAYS.map((w) => (
                <div key={w} className="font-medium text-nowify-muted py-1">
                  {w}
                </div>
              ))}
              {gridDays.map((d, i) => {
                if (d === null) {
                  return <div key={`e-${i}`} className="py-2 min-h-[36px]" />;
                }
                const cellDate = new Date(year, month, d);
                const weekStart = getWeekStart(cellDate);
                const isSelectedWeek =
                  selectedWeekStart.getTime() === weekStart.getTime();
                const isToday = sameDay(cellDate, today);
                const hasDeadline = datesWithDeadlines.has(
                  `${year}-${month}-${d}`
                );
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedWeekStart(weekStart)}
                    className={`
                      py-2 min-h-[36px] rounded-lg text-sm font-medium transition-colors
                      focus:outline-none focus:ring-2 focus:ring-nowify-accent focus:ring-inset
                      ${isSelectedWeek ? "bg-nowify-accent text-white ring-2 ring-nowify-accent ring-inset" : "text-nowify-text hover:bg-nowify-bg"}
                      ${isToday ? "ring-2 ring-nowify-accent ring-inset" : ""}
                    `}
                  >
                    <span className="inline-flex flex-col items-center justify-center gap-0">
                      {hasDeadline && (
                        <span
                          className="text-nowify-danger text-sm leading-none"
                          aria-hidden
                          title="Has tasks">
                          ★
                        </span>
                      )}
                      <span>{d}</span>
                      {isToday && (
                        <span className="sr-only">Today</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Monthly task view: top = days, left = week #, grid = date + tasks */}
        <div className="rounded-2xl border-2 border-nowify-border bg-nowify-card shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-nowify-border bg-nowify-bg rounded-t-2xl">
            <h2 className="text-lg font-semibold text-nowify-text">
              {MONTH_NAMES[month]} {year}
            </h2>
            <p className="text-xs text-nowify-muted mt-0.5">
              Tasks by day — click a date in the calendar to select
            </p>
          </div>
          <div className="overflow-x-auto p-4">
            <div className="grid grid-cols-8 gap-px text-sm min-w-[500px]">
              <div className="text-nowify-muted font-medium py-1.5 text-xs" />
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center font-medium text-nowify-muted py-1.5 text-xs">
                  {w}
                </div>
              ))}
              {weeks.map((week, wi) => (
                <div key={`week-${wi}`} className="contents">
                  <div
                    className="text-nowify-muted text-xs py-1.5 pr-2 text-right font-medium"
                  >
                    {wi + 1}
                  </div>
                  {week.map((d, di) => {
                    const dayItems = getItemsForDate(d);
                    return (
                      <div
                        key={`${wi}-${di}`}
                        className={`min-h-[70px] rounded border border-nowify-border/60 p-1.5 overflow-y-auto bg-nowify-bg/30 ${d !== null && sameDay(new Date(year, month, d), today)
                          ? "ring-2 ring-nowify-accent bg-nowify-accent-light/50"
                          : ""
                          }`}
                      >
                        {d !== null ? (
                          <>
                            <span className="text-xs font-semibold text-nowify-text block">
                              {d}
                            </span>
                            <ul className="mt-1 space-y-0.5">
                              {dayItems.map((item, ii) => (
                                <li
                                  key={ii}
                                  className="text-[10px] truncate text-nowify-text bg-nowify-accent-light border border-nowify-accent/50 rounded px-1 py-0.5"
                                  title={`${item.title} (${item.type})`}
                                >
                                  {item.title}
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {itemsInMonth.length === 0 && (
            <p className="px-4 py-6 text-center text-nowify-muted text-sm">
              No tasks this month.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
