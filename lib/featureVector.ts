/**
 * Build feature vector for ML prediction. Align with ml/features.txt and ml/api/app.py FEATURE_ORDER.
 * Features: early engagement signals only (no delay indicators) to avoid data leakage.
 */

import type { PrismaClient } from "@prisma/client";

/** Must match ml/api/app.py FEATURE_ORDER and ml/features.txt (order matters for API). */
export const FEATURE_KEYS = [
  "early_login_count",
  "early_login_consistency",
  "early_clicks",
  "early_clicks_per_login",
  "unique_resources_early",
  "num_of_prev_attempts",
  "late_registration_score",
  "workload_level",
  "assignments_count",
  "courses_count",
] as const;

export type FeatureVector = {
  [K in (typeof FEATURE_KEYS)[number]]: number;
};

export function defaultFeatureVector(): FeatureVector {
  return {
    early_login_count: 0,
    early_login_consistency: 0,
    early_clicks: 0,
    early_clicks_per_login: 0,
    unique_resources_early: 0,
    num_of_prev_attempts: 0,
    late_registration_score: 0,
    workload_level: 0,
    assignments_count: 0,
    courses_count: 0,
  };
}

export async function buildFeatureVector(
  prisma: PrismaClient,
  studentId: number
): Promise<FeatureVector> {
  const [student] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      include: {
        courses: { include: { assignments: true, exams: true } },
        lmsActivity: true,
      },
    }),
  ]);

  if (!student) return defaultFeatureVector();

  const courses = student.courses;
  const lms = student.lmsActivity;
  const totalAssignments = courses.reduce((s, c) => s + c.assignments.length, 0);
  const pendingExams = courses.reduce(
    (s, c) => s + c.exams.filter((e: { status: string }) => e.status === "Pending").length,
    0
  );

  const early_login_count = lms?.loginCount ?? 0;
  const early_login_consistency =
    early_login_count > 10 ? 0.8 : early_login_count > 5 ? 0.5 : early_login_count > 0 ? 0.2 : 0;
  const early_clicks = 0; // project has no VLE click data
  const early_clicks_per_login = early_login_count > 0 ? 0 : 0; // no clicks data
  const unique_resources_early = 0; // project has no per-resource VLE data
  const num_of_prev_attempts = 0; // project schema has no prev attempts

  const workload_level = Math.min(
    1,
    (totalAssignments + pendingExams) / 20
  );

  let late_registration_score = 0;
  const regScores: number[] = [];
  for (const c of courses) {
    const enrolledAt = (c as { enrolledAt?: Date; courseStartDate?: Date }).enrolledAt;
    const courseStartDate = (c as { enrolledAt?: Date; courseStartDate?: Date }).courseStartDate;
    if (enrolledAt && courseStartDate) {
      const daysOffset =
        (enrolledAt.getTime() - courseStartDate.getTime()) /
        (24 * 60 * 60 * 1000);
      regScores.push(Math.min(1, Math.max(0, (daysOffset + 30) / 60)));
    }
  }
  if (regScores.length > 0) {
    late_registration_score =
      regScores.reduce((a, b) => a + b, 0) / regScores.length;
  }

  return {
    early_login_count,
    early_login_consistency,
    early_clicks,
    early_clicks_per_login,
    unique_resources_early,
    num_of_prev_attempts,
    late_registration_score,
    workload_level,
    assignments_count: totalAssignments,
    courses_count: courses.length,
  };
}

/** Build JSON payload for /predict: same keys as FEATURE_KEYS, all numeric (no NaN/undefined). */
export function featureVectorToPayload(vec: FeatureVector): Record<string, number> {
  const payload: Record<string, number> = {};
  for (const k of FEATURE_KEYS) {
    const v = vec[k];
    payload[k] = typeof v === "number" && Number.isFinite(v) ? v : 0;
  }
  return payload;
}
