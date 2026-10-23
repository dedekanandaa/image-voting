import { randomUUID, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const registerSchema = z.object({
  token: z.string(),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(200),
});

function tokenMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Link token gates registration only. Login afterwards uses email + password.
export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { token, name, email, password } = parsed.data;
  const expected = process.env.GUEST_LINK_TOKEN;
  if (!expected || !tokenMatches(token, expected)) {
    return NextResponse.json({ error: "Invalid guest link" }, { status: 401 });
  }

  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  await prisma.user.create({
    data: {
      keycloakId: `guest:${randomUUID()}`,
      email,
      displayName: name,
      passwordHash: await hashPassword(password),
      roles: ["USER"],
    },
  });
  return NextResponse.json({ ok: true });
}
