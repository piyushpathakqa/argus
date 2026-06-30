import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vigilis-demo-test-'));
  process.env.VIGILIS_CLOUD_DB = join(tmpDir, 'cloud.db');
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// Import after VIGILIS_CLOUD_DB is set so getDb() opens the temp file.
async function mods() {
  const db = await import('./db');
  const seed = await import('./demo-seed');
  return { ...db, ...seed };
}

describe('seedDemo (TRE-60)', () => {
  const NOW = Date.parse('2026-06-30T12:00:00Z');

  it('seeds the Acme story: 3 repos, all verdicts, the refused real-bug', async () => {
    const m = await mods();
    const { orgId } = m.ensureUserAndOrg({ email: 'seed@vigilis.local', name: 'Seed' });
    const result = m.seedDemo(orgId, NOW);

    expect(result.orgName).toBe('Acme Inc');
    expect(m.getOrg(orgId)?.name).toBe('Acme Inc');
    expect(m.getOrg(orgId)?.plan).toBe('free');
    expect(result.receiptsInserted).toBe(result.receiptsTotal);

    // 3 distinct repos so Free's 1-repo limit is exceeded (drives the nudge).
    expect(m.distinctReposForOrg(orgId)).toBe(3);

    const rows = m.getReceiptsForOrg(orgId);
    const verdicts = new Set(rows.map((r) => r.verdict));
    expect(verdicts).toEqual(new Set(['dom-drift', 'real-bug', 'flake']));

    // The star: at least one real-bug that was NOT healed and carries a rationale.
    const refused = rows.filter((r) => r.verdict === 'real-bug' && r.healed === 0);
    expect(refused.length).toBeGreaterThan(0);
    expect(refused.every((r) => (r.rationale ?? '').length > 0)).toBe(true);
  });

  it('is idempotent and resets plan to free', async () => {
    const m = await mods();
    const { orgId } = m.ensureUserAndOrg({ email: 'seed@vigilis.local', name: 'Seed' });
    const first = m.seedDemo(orgId, NOW);
    const before = m.getReceiptsForOrg(orgId).length;

    // Simulate a demo where the presenter upgraded, then reset.
    m.applyPlan(orgId, 'enterprise');
    const second = m.seedDemo(orgId, NOW);

    expect(second.receiptsInserted).toBe(0); // nothing new inserted
    expect(m.getReceiptsForOrg(orgId).length).toBe(before); // no duplicates
    expect(m.getOrg(orgId)?.plan).toBe('free'); // plan reset
    expect(first.receiptsTotal).toBe(second.receiptsTotal);
  });
});
