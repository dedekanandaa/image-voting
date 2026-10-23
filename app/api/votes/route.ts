import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authorization";
import { getPresignedUrl } from "@/lib/storage";
import { getCurrentCampaign } from "@/lib/campaign";
import { z } from "zod";

const voteSchema = z.object({
  campaignId: z.string(),
  votes: z.array(z.object({ submissionId: z.string(), rank: z.number().int().min(1).max(5) })).length(5),
});

const REQUIRED_VOTES_ERROR = "Please select exactly 5 images";

// Finalists only, active campaign only. Caller's own finalists are listed but flagged isOwn.
export async function GET() {
  try {
    const user = await requireUser();
    const campaign = await getCurrentCampaign();
    if (campaign?.status !== "VOTING_OPEN") return NextResponse.json({ campaign: null, submissions: [], userVotes: [] });

    const rows = await prisma.submission.findMany({
      where: { campaignId: campaign.id, isSelected: true, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, imageKey: true, title: true, fileName: true, userId: true },
    });
    const userVotes = await prisma.vote.findMany({
      where: { userId: user.id, campaignId: campaign.id, revokedAt: null },
      orderBy: { rank: "asc" },
      select: { submissionId: true, rank: true },
    });
    const hasVoted = userVotes.length > 0;
    const submissions = await Promise.all(rows.map(async (submission) => ({
      id: submission.id,
      title: submission.title || submission.fileName.replace(/\.[^.]+$/, ""),
      imageUrl: await getPresignedUrl(submission.imageKey),
      isOwn: submission.userId === user.id,
    })));
    const userVotesData = await Promise.all(
      userVotes.map(async (vote) => {
        const submission = rows.find((r) => r.id === vote.submissionId);
        if (!submission) return null;
        return {
          id: submission.id,
          title: submission.title || submission.fileName.replace(/\.[^.]+$/, ""),
          imageUrl: await getPresignedUrl(submission.imageKey),
          rank: vote.rank,
        };
      })
    );
    return NextResponse.json({ campaign: { id: campaign.id, name: campaign.name }, submissions, hasVoted, userVotes: userVotesData.filter(Boolean) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = voteSchema.parse(await request.json());
    const ranks = body.votes.map((vote) => vote.rank);
    const submissionIds = body.votes.map((vote) => vote.submissionId);
    if (new Set(ranks).size !== ranks.length || new Set(submissionIds).size !== submissionIds.length) {
      return NextResponse.json({ error: "Ranks and submissions must be unique" }, { status: 400 });
    }

    const campaign = await getCurrentCampaign();
    if (campaign?.id !== body.campaignId || campaign.status !== "VOTING_OPEN") return NextResponse.json({ error: "Voting phase not active" }, { status: 400 });
    const valid = await prisma.submission.count({
      where: { id: { in: submissionIds }, campaignId: campaign.id, isSelected: true, deletedAt: null, userId: { not: user.id } },
    });
    if (valid !== submissionIds.length) return NextResponse.json({ error: "Only other users' selected finalists can be voted" }, { status: 400 });

    // One ballot per user per campaign. Checked inside the transaction so parallel POSTs can't both pass.
    const alreadyVoted = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.vote.count({ where: { userId: user.id, campaignId: campaign.id, revokedAt: null } });
      if (existing > 0) return true;
      await tx.vote.createMany({ data: body.votes.map((vote) => ({ ...vote, userId: user.id, campaignId: campaign.id })) });
      return false;
    });
    if (alreadyVoted) return NextResponse.json({ error: "You have already voted" }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.name === "ZodError" ? "Invalid ballot" : error.message }, { status: error.message === "UNAUTHORIZED" ? 401 : 400 });
  }
}
