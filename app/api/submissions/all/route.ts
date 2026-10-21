import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { getPresignedUrl } from "@/lib/storage";

export async function GET(request: Request) {
  try {
    await requireRole("COMMITTEE");
    const campaignId = new URL(request.url).searchParams.get("campaignId");
    const submissions = await prisma.submission.findMany({
      where: { campaignId: campaignId || undefined, deletedAt: null },
      include: { _count: { select: { votes: true } }, user: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(await Promise.all(submissions.map(async ({ imageKey, imageHash, user, _count, ...submission }) => ({
      ...submission,
      submitterName: user.displayName || user.email,
      imageUrl: await getPresignedUrl(imageKey),
      voteCount: _count.votes,
    }))));
  } catch (error: any) {
    const status = error.message === "UNAUTHORIZED" ? 401 : error.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
