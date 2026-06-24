/**
 * API key management (TRE-63). Server component + server actions. Lists the
 * org's keys, mints new ones (plaintext shown ONCE), and revokes. Node runtime
 * (node:sqlite). The freshly-minted plaintext is surfaced via a one-shot
 * `?new=` query param — it is never persisted in plaintext.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { createApiKey, listApiKeys, revokeApiKey, getOrg, type ApiKeyRow } from '@/db';

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').slice(0, 19);
}

async function createKeyAction(formData: FormData) {
  'use server';
  const session = await auth();
  if (!session?.orgId) redirect('/signin');
  const name = String(formData.get('name') ?? '').trim() || 'API key';
  const { plaintext } = createApiKey(session.orgId, name);
  revalidatePath('/keys');
  // Pass the plaintext back exactly once via the URL; it is shown then lost.
  redirect(`/keys?new=${encodeURIComponent(plaintext)}`);
}

async function revokeKeyAction(formData: FormData) {
  'use server';
  const session = await auth();
  if (!session?.orgId) redirect('/signin');
  const id = String(formData.get('id') ?? '');
  if (id) revokeApiKey(session.orgId, id);
  revalidatePath('/keys');
  redirect('/keys');
}

export default async function KeysPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await auth();
  if (!session?.orgId) redirect('/signin');

  const org = getOrg(session.orgId);
  const keys: ApiKeyRow[] = listApiKeys(session.orgId);
  const sp = await searchParams;
  const justCreated = sp.new?.trim() || undefined;

  return (
    <main className="wrap">
      <header className="page">
        <div className="mark">
          VIGILIS<span className="b">·</span>CLOUD
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <h1>API keys</h1>
          <div className="mono dim" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>{org?.name ?? session.orgId}</span>
            <a href="/">Dashboard</a>
          </div>
        </div>
        <p>
          Keys authenticate the agent&apos;s ingest calls (Bearer token). Treat them like passwords —
          the full value is shown only once, at creation.
        </p>
      </header>

      {justCreated && (
        <div className="empty" style={{ borderColor: '#3a6', background: 'rgba(50,160,90,0.08)' }}>
          New key created. Copy it now — it will not be shown again:
          <br />
          <code className="mono">{justCreated}</code>
        </div>
      )}

      <form className="filters" action={createKeyAction}>
        <label>
          Name
          <input type="text" name="name" placeholder="CI key" />
        </label>
        <button type="submit">Create key</button>
      </form>

      {keys.length === 0 ? (
        <div className="empty">No keys yet. Create one above.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Created</th>
              <th>Last used</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td>{k.name ?? <span className="dim">—</span>}</td>
                <td className="mono dim">{k.masked ?? '—'}</td>
                <td className="mono dim">{fmtTime(k.created_at)}</td>
                <td className="mono dim">{fmtTime(k.last_used_at)}</td>
                <td>
                  <span className={`tag ${k.revoked_at ? 'unhealed' : 'healed'}`}>
                    {k.revoked_at ? 'revoked' : 'active'}
                  </span>
                </td>
                <td>
                  {k.revoked_at ? (
                    <span className="dim">—</span>
                  ) : (
                    <form action={revokeKeyAction}>
                      <input type="hidden" name="id" value={k.id} />
                      <button type="submit">Revoke</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
