import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";

function isAppUserId(id: string | undefined): id is string {
  return Boolean(id && id.length > 0);
}

/**
 * תצורת Auth.js ללא DB בשורש הקובץ — בטוח ל-import מ-middleware (Edge).
 * קריאות ל-Drizzle/pg נטענות ב-dynamic import רק כשה-callbacks רצים ב-Node.
 */
export const authConfig = {
  trustHost: true,
  providers: [
    Credentials({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const { authorizeCredentials } = await import(
          "@/lib/auth/authorize-credentials"
        );
        return authorizeCredentials(credentials);
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          Facebook({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "credentials" && user.email) {
        console.warn(
          "[auth] OAuth sign-in should validate invitation email before MVP release:",
          user.email,
        );
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      /* middleware רץ ב-Edge — בלי pg/Drizzle */
      if (
        typeof globalThis !== "undefined" &&
        "EdgeRuntime" in globalThis
      ) {
        return token;
      }

      const userId = user?.id ?? token.sub;
      if (!isAppUserId(userId)) {
        return token;
      }

      if (user || trigger === "update") {
        const { loadUserRolesAndLocale } = await import(
          "@/lib/auth/load-user-roles-for-jwt"
        );
        const { roles, locale } = await loadUserRolesAndLocale(userId);
        token.sub = userId;
        token.roles = roles;
        token.locale = locale;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.roles = Array.isArray(token.roles) ? token.roles : [];
        session.user.locale =
          typeof token.locale === "string" ? token.locale : "he";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
