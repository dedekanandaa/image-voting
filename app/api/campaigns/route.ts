import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";

export async function GET() {
  try {
    await requireRole("COMMITTEE");
    const campaigns = await prisma.campaign.findMany({
      orderBy: { updatedAt: "desc" },
      where: { status: { notIn: ["DRAFT", "ARCHIVED"] } },
      select: { id: true, name: true, status: true },
    });
    return NextResponse.json(campaigns);
  } catch (error: any) {
    const status = error.message === "UNAUTHORIZED" ? 401 : error.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
