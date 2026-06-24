/**
 * Auth.js (next-auth v5) configuration for the governance cloud (TRE-63).
 *
 * Real auth = GitHub OAuth. For zero-setup local dev (no GitHub app), a
 * Credentials "Dev login" provider is registered ONLY when dev bypass is
 * active — it signs in a fixed `dev@vigilis.local` user with no password.
 * It is hard-guarded so it can never register alongside real GitHub creds.
 *
 * On first sign-in we bootstrap the user's home (user row, personal org,
 * admin membership, default API key) via `ensureUserAndOrg`, and stamp
 * `orgId`/`userId`/`role` onto the JWT + session. node:sqlite requires the
 * Node runtime, so anything importing this must run on Node (not Edge).
 */
import NextAuth, { type DefaultSession, type NextAuthResult } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import { ensureUserAndOrg } from '@/db';

const DEV_USER_EMAIL = 'dev@vigilis.local';

/** Are real GitHub OAuth creds configured? */
function hasGitHubCreds(): boolean {
  return Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
}

/**
 * Dev bypass is on when explicitly requested (VIGILIS_CLOUD_DEV=1) OR when no
 * GitHub creds exist — but NEVER when real GitHub creds are present (so a
 * production deployment with GitHub configured can't be backdoored).
 */
export function devBypassEnabled(): boolean {
  if (hasGitHubCreds()) return false;
  return process.env.VIGILIS_CLOUD_DEV === '1' || !hasGitHubCreds();
}

const providers = [];
if (hasGitHubCreds()) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  );
}
if (devBypassEnabled()) {
  providers.push(
    Credentials({
      id: 'dev',
      name: 'Dev login',
      credentials: {},
      // No password: signs in the fixed local dev user.
      authorize() {
        return {
          id: DEV_USER_EMAIL,
          email: DEV_USER_EMAIL,
          name: 'Vigilis Dev',
        };
      },
    }),
  );
}

declare module 'next-auth' {
  interface Session {
    orgId: string;
    userId: string;
    role: string;
    user: DefaultSession['user'];
  }
}

// Annotated with NextAuthResult to avoid TS2742 portability errors under pnpm.
const nextAuth: NextAuthResult = NextAuth({
  providers,
  session: { strategy: 'jwt' },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: { signIn: '/signin' },
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in (`user` present) bootstrap the org and cache ids on the JWT.
      if (user?.email) {
        const ensured = ensureUserAndOrg({
          email: user.email,
          name: user.name,
          image: user.image,
        });
        token.orgId = ensured.orgId;
        token.userId = ensured.userId;
        token.role = ensured.role;
      } else if (!token.orgId && token.email) {
        // Defensive: rehydrate ids if a prior token predates bootstrap.
        const ensured = ensureUserAndOrg({
          email: token.email,
          name: token.name,
          image: token.picture as string | null | undefined,
        });
        token.orgId = ensured.orgId;
        token.userId = ensured.userId;
        token.role = ensured.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.orgId = (token.orgId as string) ?? '';
      session.userId = (token.userId as string) ?? '';
      session.role = (token.role as string) ?? '';
      return session;
    },
  },
});

export const handlers: NextAuthResult['handlers'] = nextAuth.handlers;
export const auth: NextAuthResult['auth'] = nextAuth.auth;
export const signIn: NextAuthResult['signIn'] = nextAuth.signIn;
export const signOut: NextAuthResult['signOut'] = nextAuth.signOut;
