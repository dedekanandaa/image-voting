import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "guest_device_id";

function tokenMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expected = process.env.GUEST_LINK_TOKEN;
  const given = String((await request.json().catch(() => ({}))).token || "");
  if (!expected || !given || !tokenMatches(given, expected)) {
    return NextResponse.json({ error: "Invalid guest link" }, { status: 401 });
  }

  const existing = request.cookies.get(COOKIE_NAME)?.value;
  const deviceId = existing && /^[0-9a-f-]{36}$/i.test(existing) ? existing : crypto.randomUUID();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}
