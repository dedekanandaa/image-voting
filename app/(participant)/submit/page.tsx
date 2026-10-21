import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCurrentCampaign, SUBMISSION_LIMIT } from "@/lib/campaign";
import { prisma } from "@/lib/prisma";
import { getPresignedUrl } from "@/lib/storage";
import { SubmitFlow } from "@/components/submit-flow";

export default async function SubmitPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const openCampaign = await getCurrentCampaign();
  if (openCampaign?.status === "VOTING_OPEN") redirect("/vote");
  const campaign = openCampaign ?? await prisma.campaign.findFirst({
    where: { status: { notIn: ["DRAFT", "ARCHIVED"] } },
    orderBy: { updatedAt: "desc" },
  });

  const rows = campaign ? await prisma.submission.findMany({
    where: { userId: session.user.id, campaignId: campaign.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, imageKey: true, frameId: true, createdAt: true, isSelected: true },
  }) : [];
  const submissions = await Promise.all(rows.map(async ({ imageKey, ...row }) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    imageUrl: await getPresignedUrl(imageKey),
  })));

  return <SubmitFlow name={session.user.name || session.user.email || "Guest"} initialSubmissions={submissions} canSubmit={openCampaign?.status === "SUBMISSION_OPEN"} limit={SUBMISSION_LIMIT} />;
}
