import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authorization";
import { getPresignedUrl, deleteImage } from "@/lib/storage";

function errorStatus(message: string) {
  if (message === "UNAUTHORIZED") return 401;
  if (message === "FORBIDDEN") return 403;
  return 500;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (submission.userId !== user.id && !user.roles?.includes("COMMITTEE") && !user.roles?.includes("ADMIN")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const votes = await prisma.vote.count({ where: { submissionId: id, revokedAt: null } });
    const { imageKey, imageHash, ...safe } = submission;
    return NextResponse.json({ ...safe, imageUrl: await getPresignedUrl(imageKey), voteCount: votes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: errorStatus(error.message) });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (submission.userId !== user.id && !user.roles?.includes("ADMIN")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (submission.deletedAt) return NextResponse.json({ error: "Already deleted" }, { status: 409 });

    await prisma.submission.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: user.id } });
    await deleteImage(submission.imageKey).catch((e) => console.error("deleteImage failed", submission.imageKey, e));
    await prisma.auditLog.create({ data: { actorId: user.id, action: "SUBMISSION_DELETE", resourceType: "Submission", resourceId: id, submissionId: id } });
    return NextResponse.json({ deleted: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: errorStatus(error.message) });
  }
}
