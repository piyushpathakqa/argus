/**
 * Retention prune cron (TRE-69). Deletes receipts past each org's plan window.
 *
 * Designed for Vercel Cron, which invokes scheduled paths via GET with an
 * `Authorization: Bearer <CRON_SECRET>` header when CRON_SECRET is set. We
 * accept GET (cron) and POST (manual trigger). When no CRON_SECRET is
 * configured, only the local dev bypass (VIGILIS_CLOUD_DEV=1) may run it.
 *
 * Wire the schedule at deploy time, e.g. in vercel.ts:
 *   crons: [{ path: '/api/cron/prune', schedule: '0 4 * * *' }]
 *
 * node:sqlite requires the Node runtime.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { pruneExpiredReceipts } from '@/db';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    return (req.headers.get('authorization') ?? '') === `Bearer ${secret}`;
  }
  // No secret configured: allow only the explicit local dev bypass.
  return process.env.VIGILIS_CLOUD_DEV === '1';
}

function handle(req: Request): Response {
  if (!authorized(req)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  const result = pruneExpiredReceipts();
  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
