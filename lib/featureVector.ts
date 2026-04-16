/**
 * Build 8-feature vector for ML prediction.
 * Aligned with XGBoost model top importances from notebook.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

export const FEATURE_KEYS = [
  "previous_delays_count",
  "assignments_count",
  "activity_count_in_enrolled_courses",
  "courses_count",
  "workload_level",
  "non_submission_count",
  "last7d_engagement",
  "course_engagement",
] as const;

export type FeatureVector = {
  [K in (typeof FEATURE_KEYS)[number]]: number;
};

/** Heuristic risk 0–1 when Flask is down or returns an error. */
export function fallbackRiskScoreFromFeatures(v: FeatureVector): number {
  const delayScore = Math.min(1, v.previous_delays_count / 20);
  const nonSubScore = Math.min(1, v.non_submission_count / 10);
  const workloadScore = Math.min(1, v.workload_level / 1.5);
  return delayScore * 0.4 + nonSubScore * 0.35 + workloadScore * 0.25;
}

export function defaultFeatureVector(): FeatureVector {
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, 0])) as FeatureVector;
}

type StudentWithData = Prisma.StudentGetPayload<{
  include: {
    courses: {
      include: {
        assignments: true;
        exams: true;
        lmsResources: true;
      };
    };
    dailyActivities: true;
    tasks: true;
  };
}>;

type CourseWithRelations = StudentWithData["courses"][number];
type AssignmentRow = CourseWithRelations["assignments"][number];
type ExamRow = CourseWithRelations["exams"][number];
type DailyActivityRow = StudentWithData["dailyActivities"][number];

type DueItem =
  | { kind: "assignment"; row: AssignmentRow }
  | { kind: "exam"; row: ExamRow };

function dueAt(item: DueItem): Date {
  return item.kind === "assignment" ? item.row.dueDate : item.row.examDate;
}

function isLateAssignment(a: AssignmentRow): boolean {
  return (
    a.status === "Late" ||
    Boolean(a.submissionDate && a.submissionDate > a.dueDate)
  );
}

function isLateExam(e: ExamRow): boolean {
  return (
    e.status === "Late" ||
    Boolean(e.submissionDate && e.submissionDate > e.examDate)
  );
}

function collectDueItems(courses: CourseWithRelations[]): DueItem[] {
  const items: DueItem[] = [];
  for (const c of courses) {
    for (const a of c.assignments) {
      items.push({ kind: "assignment", row: a });
    }
    for (const e of c.exams) {
      items.push({ kind: "exam", row: e });
    }
  }
  return items;
}

export async function buildFeatureVector(
  prisma: PrismaClient,
  studentId: number,
): Promise<FeatureVector> {
  const now = new Date();

  const data: StudentWithData | null = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      courses: {
        include: {
          assignments: true,
          exams: true,
          lmsResources: true,
        },
        orderBy: { courseStartDate: "asc" },
      },
      dailyActivities: true,
      tasks: true,
    },
  });

  if (!data) return defaultFeatureVector();

  const { courses, tasks, dailyActivities } = data;
  const dueItems = collectDueItems(courses);
  const assignmentsCount = dueItems.length;
  const coursesCount = courses.length;

  // 1. previous_delays_count (cumulative late counts across course order)
  let previous_delays_count = 0;
  let cumLates = 0;
  for (const course of courses) {
    const courseLates =
      course.assignments.filter(isLateAssignment).length +
      course.exams.filter(isLateExam).length;
    previous_delays_count += cumLates;
    cumLates += courseLates;
  }

  // 2. activity_count_in_enrolled_courses
  const activity_count_in_enrolled_courses = courses.reduce(
    (sum, c) => sum + c.lmsResources.length,
    0,
  );

  // 3. workload_level — includes assignments due TODAY (high procrastination)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const upcomingAss = dueItems.filter((item) => {
    const d = dueAt(item);
    return d > thirtyDaysAgo && d <= now;
  }).length;
  const dueTodayAss = dueItems.filter((item) => {
    const d = dueAt(item);
    return (
      d >= todayStart &&
      d <= todayEnd &&
      item.kind === "assignment" &&
      item.row.status === "Pending"
    );
  }).length;
  const workload_level = Math.min(
    1.5,
    (upcomingAss + dueTodayAss) / 15 + tasks.length / 100,
  );

  // 4. non_submission_count — overdue or due today, still pending
  const non_submission_count = dueItems.filter((item) => {
    const d = dueAt(item);
    const pending =
      item.kind === "assignment"
        ? item.row.status === "Pending"
        : item.row.status === "Pending";
    return (
      (d <= now || (d >= todayStart && d <= todayEnd)) && pending
    );
  }).length;

  // 5–6. Engagement
  const firstDueTimes = dueItems
    .map((item) => dueAt(item).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  const coursePeriod = firstDueTimes.length
    ? new Date(firstDueTimes[0])
    : null;
  const courseStart = coursePeriod
    ? new Date(coursePeriod.getTime() - 90 * 24 * 60 * 60 * 1000)
    : new Date(1970, 0, 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const courseActs = dailyActivities.filter(
    (d: DailyActivityRow) =>
      d.activityDate >= courseStart && d.activityDate <= now,
  );
  const courseLogins = courseActs.length;
  const courseClicks = courseActs.reduce(
    (sum, d) => sum + d.clicks,
    0,
  );
  const course_engagement = Math.sqrt(
    Math.max(0, courseLogins) * Math.max(0, courseClicks),
  );

  const last7Acts = dailyActivities.filter(
    (d: DailyActivityRow) => d.activityDate >= sevenDaysAgo,
  );
  const last7Logins = last7Acts.length;
  const last7Clicks = last7Acts.reduce((sum, d) => sum + d.clicks, 0);
  const last7d_engagement = Math.sqrt(
    Math.max(0, last7Logins) * Math.max(0, last7Clicks),
  );

  return {
    previous_delays_count,
    assignments_count: assignmentsCount,
    activity_count_in_enrolled_courses,
    courses_count: coursesCount,
    workload_level,
    non_submission_count,
    last7d_engagement,
    course_engagement,
  };
}

export function featureVectorToPayload(
  vec: FeatureVector,
): Record<string, number> {
  return Object.fromEntries(
    FEATURE_KEYS.map((k) => [
      k,
      Number.isFinite(vec[k as keyof FeatureVector])
        ? vec[k as keyof FeatureVector]
        : 0,
    ]),
  ) as Record<string, number>;
}
