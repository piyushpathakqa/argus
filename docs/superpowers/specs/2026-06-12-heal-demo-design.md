# Self-Heal Demo + CI Wiring — Design Spec (TRE-40/41)

> Status: approved 2026-06-12 (completion sweep; user chose code-only, no live trigger).
> Implements **M3 / `TRE-40` + `TRE-41`** — closes M3.

## 1. Goal

A **reproducible** self-healing demo: seed a DOM drift (and, separately, a real bug) in sample-shop
so the committed spec fails, then `argus heal` fixes the drift (→ PR) and *refuses* the real bug.
Plus a CI workflow that can run the self-heal on demand. **No live PR/API spend is triggered by
this work** — the toggles default OFF and the CI job is manual-dispatch + gated on a secret.

## 2. Seeded scenarios — env toggles in sample-shop (default OFF)

`apps/sample-shop/src/lib/demo.ts`:
```ts
export const DEMO_DRIFT = process.env.NEXT_PUBLIC_ARGUS_DEMO_DRIFT === '1';
export const DEMO_BUG = process.env.NEXT_PUBLIC_ARGUS_DEMO_BUG === '1';
// The login submit button's testid DRIFTS under the flag — the seeded DOM drift.
export const SUBMIT_TESTID = DEMO_DRIFT ? 'submit-btn' : 'login-submit';
```
- **Drift:** the login page renders the submit button with `data-testid={SUBMIT_TESTID}`. With
  `NEXT_PUBLIC_ARGUS_DEMO_DRIFT=1`, it becomes `submit-btn`, so the committed spec's
  `getByTestId('login-submit')` fails — but the element still exists under a new testid →
  Triage = `dom-drift`, suggested `submit-btn` → Heal rewrites + verifies green → PR.
- **Real bug:** the login server action, under `NEXT_PUBLIC_ARGUS_DEMO_BUG=1`, rejects even valid
  credentials. No selector fix helps → Triage = `real-bug` → Heal refuses (gate stays blocked).

**Both default off**, so normal runs + the QA Gate are unchanged (still green). The committed
`tests/generated/login.spec.ts` keeps passing.

## 3. Demo runbook — `docs/DEMO.md`

Documented, not auto-run. Drift demo:
```bash
NEXT_PUBLIC_ARGUS_DEMO_DRIFT=1 pnpm --filter @argus/sample-shop dev    # terminal 1
npx playwright test                                                    # FAILS (login-submit gone)
node --env-file=.env packages/cli/dist/index.js heal \
  http://localhost:3100/login --spec tests/generated/login.spec.ts     # → dom-drift → PR
```
Real-bug demo: same with `NEXT_PUBLIC_ARGUS_DEMO_BUG=1` → `argus heal` prints `real-bug`, exits 1,
opens no PR. Costs (~$0.50 Opus / ~$0.10 Haiku per heal) + opens a real PR — run when ready.

## 4. CI wiring — `.github/workflows/self-heal.yml` (TRE-41)

`on: workflow_dispatch` with `url` + `spec` inputs (manual trigger — **not** auto-firing, so no
surprise spend/PRs). Installs deps + chromium, runs `argus heal <url> --spec <spec>` with
`ANTHROPIC_API_KEY` from `secrets`. Skips cleanly if the secret is absent (it isn't set yet). The
workflow documents (in a comment) how to make it fully automatic later: change the trigger to
`workflow_run` on the **QA Gate**'s `completed`+`failure` conclusion (the TRE-41 "on-failure →
conditional heal-PR" ideal), once the org is comfortable with autonomous CI PRs.

## 5. Verification (no live PR/API)

- Default suite green: `pnpm lint && typecheck && test && build`.
- Drift toggle works: start sample-shop with `NEXT_PUBLIC_ARGUS_DEMO_DRIFT=1`, `curl /login`,
  confirm `data-testid="submit-btn"` (and that default has `login-submit`). No agent run.
- Committed spec still passes by default: `npx playwright test` → green.

## 6. Non-goals

- Triggering a live heal/PR (user-run). Fully-automatic on-failure CI healing (documented as the
  opt-in next step, not enabled).

## 7. Done when

- sample-shop has default-off drift + bug toggles; the login submit testid drifts under the flag.
- `docs/DEMO.md` documents the drift + real-bug runbooks.
- `self-heal.yml` exists (manual dispatch, secret-gated).
- Default `pnpm lint && typecheck && test && build` green; the committed spec still passes;
  the drift toggle verified via curl.
