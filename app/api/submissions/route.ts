import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authorization";
import { uploadImage, getPresignedUrl, deleteImage } from "@/lib/storage";
import { getCurrentCampaign, SUBMISSION_LIMIT } from "@/lib/campaign";
import { isFrameId } from "@/lib/frames";

// ponytail: frame is composited client-side, so a direct API call can upload an unframed JPEG.
// Composite server-side with sharp if frames must be guaranteed.
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");
    const frameId = String(formData.get("frameId") || "");
    if (!(file instanceof File) || file.type !== "image/jpeg") return NextResponse.json({ error: "Framed JPEG image required" }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Maximum file size is 20MB" }, { status: 400 });
    const magic = new Uint8Array(await file.slice(0, 2).arrayBuffer());
    if (magic[0] !== 0xff || magic[1] !== 0xd8) return NextResponse.json({ error: "Framed JPEG image required" }, { status: 400 });
    if (!isFrameId(frameId)) return NextResponse.json({ error: "Valid frame required" }, { status: 400 });
    const title = String(formData.get("title") || "").trim().slice(0, 100) || null;

    const campaign = await getCurrentCampaign();
    if (campaign?.status !== "SUBMISSION_OPEN") return NextResponse.json({ error: "Submission phase is not active" }, { status: 400 });
    const count = await prisma.submission.count({ where: { userId: user.id, campaignId: campaign.id, deletedAt: null } });
    if (count >= SUBMISSION_LIMIT) return NextResponse.json({ error: `Maximum ${SUBMISSION_LIMIT} submissions per campaign` }, { status: 400 });

    const { key, hash } = await uploadImage(file, file.name);
    try {
      const { imageKey, imageHash, ...submission } = await prisma.submission.create({ data: { campaignId: campaign.id, userId: user.id, imageKey: key, imageHash: hash, fileName: file.name, fileSize: file.size, mimeType: file.type, frameId, title } });
      return NextResponse.json({ ...submission, imageUrl: await getPresignedUrl(key) }, { status: 201 });
    } catch (dbError) {
      await deleteImage(key).catch(() => {});
      throw dbError;
    }
  } catch (error: any) {
    const status = error.message === "UNAUTHORIZED" ? 401 : error.message === "UNSUPPORTED_TYPE" ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "Upload failed" : error.message }, { status });
  }
}
