import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const studentId = await getSession();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.student.update({
    where: { id: studentId },
    data: { dataConsentAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
