import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { z } from "zod";

const campaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  submissionStartAt: z.coerce.date(),
  submissionEndAt: z.coerce.date(),
  votingStartAt: z.coerce.date(),
  votingEndAt: z.coerce.date(),
});

export async function GET() {
  try {
    await requireRole("ADMIN");
    return NextResponse.json(await prisma.campaign.findMany({ orderBy: { createdAt: "desc" } }));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === "FORBIDDEN" ? 403 : 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole("ADMIN");
    const input = campaignSchema.parse(await request.json());
    if (!(input.submissionStartAt < input.submissionEndAt && input.submissionEndAt <= input.votingStartAt && input.votingStartAt < input.votingEndAt)) return NextResponse.json({ error: "Invalid campaign timeline" }, { status: 400 });
    const campaign = await prisma.campaign.create({ data: input });
    await prisma.auditLog.create({ data: { actorId: user.id, action: "CAMPAIGN_CREATED", resourceType: "Campaign", resourceId: campaign.id, newValue: campaign } });
    return NextResponse.json(campaign, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.name === "ZodError" ? 400 : 500 });
  }
}
