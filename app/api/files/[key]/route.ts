import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authorization";
import { resolveUploadPath } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const user = await requireUser();
    const { key } = await params;
    const filePath = resolveUploadPath(key);
    const submission = await prisma.submission.findFirst({ where: { imageKey: key } });
    if (!submission || submission.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isPrivileged = user.roles?.includes("COMMITTEE") || user.roles?.includes("ADMIN");
    if (submission.userId !== user.id && !isPrivileged && !submission.isSelected) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const file = await readFile(filePath);
    return new NextResponse(file, {
      headers: {
        "Content-Type": submission.mimeType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    const status = error.message === "UNAUTHORIZED" ? 401 : error.message === "INVALID_KEY" ? 400 : 404;
    return NextResponse.json({ error: status === 404 ? "Not found" : error.message }, { status });
  }
}
