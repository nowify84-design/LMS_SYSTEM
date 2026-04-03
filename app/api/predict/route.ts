import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildFeatureVector } from '@/lib/featureVector';
// Placeholder for model prediction (add node-joblib or py call)
import * as joblib from 'joblib-object'; // npm i joblib-object

const MODEL_PATH = 'ml/model/procrastination_model.joblib';

export async function GET() {
  const studentId = await getSession();
  if (!studentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const features = await buildFeatureVector(prisma, studentId);
  // TODO: Load model & predict_proba (class 1 risk)
  const riskScore = 0.65; // Placeholder: implement model load

  return NextResponse.json({
    studentId,
    riskScore,
    features,
    message: 'Procrastination risk computed (model integration pending)',
  });
}

