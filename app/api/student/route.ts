import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const studentId = await getSession();
  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      universityId: true,
      name: true,
      email: true,
      major: true,
      phone: true,
      campus: true,
      academicStatus: true,
      degree: true,
      dataConsentAt: true,
    },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  return NextResponse.json(student);
}
