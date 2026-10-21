import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { OPEN_STATUSES } from "@/lib/campaign";
import { z } from "zod";

const statusSchema = z.object({ status: z.enum(["DRAFT", "SUBMISSION_OPEN", "SUBMISSION_CLOSED", "VOTING_OPEN", "VOTING_CLOSED", "PUBLISHED", "ARCHIVED"]) });

function errorStatus(error: any) {
  if (error.name === "ZodError") return 400;
  if (error.message === "UNAUTHORIZED") return 401;
  if (error.message === "FORBIDDEN") return 403;
  return 500;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(campaign);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: errorStatus(error) });
  }
}

// Committee can only switch the live participant page; admin can set any status.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("COMMITTEE");
    const { id } = await params;
    const body = statusSchema.parse(await request.json());
    const isOpenStatus = (OPEN_STATUSES as readonly string[]).includes(body.status);
    if (!user.roles?.includes("ADMIN") && !isOpenStatus) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (isOpenStatus) {
      const otherOpen = await prisma.campaign.count({ where: { id: { not: id }, status: { in: [...OPEN_STATUSES] } } });
      if (otherOpen) return NextResponse.json({ error: "Another campaign is already open" }, { status: 409 });
    }

    const updated = await prisma.campaign.update({ where: { id }, data: { status: body.status } });
    await prisma.auditLog.create({ data: { actorId: user.id, action: "CAMPAIGN_UPDATED", resourceType: "Campaign", resourceId: id, oldValue: { status: campaign.status }, newValue: { status: body.status } } });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: errorStatus(error) });
  }
}
