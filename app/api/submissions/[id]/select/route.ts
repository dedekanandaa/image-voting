import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { z } from "zod";

const selectSchema = z.object({ isSelected: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("COMMITTEE");
    const { id } = await params;
    const body = selectSchema.parse(await request.json());
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const action = body.isSelected ? "IMAGE_SELECTED" : "IMAGE_DESELECTED";
    const updated = await prisma.submission.update({ where: { id }, data: { isSelected: body.isSelected, selectedAt: body.isSelected ? new Date() : null, selectedBy: body.isSelected ? user.id : null } });
    await prisma.auditLog.create({ data: { actorId: user.id, action, resourceType: "Submission", resourceId: id, oldValue: { isSelected: submission.isSelected }, newValue: { isSelected: body.isSelected }, submissionId: id } });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === "UNAUTHORIZED" ? 401 : error.message === "FORBIDDEN" ? 403 : 500 });
  }
}
