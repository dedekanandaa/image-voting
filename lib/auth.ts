import NextAuth, { type DefaultSession } from "next-auth";
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
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],
  callbacks: {
    async jwt({ token, profile }) {
      // Sign-in only: profile is present on the first callback after OIDC login.
      if (profile) {
        const claims = profile as KeycloakProfile;
        const roles = (claims.realm_access?.roles ?? []).filter((r): r is Role =>
          APP_ROLES.includes(r as Role)
        );
        const appRoles: Role[] = roles.length ? roles : ["USER"];
        const displayName = claims.name ?? claims.preferred_username ?? null;

        const user = await prisma.user.upsert({
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

        token.userId = user.id;
        token.keycloakId = user.keycloakId;
        token.roles = user.roles;
        token.name = user.displayName ?? token.name;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.keycloakId = token.keycloakId as string;
      session.user.roles = (token.roles as Role[]) ?? ["USER"];
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
});
