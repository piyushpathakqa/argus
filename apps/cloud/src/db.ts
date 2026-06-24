/**
 * Governance-cloud data layer (TRE-62/64).
 *
 * Uses Node's built-in `node:sqlite` (Node 24+) — no Prisma, no native engine.
 * Any Next.js route/page importing this module MUST declare
 * `export const runtime = 'nodejs'` (node:sqlite is unavailable on Edge).
 *
 * The cloud only consumes the `CloudReceipt` shape from the OSS core — it never
 * imports the agent. The type is re-declared here (the published @argus/core
 * surface) so the cloud stays decoupled from core's build output.
 */
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Metadata sent to the governance cloud ingest endpoint. Matches @argus/core CloudReceipt. */
export interface CloudReceipt {
  specPath: string;
  url: string;
  verdict: string;
  healed: boolean;
  rationale?: string;
  suggestedSelector?: string;
  framework?: string;
  repo?: string;
  receiptId?: string;
  receiptUrl?: string;
  timestamp: string;
}

export interface OrgRow {
  id: string;
  name: string;
  plan: string;
  created_at: string;
}

export interface ReceiptRow {
  id: string;
  org_id: string;
  repo: string | null;
  spec_path: string;
  url: string;
  verdict: string;
  healed: number;
  rationale: string | null;
  suggested_selector: string | null;
  framework: string | null;
  receipt_id: string | null;
  receipt_url: string | null;
  created_at: string;
  ingested_at: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load node:sqlite via a runtime require so bundlers (Vite/Vitest, Next/webpack)
 * don't try to statically resolve the built-in (it's listed in builtinModules
 * only under its `node:` specifier, which trips Vite's externalization).
 */
type DatabaseSyncCtor = new (path: string) => {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  close(): void;
};
type DatabaseSync = InstanceType<DatabaseSyncCtor>;
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire('node:sqlite') as {
  DatabaseSync: DatabaseSyncCtor;
};

/** Plaintext dev API key seeded for local use. */
export const DEV_API_KEY = 'vigilis_dev_key';
const DEV_ORG_ID = 'org_acme_dev';
const DEV_KEY_ID = 'key_acme_dev';

function dbPath(): string {
  return (
    process.env.VIGILIS_CLOUD_DB ??
    resolve(__dirname, '..', '.data', 'cloud.db')
  );
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

let cached: DatabaseSync | null = null;
let cachedPath: string | null = null;

/** Open (memoized per path) the SQLite DB, creating schema + dev seed. */
export function getDb(): DatabaseSync {
  const path = dbPath();
  if (cached && cachedPath === path) return cached;
  if (cached) {
    cached.close();
    cached = null;
  }
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  migrate(db);
  seed(db);
  cached = db;
  cachedPath = path;
  return db;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS org (
      id TEXT PRIMARY KEY,
      name TEXT,
      plan TEXT DEFAULT 'free',
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS api_key (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      name TEXT,
      key_hash TEXT,
      created_at TEXT,
      revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS receipt (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      repo TEXT,
      spec_path TEXT,
      url TEXT,
      verdict TEXT,
      healed INTEGER,
      rationale TEXT,
      suggested_selector TEXT,
      framework TEXT,
      receipt_id TEXT,
      receipt_url TEXT,
      created_at TEXT,
      ingested_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_receipt_org_created
      ON receipt (org_id, created_at);
  `);
}

/** Idempotent dev seed: an "Acme Dev" org + a known API key. */
function seed(db: DatabaseSync): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO org (id, name, plan, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(DEV_ORG_ID, 'Acme Dev', 'free', now);
  db.prepare(
    `INSERT OR IGNORE INTO api_key (id, org_id, name, key_hash, created_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
  ).run(DEV_KEY_ID, DEV_ORG_ID, 'dev key', sha256(DEV_API_KEY), now);
}

/** Look up the owning org for a plaintext API key. Rejects revoked keys. Returns null if unknown. */
export function findOrgByApiKey(plaintextKey: string): OrgRow | null {
  if (!plaintextKey) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT o.id AS id, o.name AS name, o.plan AS plan, o.created_at AS created_at
         FROM api_key k
         JOIN org o ON o.id = k.org_id
        WHERE k.key_hash = ? AND k.revoked_at IS NULL`,
    )
    .get(sha256(plaintextKey)) as OrgRow | undefined;
  return row ?? null;
}

/** Stable dedupe key when no Treeship receiptId is present. */
function dedupeHash(r: CloudReceipt): string {
  return sha256(`${r.specPath} ${r.url} ${r.timestamp}`);
}

export type InsertResult = { inserted: boolean; id: string };

/**
 * Insert a receipt. Idempotent:
 *   - if receiptId is present, dedupe on (org_id, receipt_id);
 *   - otherwise dedupe on a hash of (specPath, url, timestamp) stored as receipt_id.
 * Re-sends are a no-op and return { inserted: false }.
 */
export function insertReceipt(orgId: string, r: CloudReceipt): InsertResult {
  const db = getDb();
  const dedupeId = r.receiptId ?? `auto_${dedupeHash(r)}`;

  const existing = db
    .prepare(`SELECT id FROM receipt WHERE org_id = ? AND receipt_id = ?`)
    .get(orgId, dedupeId) as { id: string } | undefined;
  if (existing) return { inserted: false, id: existing.id };

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO receipt
       (id, org_id, repo, spec_path, url, verdict, healed, rationale,
        suggested_selector, framework, receipt_id, receipt_url,
        created_at, ingested_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    orgId,
    r.repo ?? null,
    r.specPath,
    r.url,
    r.verdict,
    r.healed ? 1 : 0,
    r.rationale ?? null,
    r.suggestedSelector ?? null,
    r.framework ?? null,
    dedupeId,
    r.receiptUrl ?? null,
    r.timestamp,
    now,
  );
  return { inserted: true, id };
}

export interface ListFilter {
  repo?: string;
  verdict?: string;
}

/** List an org's receipts (newest first), optionally filtered by repo/verdict. */
export function listReceipts(orgId: string, filter: ListFilter = {}): ReceiptRow[] {
  const db = getDb();
  const clauses = ['org_id = ?'];
  const params: unknown[] = [orgId];
  if (filter.repo) {
    clauses.push('repo = ?');
    params.push(filter.repo);
  }
  if (filter.verdict) {
    clauses.push('verdict = ?');
    params.push(filter.verdict);
  }
  return db
    .prepare(
      `SELECT * FROM receipt
        WHERE ${clauses.join(' AND ')}
        ORDER BY created_at DESC, ingested_at DESC`,
    )
    .all(...(params as never[])) as ReceiptRow[];
}

/** The seeded dev org id (used by the dashboard before real auth lands). */
export function devOrgId(): string {
  return DEV_ORG_ID;
}
