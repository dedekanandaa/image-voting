import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Invitation } from "@/components/invitation";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  if (await auth()) redirect("/submit");
  const query = await searchParams;
  return <Invitation callbackUrl={query.callbackUrl} error={query.error} />;
}
