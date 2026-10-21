import { auth } from "./auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHORIZED");
  return session.user;
}

export async function requireRole(role: "USER" | "COMMITTEE" | "ADMIN") {
  const user = await requireUser();
  if (!user.roles?.includes(role) && !user.roles?.includes("ADMIN")) throw new Error("FORBIDDEN");
  return user;
}
