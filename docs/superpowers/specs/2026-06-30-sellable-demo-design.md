# Sellable-part demo — governance cloud (TRE-60 / TRE-53)

> **Status:** Design, 2026-06-30. Approved spine + recommended approaches.
> **Goal:** Produce "something to show" for the *paid* layer — a live, drivable
> demo of the governance cloud's value plus a narrated runbook. Doubles as the
> artifact to put in front of buyers for pricing validation (TRE-60).

## Why

TRE-60 as written is real-buyer interviews, which can't be run from a coding
session. What we *can* build is the thing you put in front of those buyers: a
working demonstration of **what is sellable** — the governance cloud (the paid
layer), not the free OSS agent. Per the product thesis (`CLAUDE.md` §2),
**attestation is the product**; the demo must sell *verifiable, governed proof
of agent decisions*, not generic SaaS gating.

## The demo spine (the story)

A fictional company, **Acme Inc**, ships AI-written tests. Their agent made
three decisions last sprint, each with a signed receipt in the cloud:

1. **dom-drift → healed** — a login selector changed; safe cosmetic drift,
   auto-healed, chain intact.
2. **real-bug → refused** — checkout total computed wrong; the agent **refused
   to heal and failed loudly**. The money line: *"it won't hide a real bug."*
3. **flake → quarantined** — a flaky assertion, isolated rather than healed.

On **Free**, Acme sees 1 repo, 14-day history, export locked. They actually run
3 repos and an auditor wants a trail → they hit the wall → **upgrade to Team** →
org-wide dashboard, 1-year retention, and compliance export light up live.

This arc demonstrates the sellable value: verifiable proof of every agent
decision, governed across the org — and the honest framing that attestation is
**verifiable/auditable, not a correctness guarantee** (`CLAUDE.md` §3).

## Scope decisions (approved)

**1. Flip Free → Team live (Stripe/TRE-67 not built):** a dev-only "switch
plan" control in the dashboard header that calls the existing `applyPlan()`.
Gated by the existing `devBypassEnabled()` (true exactly when no GitHub creds
are configured — i.e. local demo). No new env var, no Stripe dependency. It is
visibly a demo affordance, not a fake checkout.

**2. Auth:** reuse the **existing** Dev login (`auth.ts` Credentials provider,
already active when `devBypassEnabled()`). No new auth code. The seed targets
the org the dev user lands in, so sign-in drops straight into the seeded Acme
story.

**3. Isolation:** everything demo-specific is gated behind `devBypassEnabled()`
and an explicit seed step. The real product path (GitHub OAuth, empty new orgs,
Stripe-driven plans) is untouched.

## What's already built (reused, not rebuilt)

- Tier model + limits: `entitlements.ts` (`free`/`team`/`enterprise`).
- `applyPlan(orgId, plan)` — the seam to switch plans (`db.ts`). The demo
  control calls this directly.
- Dashboard with verdict/repo/spec/date filters, the over-repo-limit nudge,
  gated export links, and the retention note (`app/page.tsx`).
- Receipt detail page, compliance export (`app/receipt/[id]`, `api/export`).
- Dev login + `devBypassEnabled()` (`auth.ts`), `ensureUserAndOrg` (`db.ts`).
- `insertReceipt(orgId, CloudReceipt)` — the seed inserts through this.

## Deliverables

### 1. Demo seed module (`apps/cloud/src/demo-seed.ts` + a `pnpm` script)

A pure, idempotent function `seedDemo()` that:

- Resolves the dev user's org via `ensureUserAndOrg({ email: 'dev@vigilis.local',
  name: 'Vigilis Dev' })` (the same identity the Dev login provider returns).
- Renames that org to **Acme Inc** and sets plan to `free` (so the demo always
  starts at the wall, regardless of prior runs).
- Inserts the receipt story across **3 repos** (`acme/web`, `acme/checkout`,
  `acme/mobile`) so Free's 1-repo limit is exceeded → the upgrade nudge shows.
  Receipts cover all three verdicts, with the `real-bug → refused` one carrying
  a clear rationale (`healed = false`, rationale explains the behavior change).
- Dates receipts across a spread (~60 days) so the retention story is legible.
  Note: the dashboard does not prune on read (pruning is the TRE-69 cron), so
  the *visible* retention signal is the **retention note flipping** per plan
  (`14 days` → `365 days` → `Unlimited`), not receipts appearing/vanishing. The
  runbook may optionally hit the prune cron route to actually roll Free's old
  receipts off for extra effect.
- Idempotent: re-running resets plan to `free` and dedupes receipts (reuse
  `insertReceipt`'s dedupe on a stable `receiptId` per seeded row).

Exposed as `pnpm --filter cloud demo:seed` (script: `tsx src/demo-seed.ts` or
equivalent runner already used in the repo).

### 2. Dev-only plan switch (dashboard header)

- A server action `setPlanAction(plan)` in the cloud app that, **only when
  `devBypassEnabled()`**, calls `applyPlan(session.orgId, plan)` and revalidates
  the dashboard. Hard no-op (or 403) otherwise.
- A small control rendered in the dashboard header **only when
  `devBypassEnabled()`**: current plan + buttons `Free | Team | Enterprise`.
  Clicking relights the whole UI (nudge clears, export unlocks, retention note
  flips) with no page reload friction.
- Clearly labelled as a demo control (e.g. a `demo` tag) so it's never mistaken
  for real billing.

### 3. `docs/DEMO.md` — the narrated runbook

- **Setup:** the exact commands (`pnpm --filter cloud demo:seed`, `pnpm --filter
  cloud dev`, open `http://localhost:3300`, click Dev login).
- **Click path:** step-by-step, what to click and what appears.
- **What to say:** the value narration at each gate — the dom-drift-vs-real-bug
  trust story, the org-wide audit trail, retention, compliance export — plus the
  honest "verifiable/auditable, not correctness" line.
- **Reset:** how to return to the start (`demo:seed` again).
- **Appendix (optional, advanced):** close the loop by running the real OSS
  agent against `apps/sample-shop` with `VIGILIS_CLOUD_URL` + a real org key to
  generate a *live* receipt into the cloud. Documented, not part of the core
  path.

## Out of scope

- Stripe / real checkout (TRE-67).
- Any change to the real GitHub-OAuth auth path or new-org bootstrap.
- New entitlement features — the demo showcases what exists.
- Persisting demo data to a deployed environment — this is a local-demo design.

## Acceptance criteria

- [ ] `pnpm --filter cloud demo:seed` produces the Acme Inc org with 3 repos and
      the 3-verdict receipt story; idempotent across re-runs; resets plan to free.
- [ ] Dev login lands directly in the seeded Acme org (no empty dashboard).
- [ ] On Free: over-repo nudge shows, export is locked, retention note shows 14d.
- [ ] The dev-only plan switch flips Free→Team→Enterprise and the UI relights:
      nudge clears at Team (3 repos < 5-repo limit), export unlocks, retention
      note flips 14d → 365d → Unlimited.
- [ ] The plan switch and seed affordances are inert when GitHub creds are set
      (`devBypassEnabled()` false) — real product path unaffected.
- [ ] `docs/DEMO.md` walks a presenter through setup → click path → narration →
      reset, end to end.
- [ ] `tsc`/lint clean for the cloud app; existing tests still pass.
