/**
 * Dev/local audit dashboard (TRE-65, minimal). Server component.
 * Reads receipts directly from node:sqlite, so it must run on the Node runtime
 * and never at build time (force-dynamic).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { devOrgId, listReceipts, type ReceiptRow } from '@/db';

const VERDICTS = ['real-bug', 'dom-drift', 'flake'];

function verdictClass(verdict: string): string {
  return VERDICTS.includes(verdict) ? verdict : 'dim';
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').slice(0, 19);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string; verdict?: string }>;
}) {
  const sp = await searchParams;
  const repo = sp.repo?.trim() || undefined;
  const verdict = sp.verdict?.trim() || undefined;

  const rows: ReceiptRow[] = listReceipts(devOrgId(), { repo, verdict });

  return (
    <main className="wrap">
      <header className="page">
        <div className="mark">
          VIGILIS<span className="b">·</span>CLOUD
        </div>
        <h1>Audit dashboard</h1>
        <p>
          Local/dev governance cloud. Heal and refusal receipts reported by a configured agent
          (<span className="mono">VIGILIS_CLOUD_KEY</span>) for the seeded <strong>Acme Dev</strong> org.
          Attestation is verifiable and auditable — it records what happened, not whether the
          agent&apos;s judgment was correct.
        </p>
      </header>

      <form className="filters" method="get">
        <label>
          Repo
          <input type="text" name="repo" defaultValue={repo ?? ''} placeholder="owner/name" />
        </label>
        <label>
          Verdict
          <select name="verdict" defaultValue={verdict ?? ''}>
            <option value="">all</option>
            {VERDICTS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Filter</button>
        {(repo || verdict) && (
          <a className="clear" href="/">
            clear
          </a>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="empty">
          No receipts yet. Point an agent at this cloud with{' '}
          <code>VIGILIS_CLOUD_URL=http://localhost:3300 VIGILIS_CLOUD_KEY=vigilis_dev_key</code>.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Repo</th>
              <th>Spec</th>
              <th>Verdict</th>
              <th>Healed</th>
              <th>Time</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.repo ?? <span className="dim">—</span>}</td>
                <td className="mono">{r.spec_path}</td>
                <td>
                  <span className={`tag ${verdictClass(r.verdict)}`}>{r.verdict}</span>
                </td>
                <td>
                  <span className={`tag ${r.healed ? 'healed' : 'unhealed'}`}>
                    {r.healed ? 'healed' : 'no'}
                  </span>
                </td>
                <td className="mono dim">{fmtTime(r.created_at)}</td>
                <td>
                  {r.receipt_url ? (
                    <a href={r.receipt_url} target="_blank" rel="noreferrer">
                      verify
                    </a>
                  ) : (
                    <span className="dim">—</span>
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
