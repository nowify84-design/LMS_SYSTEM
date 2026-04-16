import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildFeatureVector, featureVectorToPayload } from "@/lib/featureVector";

const FLASK_API_URL = process.env.FLASK_API_URL || "http://127.0.0.1:5000";

/**
 * Prediction uses session-bound features and an outbound call to Flask.
 * POST avoids intermediaries treating the route as a cacheable "safe" GET.
 */
export async function POST() {
  const studentId = await getSession();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const featureVector = await buildFeatureVector(prisma, studentId);
  const payload = featureVectorToPayload(featureVector);

  try {
    const res = await fetch(`${FLASK_API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: "Flask API error", detail: err },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(
      {
        studentId,
        features: featureVector,
        level: data.level,
        percentage: data.percentage,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Flask API unreachable", detail: String(e) },
      { status: 503 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST /api/predict." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
