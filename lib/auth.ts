/**
 * Simple session auth: sign studentId in a cookie, verify on each request.
 * Use NEXTAUTH_SECRET or SESSION_SECRET in .env.
 */

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "nowify_session";
const SECRET = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET || "dev-secret-change-in-production";

function sign(value: string): string {
  const h = createHmac("sha256", SECRET);
  h.update(value);
  return value + "." + h.digest("hex").slice(0, 32);
}

function verify(signed: string): string | null {
  const i = signed.lastIndexOf(".");
  if (i === -1) return null;
  const value = signed.slice(0, i);
  const sig = signed.slice(i + 1);
  const expected = sign(value);
  const expectedSig = expected.slice(expected.lastIndexOf(".") + 1);
  try {
    if (sig.length !== expectedSig.length || !timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expectedSig, "utf8"))) return null;
    return value;
  } catch {
    return null;
  }
}

export async function setSession(studentId: number): Promise<void> {
  const c = await cookies();
  const signed = sign(String(studentId));
  c.set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function getSession(): Promise<number | null> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const studentId = verify(raw);
  if (!studentId) return null;
  const n = parseInt(studentId, 10);
  return Number.isInteger(n) ? n : null;
}

export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}
