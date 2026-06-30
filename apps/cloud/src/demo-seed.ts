/**
 * Demo seed (TRE-60) — populates one org with the "Acme Inc" receipt story used
 * to demo the sellable governance cloud. Idempotent: stable receiptIds dedupe on
 * re-run, and the plan is always reset to `free` so the demo starts at the wall.
 *
 * Pure of I/O beyond db.ts (which it drives through public helpers), so it is
 * fully unit-testable and can be invoked in-process from a server action — no
 * standalone runner needed. node:sqlite ⇒ Node runtime only.
 */
import { renameOrg, applyPlan, insertReceipt, type CloudReceipt } from '@/db';

const ORG_NAME = 'Acme Inc';

export interface DemoSeedResult {
  orgId: string;
  orgName: string;
  receiptsInserted: number;
  receiptsTotal: number;
}

type SeedReceipt = CloudReceipt & { receiptId: string };

/** The fixed demo story. `now` anchors the relative dates so tests are stable. */
function demoReceipts(now: number): SeedReceipt[] {
  const at = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();
  const base = { framework: 'playwright' as const };
  return [
    {
      ...base,
      receiptId: 'demo-web-login-domdrift',
      repo: 'acme/web',
      specPath: 'tests/login.spec.ts',
      url: 'https://acme.example/login',
      verdict: 'dom-drift',
      healed: true,
      suggestedSelector: 'getByRole("button", { name: "Sign in" })',
      rationale:
        'Login button id changed (#login → #signin); same role/label. Cosmetic drift — healed.',
      timestamp: at(1),
    },
    {
      ...base,
      receiptId: 'demo-web-nav-flake',
      repo: 'acme/web',
      specPath: 'tests/nav.spec.ts',
      url: 'https://acme.example/',
      verdict: 'flake',
      healed: false,
      rationale:
        'Assertion passed on retry without any DOM change — flaky timing. Quarantined, not healed.',
      timestamp: at(3),
    },
    {
      ...base,
      receiptId: 'demo-checkout-total-realbug',
      repo: 'acme/checkout',
      specPath: 'tests/checkout-total.spec.ts',
      url: 'https://acme.example/checkout',
      verdict: 'real-bug',
      healed: false,
      rationale:
        'Order total expected $90.00, rendered $108.00 — pricing logic changed, not the locator. ' +
        'This is a genuine behavior change; refusing to heal and failing loudly.',
      timestamp: at(2),
    },
    {
      ...base,
      receiptId: 'demo-checkout-coupon-domdrift',
      repo: 'acme/checkout',
      specPath: 'tests/coupon.spec.ts',
      url: 'https://acme.example/checkout',
      verdict: 'dom-drift',
      healed: true,
      suggestedSelector: 'getByLabel("Promo code")',
      rationale: 'Coupon field relabelled "Promo code"; same input. Cosmetic drift — healed.',
      timestamp: at(20),
    },
    {
      ...base,
      receiptId: 'demo-mobile-onboarding-domdrift',
      repo: 'acme/mobile',
      specPath: 'tests/onboarding.spec.ts',
      url: 'https://acme.example/m/onboarding',
      verdict: 'dom-drift',
      healed: true,
      suggestedSelector: 'getByText("Get started")',
      rationale: 'CTA copy changed "Start" → "Get started"; same element. Cosmetic drift — healed.',
      timestamp: at(40),
    },
    {
      ...base,
      receiptId: 'demo-mobile-paywall-realbug',
      repo: 'acme/mobile',
      specPath: 'tests/paywall.spec.ts',
      url: 'https://acme.example/m/paywall',
      verdict: 'real-bug',
      healed: false,
      rationale:
        'Paywall let a free user reach premium content — access control regressed. ' +
        'Genuine behavior change; refusing to heal.',
      timestamp: at(55),
    },
  ];
}

/**
 * Populate `orgId` with the Acme Inc demo story. Renames the org, resets it to
 * the `free` plan (so the demo starts at the upgrade wall), and inserts the
 * fixed receipt set. Idempotent — re-running inserts nothing new and re-resets
 * the plan.
 */
export function seedDemo(orgId: string, now: number = Date.now()): DemoSeedResult {
  renameOrg(orgId, ORG_NAME);
  applyPlan(orgId, 'free');
  const rows = demoReceipts(now);
  let inserted = 0;
  for (const r of rows) {
    if (insertReceipt(orgId, r).inserted) inserted++;
  }
  return {
    orgId,
    orgName: ORG_NAME,
    receiptsInserted: inserted,
    receiptsTotal: rows.length,
  };
}
