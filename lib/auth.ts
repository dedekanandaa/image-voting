import { timingSafeEqual } from "crypto";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Keycloak from "next-auth/providers/keycloak";
import { prisma } from "./prisma";

type Role = "USER" | "COMMITTEE" | "ADMIN";
const APP_ROLES: readonly Role[] = ["USER", "COMMITTEE", "ADMIN"];

type KeycloakProfile = {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
};

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      roles: Role[];
      keycloakId: string;
      isGuest: boolean;
    };
  }
}

function tokenMatches(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
    // Guest link: /guest?token=GUEST_LINK_TOKEN. Identity is bound to the httpOnly
    // guest_device_id cookie (set by /api/auth/guest), so logout + reopen gets the same User.
    Credentials({
      id: "guest",
      credentials: { token: {} },
      async authorize(credentials, request) {
        const expected = process.env.GUEST_LINK_TOKEN;
        const given = String(credentials?.token ?? "");
        if (!expected || !given || !tokenMatches(given, expected)) return null;

        const cookie = request?.headers.get("cookie") ?? "";
        const deviceId = cookie.match(/(?:^|;\s*)guest_device_id=([0-9a-f-]{36})/i)?.[1];
        if (!deviceId) return null;

        const keycloakId = `guest:${deviceId}`;
        const user = await prisma.user.upsert({
          where: { keycloakId },
          update: {},
          create: {
            keycloakId,
            email: `${keycloakId}@guest.local`,
            displayName: "Guest",
            roles: ["USER"],
          },
        });
        return { id: user.id, name: user.displayName, email: user.email, keycloakId };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, profile, user }) {
      // Sign-in only: profile (Keycloak) or user (guest) is present on the first callback.
      if (user && "keycloakId" in user) {
        token.userId = user.id;
        token.keycloakId = user.keycloakId;
        token.roles = ["USER"];
        token.isGuest = true;
        return token;
      }
      if (profile) {
        const claims = profile as KeycloakProfile;
        const roles = (claims.realm_access?.roles ?? []).filter((r): r is Role =>
          APP_ROLES.includes(r as Role)
        );
        const appRoles: Role[] = roles.length ? roles : ["USER"];
        const displayName = claims.name ?? claims.preferred_username ?? null;

        const dbUser = await prisma.user.upsert({
          where: { keycloakId: claims.sub },
          update: {
            email: claims.email ?? `${claims.sub}@keycloak.local`,
            displayName,
            roles: { set: appRoles },
          },
          create: {
            keycloakId: claims.sub,
            email: claims.email ?? `${claims.sub}@keycloak.local`,
            displayName,
            roles: appRoles,
          },
        });

        token.userId = dbUser.id;
        token.keycloakId = dbUser.keycloakId;
        token.roles = dbUser.roles;
        token.isGuest = false;
        token.name = dbUser.displayName ?? token.name;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.keycloakId = token.keycloakId as string;
      session.user.roles = (token.roles as Role[]) ?? ["USER"];
      session.user.isGuest = Boolean(token.isGuest);
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
});
