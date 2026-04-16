/**
 * GET /api/features
 * Returns the ML feature vector for the authenticated student.
 * Features are computed from database (assignments, exams, courses, tasks, lms_activity).
 * Aligns with ml/features.txt, lib/featureVector.ts FEATURE_KEYS, and Flask POST /predict.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildFeatureVector,
  featureVectorToPayload,
  FEATURE_KEYS,
} from "@/lib/featureVector";

export async function GET() {
  const studentId = await getSession();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vector = await buildFeatureVector(prisma, studentId);
  const payload = featureVectorToPayload(vector);

  return NextResponse.json({
    studentId,
    features: payload,
    featureKeys: FEATURE_KEYS,
  });
}
