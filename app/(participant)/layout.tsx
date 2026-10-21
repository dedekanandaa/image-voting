import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const roles = session.user.roles ?? [];
  const isCommittee = roles.includes("COMMITTEE") || roles.includes("ADMIN");
  const isAdmin = roles.includes("ADMIN");

  return (
    <div className="min-h-screen bg-[#fffaf5] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-rose-100/80 bg-[#fffaf5]/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/submit" className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-rose-500">Photo party</span>
            <span className="block truncate font-serif text-base font-semibold">Hi, {session.user.name || session.user.email || "Guest"}</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-semibold">
            {isCommittee && <Link href="/committee/review" className="rounded-full px-3 py-2 hover:bg-rose-50">Review</Link>}
            {isAdmin && <Link href="/admin/campaigns" className="rounded-full px-3 py-2 hover:bg-rose-50">Admin</Link>}
            <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
              <button className="rounded-full px-3 py-2 text-slate-500 hover:bg-slate-100">Sign out</button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
