/**
 * Sign-in page (TRE-63). "Sign in with GitHub" always; "Dev login" appears
 * only when the no-GitHub dev bypass is active. Server actions trigger the
 * Auth.js sign-in flow. Node runtime (auth bootstrap touches node:sqlite).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { auth, signIn, devBypassEnabled } from '@/auth';

export default async function SignInPage() {
  const session = await auth();
  if (session?.orgId) redirect('/');

  const devOn = devBypassEnabled();
  const githubOn = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);

  return (
    <main className="wrap">
      <header className="page">
        <div className="mark">
          VIGILIS<span className="b">·</span>CLOUD
        </div>
        <h1>Sign in</h1>
        <p>
          The trust layer for autonomous testing. Sign in to view your org&apos;s verifiable,
          auditable heal and refusal receipts.
        </p>
      </header>

      <div className="filters" style={{ flexDirection: 'column', alignItems: 'stretch', maxWidth: 360 }}>
        {githubOn && (
          <form
            action={async () => {
              'use server';
              await signIn('github', { redirectTo: '/' });
            }}
          >
            <button type="submit" style={{ width: '100%' }}>
              Sign in with GitHub
            </button>
          </form>
        )}

        {devOn && (
          <form
            action={async () => {
              'use server';
              await signIn('dev', { redirectTo: '/' });
            }}
          >
            <button type="submit" style={{ width: '100%' }}>
              Dev login
            </button>
          </form>
        )}

        {!githubOn && !devOn && (
          <div className="empty">
            No sign-in method configured. Set <code>AUTH_GITHUB_ID</code>/<code>AUTH_GITHUB_SECRET</code>{' '}
            or <code>VIGILIS_CLOUD_DEV=1</code>.
          </div>
        )}
      </div>
    </main>
  );
}
