import { prisma } from "./prisma";

export const OPEN_STATUSES = ["SUBMISSION_OPEN", "VOTING_OPEN"] as const;
export const SUBMISSION_LIMIT = 5;

// Status set by admin/committee is the source of truth; campaign dates are informational.
export function getCurrentCampaign() {
  return prisma.campaign.findFirst({
    where: { status: { in: [...OPEN_STATUSES] } },
    orderBy: { updatedAt: "desc" },
  });
}
