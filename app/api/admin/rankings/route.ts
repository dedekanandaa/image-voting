import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { getPresignedUrl } from "@/lib/storage";

export async function GET(request: Request) {
  try {
    await requireRole("ADMIN");
    const campaignId = new URL(request.url).searchParams.get("campaignId");
    if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });

    const submissions = await prisma.submission.findMany({
      where: { campaignId, isSelected: true, deletedAt: null },
      include: {
        user: { select: { displayName: true, email: true } },
        _count: { select: { votes: { where: { revokedAt: null } } } },
      },
    });

    const data = await Promise.all(
      submissions
        .map((s) => ({
          id: s.id,
          imageKey: s.imageKey,
          title: s.title || s.fileName.replace(/\.[^.]+$/, ""),
          submitter: s.user.displayName || s.user.email,
          votes: s._count.votes,
        }))
        .sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title))
        .map(async ({ imageKey, ...row }, idx) => ({
          rank: idx + 1,
          ...row,
          imageUrl: await getPresignedUrl(imageKey),
        }))
    );

    return NextResponse.json({ timestamp: new Date().toISOString(), data });
  } catch (error: any) {
    const status = error.message === "UNAUTHORIZED" ? 401 : error.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
