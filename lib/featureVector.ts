/**
 * Build 8-feature vector for ML prediction - FIXED TYPES.
 * Aligned with XGBoost model top importances from notebook.
 */

import type { Prisma, Student } from "@prisma/client";

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

export function defaultFeatureVector(): FeatureVector {
  return Object.fromEntries(FEATURE_KEYS.map(k => [k, 0])) as FeatureVector;
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

export async function buildFeatureVector(
  prisma: Prisma.PrismaClient,
  studentId: number
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
        orderBy: { courseStartDate: 'asc' },
      },
      dailyActivities: true,
      tasks: true,
    },
  });

  if (!data) return defaultFeatureVector();

  const { courses, tasks, dailyActivities } = data;
  const allAssignments = courses.flatMap(c => [...(c.assignments as any[]), ...(c.exams as any[])]);
  const assignmentsCount = allAssignments.length;
  const coursesCount = courses.length;

  // 1. previous_delays_count
  let previous_delays_count = 0;
  let cumLates = 0;
  for (const course of courses) {
    const courseLates = (course.assignments as any[]).filter((a: any) => a.status === 'Late' || (a.submissionDate && a.submissionDate > a.dueDate)).length +
      (course.exams as any[]).filter((e: any) => e.status === 'Late' || (e.submissionDate && e.submissionDate > e.examDate)).length;
    previous_delays_count += cumLates;
    cumLates += courseLates;
  }

  // 2. activity_count_in_enrolled_courses
  const activity_count_in_enrolled_courses = courses.reduce((sum, c) => sum + ((c.lmsResources as any[])?.length ?? 20), 0);

  // 3. workload_level
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const upcomingAss = allAssignments.filter((a: any) => a.dueDate > thirtyDaysAgo && a.dueDate <= now).length;
  const workload_level = Math.min(1.5, upcomingAss / 15 + tasks.length / 100);

  // 4. non_submission_count
  const non_submission_count = allAssignments.filter((a: any) => 
    a.dueDate < now && a.status === 'Pending' && (a.type === 'TMA' || a.type === 'CMA')
  ).length;

  // 5-6. Engagement
  const coursePeriod = courses.flatMap(c => (c.assignments as any[]).map((a: any) => a.dueDate)).sort((a, b) => a.getTime() - b.getTime())[0];
  const courseStart = coursePeriod ? new Date(coursePeriod.getTime() - 90 * 24 * 60 * 60 * 1000) : new Date(1970, 0, 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const courseActs = dailyActivities.filter((d: any) => d.activityDate >= courseStart && d.activityDate <= now);
  const courseLogins = courseActs.length;
  const courseClicks = courseActs.reduce((sum: number, d: any) => sum + d.clicks, 0);
  const course_engagement = Math.sqrt(Math.max(0, courseLogins) * Math.max(0, courseClicks));

  const last7Acts = dailyActivities.filter((d: any) => d.activityDate >= sevenDaysAgo);
  const last7Logins = last7Acts.length;
  const last7Clicks = last7Acts.reduce((sum: number, d: any) => sum + d.clicks, 0);
  const last7d_engagement = Math.sqrt(Math.max(0, last7Logins) * Math.max(0, last7Clicks));

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

export function featureVectorToPayload(vec: FeatureVector): Record<string, number> {
  return Object.fromEntries(
    FEATURE_KEYS.map(k => [k, Number.isFinite(vec[k as keyof FeatureVector]) ? vec[k as keyof FeatureVector] : 0])
  ) as Record<string, number>;
}

