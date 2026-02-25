import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSession } from "@/lib/auth";
import * as bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { universityId, password } = body;
    if (!universityId || !password) {
      return NextResponse.json(
        { error: "University ID and password required" },
        { status: 400 }
      );
    }
    const student = await prisma.student.findUnique({
      where: { universityId: String(universityId).trim() },
    });
    if (!student) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const ok = await bcrypt.compare(password, student.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    await setSession(student.id);
    return NextResponse.json({
      ok: true,
      studentId: student.id,
      universityId: student.universityId,
      name: student.name,
    });
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
