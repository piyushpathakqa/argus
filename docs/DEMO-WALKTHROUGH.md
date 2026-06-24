# Vigilis — Demo Walkthrough & Test Report

> Run-of-show for a live demo, plus the test results that back every claim.
> Last verified: **2026-06-24** against `apps/sample-shop` with the real Claude Haiku model.

---

## Part 1 — What was tested (and the result)

### Automated (deterministic)
| Area | Result | Evidence |
|---|---|---|
| Core unit suite | ✅ **104 passing** | `pnpm --filter @argus/core test` |
| Typecheck + build (all packages) | ✅ green | `pnpm -r build`, `tsc --noEmit` |
| Multi-framework: detection / `resolveAdapter` / spec-paths / guidance | ✅ **7/7** | playwright·cypress·selenium all detect, resolve, and emit the right idioms |
| Fail-closed runners (Cypress + Selenium) | ✅ | missing/empty report → `failed:1`, never a false 0/0 green |
| Attestation core stays framework-agnostic | ✅ | `packages/core/src/agent/` imports nothing from `framework/` |
| CLI surface (`--version` 0.2.0, `--framework` on every command, `init`) | ✅ **8/8** | `node packages/cli/dist/index.js …` |
| MCP server (boots, tool list incl. `test_run` + `playwright_run`) | ✅ | `pnpm --filter vigilis-mcp test` |

### Live (real model, real browser, real app)
| Act | Command (Haiku) | Result | Cost |
|---|---|---|---|
| Explore | `vigilis smoke …/login` | navigated, read testids, logged in (`demo`/`demo`), added to cart | ~$0.02 |
| **Generate** | `vigilis generate …/login --run` | wrote a real spec (testid locators, `cart-count` 0→1 assertion) → **1 passed** | ~$0.03 |
| **Heal (drift)** | `vigilis heal … --spec <drifted>` | triage = **dom-drift (high)**, rewrote only the locator, re-ran via `test_run` → **green** | ~$0.05 |
| **Refuse (real bug)** | `vigilis heal … --spec <missing-feature>` | triage = **real-bug (high)**, **refused to heal**, gate stayed blocked, spec untouched | ~$0.05 |
| **Cypress (live)** | `vigilis generate … --framework cypress --run` | wrote a real `.cy.ts`, ran `cypress run` → **2 passed, 0 failed** | ~$0.04 |
| **Selenium (live)** | `vigilis generate … --framework selenium --run` | wrote a real selenium-webdriver `.test.ts`, ran mocha+Chrome → **1 passed, 0 failed** | ~$0.03 |

**Bottom line:** the full loop — generate → run → triage → heal-or-refuse — works live, and **all three frameworks (Playwright, Cypress, Selenium) generate and run green live**. The "never mask a real bug" guardrail held with a correct, high-confidence classification.

---

## Part 2 — Know before you demo (honest gaps)

1. **`npm i -D vigilis` is safe to show** — **v0.2.1** is published with the full multi-framework surface. (It pulls the e2e tools as needed: install `cypress` / `selenium-webdriver mocha tsx` in the target project before running those frameworks.)
2. **Don't demo `vigilis author`.** It's a placeholder (`not implemented yet`) — labeled "roadmap" on the site. Lead with generate/triage/heal.
3. **Any framework is fair game.** Playwright, Cypress, and Selenium are all live-verified (generate → run green). Note one true detail if asked: the *exploration* browser is always Playwright/chromium; only the spec it writes + how it runs/heals differ per framework.
4. **Prereqs:** `ANTHROPIC_API_KEY` set (or in `.env`), chromium installed (`npx playwright install chromium`). Use `--model claude-haiku-4-5` for fast/cheap (~10¢) runs; drop it for Opus quality.

---

## Part 3 — The walkthrough (≈8 min, 4 acts)

**Setup (before the call):**
```bash
cd /Users/piyushpathak/Work/argus
export ANTHROPIC_API_KEY=...           # or rely on .env
pnpm --filter @argus/sample-shop dev   # demo app on http://localhost:3100
```
Open `http://localhost:3100/login` in a browser (creds shown on the page: `demo`/`demo`).

> **One-liner pitch:** "Vigilis is self-healing QA that refuses to hide a real bug. Watch it write a test, fix one that breaks from a UI change, and *refuse* to fix one that's actually a bug — and prove which it did."

### Act 1 — Generate a real test from a URL (~2 min)
```bash
node packages/cli/dist/index.js generate http://localhost:3100/login --run --model claude-haiku-4-5
```
**Watch:** it navigates, snapshots, reads `data-testid`s, logs in, and writes one Playwright spec to `tests/generated/login.spec.ts`, then runs it → **1 passed**.
**Say:** "No boilerplate — it explored the app and wrote real assertions, including the cart count going 0→1. And it ran it green before handing it over."

### Act 2 — A UI change breaks the test → it heals the drift (~2 min)
Create drift in front of the audience — rename a `data-testid` in the app (e.g. in `apps/sample-shop/src/app/login/page.tsx`, change the submit button's testid), so the green spec now fails. Then:
```bash
node packages/cli/dist/index.js heal http://localhost:3100/login \
  --spec tests/generated/login.spec.ts --no-pr --model claude-haiku-4-5
```
**Watch:** triage prints **dom-drift (high)** with a rationale ("the button exists, the testid changed"), heals the locator, re-runs → **verified green**, and (without `--no-pr`) opens a PR.
**Say:** "It didn't blindly pass the build — it diagnosed *why* it failed: cosmetic drift, the control still exists. It rewrote only the locator, re-ran to prove green, and opened a PR for review."

### Act 3 — A real regression → it REFUSES to heal (the moment) (~2 min)
Now introduce a genuine behavior break (e.g. make the cart not increment, or assert a feature the app doesn't have). Re-run heal:
```bash
node packages/cli/dist/index.js heal http://localhost:3100/login \
  --spec tests/generated/login.spec.ts --no-pr --model claude-haiku-4-5
```
**Watch:** triage prints **real-bug (high)** — "a genuine feature gap that breaks the expected user flow" — then **"real bug — refusing to heal; the gate stays blocked."** Exit code 1. The spec is untouched.
**Say:** "This is the whole point. A general coding agent told to 'make CI green' would weaken the assertion and ship the bug. Vigilis refuses, blocks the deploy, and stays loud. It knows *when not to act*."

### Act 4 — Proof, not 'trust me' (~1–2 min, optional)
- **CI gate:** the loop runs as a required GitHub Actions check; real bugs can't merge around it.
- **Receipts:** with the Treeship CLI present, every heal and refusal is sealed into a signed, offline-verifiable receipt (`--no-receipt` to opt out; no hard dependency). Show a hosted receipt URL or `treeship verify last`.
- **MCP:** the same tools drive Claude Desktop/Code — `claude mcp add vigilis -- npx -y vigilis-mcp` — so you can say "generate a test for /login" right in your editor.
**Say:** "Heal vs. refuse, both sealed as evidence. A receipt, not a black box."

**Close:** "Works with the Playwright, Cypress, or Selenium suite you already have — it heals the drift and gates every run on signed evidence. The work is free and open-source; proving and governing it is where Treeship/Zerker come in."

---

## Part 4 — Reset between runs
```bash
git checkout -- apps/sample-shop/src/app/login/page.tsx tests/generated/login.spec.ts
```
(reverts any live edits + the healed spec so the demo is repeatable)
