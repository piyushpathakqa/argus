import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'vigilis-cloud-test-'));
  process.env.VIGILIS_CLOUD_DB = join(tmpDir, 'cloud.db');
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// Import after VIGILIS_CLOUD_DB is set so getDb() opens the temp file.
async function db() {
  return import('./db');
}

function receipt(over: Partial<import('./db').CloudReceipt> = {}): import('./db').CloudReceipt {
  return {
    specPath: 'tests/login.spec.ts',
    url: 'http://localhost:3100/login',
    verdict: 'dom-drift',
    healed: true,
    repo: 'acme/shop',
    timestamp: '2026-06-24T10:00:00.000Z',
    ...over,
  };
}

describe('governance-cloud db', () => {
  it('seeds the Acme Dev org and dev API key', async () => {
    const { findOrgByApiKey, DEV_API_KEY } = await db();
    const org = findOrgByApiKey(DEV_API_KEY);
    expect(org).not.toBeNull();
    expect(org?.name).toBe('Acme Dev');
  });

  it('rejects an unknown API key', async () => {
    const { findOrgByApiKey } = await db();
    expect(findOrgByApiKey('nope')).toBeNull();
    expect(findOrgByApiKey('')).toBeNull();
  });

  it('inserts a receipt and is idempotent on receiptId', async () => {
    const { findOrgByApiKey, DEV_API_KEY, insertReceipt, listReceipts } = await db();
    const org = findOrgByApiKey(DEV_API_KEY)!;

    const r = receipt({ receiptId: 'treeship_abc', verdict: 'flake' });
    const first = insertReceipt(org.id, r);
    expect(first.inserted).toBe(true);

    const second = insertReceipt(org.id, r);
    expect(second.inserted).toBe(false);
    expect(second.id).toBe(first.id);

    const flakes = listReceipts(org.id, { verdict: 'flake' });
    expect(flakes).toHaveLength(1);
  });

  it('dedupes receipts without a receiptId on spec+url+timestamp', async () => {
    const { findOrgByApiKey, DEV_API_KEY, insertReceipt } = await db();
    const org = findOrgByApiKey(DEV_API_KEY)!;
    const r = receipt({ specPath: 'tests/cart.spec.ts', timestamp: '2026-06-24T11:00:00.000Z' });
    expect(insertReceipt(org.id, r).inserted).toBe(true);
    expect(insertReceipt(org.id, r).inserted).toBe(false);
  });

  it('listReceipts filters by verdict and repo', async () => {
    const { findOrgByApiKey, DEV_API_KEY, insertReceipt, listReceipts } = await db();
    const org = findOrgByApiKey(DEV_API_KEY)!;

    insertReceipt(
      org.id,
      receipt({
        receiptId: 'r_realbug',
        verdict: 'real-bug',
        healed: false,
        repo: 'acme/other',
        timestamp: '2026-06-24T12:00:00.000Z',
      }),
    );

    const realBugs = listReceipts(org.id, { verdict: 'real-bug' });
    expect(realBugs.every((row) => row.verdict === 'real-bug')).toBe(true);
    expect(realBugs.length).toBeGreaterThanOrEqual(1);

    const byRepo = listReceipts(org.id, { repo: 'acme/other' });
    expect(byRepo.every((row) => row.repo === 'acme/other')).toBe(true);
    expect(byRepo.length).toBeGreaterThanOrEqual(1);
  });
});
