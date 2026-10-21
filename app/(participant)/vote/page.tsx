import { redirect } from "next/navigation";
import { getCurrentCampaign } from "@/lib/campaign";
import { Ballot } from "./ballot";

export default async function VotePage() {
  const campaign = await getCurrentCampaign();
  if (campaign?.status !== "VOTING_OPEN") redirect("/submit");
  return <Ballot />;
}
