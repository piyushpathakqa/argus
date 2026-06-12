# Argus — Status & Handoff

> **Read this to resume work with zero context loss.** Last updated: 2026-06-12.

## ▶ To continue right now (start here)

1. Read `AGENTS.md`, then this file, then `docs/DESIGN.md`. The design is locked — don't
   re-litigate it; just build the next ticket.
2. **Next ticket: `TRE-33`** — the Generate behavior: drive `runAgentLoop` with a system prompt
   that explores an app (via the real `createPlaywrightSession`) and writes Playwright specs with
   `fs_write`. The loop, tools, and real browser/runtime all exist now. `TRE-30`–`TRE-32` are
   done — see [What exists right now](#what-exists-right-now).
3. Work the M1 order: ~~`TRE-30` (app)~~ → ~~`TRE-31` (Tool Registry)~~ → ~~`TRE-32` (agent loop)~~
   → `TRE-33` (Generate) → `TRE-34` (prompts).
4. **Before claiming any task done, run and pass:**
   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
5. Commit per ticket with a message like `M1: <what> (TRE-33)`. If `pnpm` is missing:
   `corepack enable && corepack prepare pnpm@9.15.0 --activate`.

---

## TL;DR

- **M0 (Foundations) is complete and verified.** The monorepo builds, typechecks, lints, and
  tests green. The `argus` CLI runs with placeholder commands.
- **M1 in progress: `TRE-30` (sample-shop), `TRE-31` (Tool Registry), and `TRE-32` (agent loop +
  real runtime) are done and verified.** The hand-rolled `runAgentLoop` orchestrates tool-use over
  the registry; `PlaywrightBrowserSession`/`PlaywrightTestRunner` are the real `ToolContext`; and
  `argus smoke <url>` runs the loop E2E. Core suite: **36 passing tests** (incl. 4 real-chromium).
- **Next task: `TRE-33`** — the Generate behavior (drive the loop to explore an app and write specs).
- **One open chore:** pushing to GitHub is blocked on adding the `workflow` OAuth scope to the
  `gh` CLI (see [Open chores](#open-chores)). The repo exists; the commit is local.

## What exists right now

### Verified green (run from repo root)
```bash
pnpm install     # ✓ 292 packages
pnpm lint        # ✓ eslint clean
pnpm typecheck   # ✓ tsc --noEmit, all 4 packages
pnpm test        # ✓ vitest — core 36/36 pass (incl. 4 real-chromium); mcp/cli pass-with-no-tests
pnpm build       # ✓ tsup (core/mcp/cli) + next build (sample-shop: 5 routes + middleware)
node packages/cli/dist/index.js --help     # ✓ prints command surface (now incl. `smoke`)
pnpm --filter @argus/sample-shop dev        # ✓ serves login → products → cart on :3100
```

> The 4 chromium tests self-skip if the browser isn't installed (`pnpm test` stays green); run
> `pnpm --filter @argus/core exec playwright install chromium` once to exercise them.

### Package inventory
| Package | State | Notes |
|---------|-------|-------|
| `@argus/core` | **loop + runtime built (`TRE-31`, `TRE-32`)** | Tool Registry (10 Zod tools, `execute`, `toAnthropic`/`toMcp`) **+** the hand-rolled `runAgentLoop` (Messages-API tool-use over an injected `AnthropicLike` client), `AgentObserver`/`ConsoleObserver`, and the real `PlaywrightBrowserSession`/`PlaywrightTestRunner` that satisfy `ToolContext`. `@anthropic-ai/sdk@^0.104.1` + `playwright@^1.60.0`. Behaviors (Generate/Triage/Heal) land in TRE-33+. |
| `@argus/mcp` | stub | `describeServer()` placeholder. Real stdio MCP server = `TRE-42` (M4). |
| `@argus/cli` | working surface | `commander` CLI with `generate/author/triage/heal` commands wired to placeholder actions. Real logic in M1–M3. |
| `@argus/sample-shop` | **built (`TRE-30`)** | Next.js App Router app: `/login` (server-action gate, demo/demo) → `/products` (static Server Component catalog) → `/cart` (client context, live badge). `src/middleware.ts` enforces the gate. In-memory state, no DB. Stable `data-testid`s documented in its README — the contract M3 drifts for the self-heal demo. Runs on port 3100. |

### Tooling in place
- pnpm workspaces (`pnpm-workspace.yaml`), Node ≥20, pnpm 9.15.0 (via Corepack).
- `tsconfig.base.json` (strict, ESM, bundler resolution) extended per package.
- ESLint flat config (`eslint.config.js`), Prettier (`.prettierrc.json`).
- `tsup` builds, Vitest tests.
- GitHub Actions CI: `.github/workflows/ci.yml` (install → lint → typecheck → test → build).
- `LICENSE` (MIT), `README.md`, `.env.example`, `.gitignore`.

### Git
- Local repo initialized, branch `main`, one commit:
  `M0: scaffold pnpm/TypeScript monorepo (TRE-27, TRE-28, TRE-29)`.
- Remote `origin` → `https://github.com/piyushpathakqa/argus.git` (repo created, **not yet pushed**).

## Open chores

### 1. Push to GitHub (blocked on OAuth scope)
The `gh` token lacks the `workflow` scope, so GitHub refuses to push `.github/workflows/ci.yml`.
**Fix (interactive — run in a terminal):**
```bash
gh auth refresh -h github.com -s workflow   # complete the browser/device authorization fully
git push -u origin main
```
Until then, all work is safe locally; nothing is lost.

## Environment setup (for a fresh machine / Cursor)
```bash
corepack enable && corepack prepare pnpm@9.15.0 --activate   # if pnpm missing
cd argus
pnpm install
cp .env.example .env        # add ANTHROPIC_API_KEY
```

## Done: `TRE-30` (sample-shop Next.js app)

Built in `apps/sample-shop` (Next.js 15 App Router, React 19, port 3100):
- `/login` — `'use client'` form backed by a Server Action; demo creds `demo`/`demo`; wrong
  creds show `login-error`. Sets an httpOnly session cookie.
- `/products` — Server Component rendering the static catalog (`tee`, `mug`, `cap`, `stickers`)
  from `src/lib/products.ts`. Each card has an `add-to-cart-<id>` button.
- `/cart` — `'use client'` page over a React-context cart; line items, qty, total, remove/clear,
  empty state. Header badge `cart-count` updates live.
- `src/middleware.ts` — login gate: unauth → `/login`, authed-on-`/login` → `/products`.
- Stable `data-testid`s on every key element (table in the app README) — the contract Argus's
  generated tests rely on and M3 (`TRE-40`) drifts for the self-heal demo.

Verified: `pnpm lint && pnpm typecheck && pnpm build` green; dev server serves the full
login → browse → cart flow (gate redirects and authed routes confirmed via curl).

Why Next 15 (not 16): the app is a deterministic test *fixture*, so stability beats bleeding
edge. Pinned `next@^15.1.6`; `middleware.ts` is correct for this version (16 renames it to
`proxy.ts`).

## Done: `TRE-31` (Tool Registry)

Built in `packages/core/src/tools/` (spec: `docs/superpowers/specs/2026-06-12-tool-registry-design.md`;
plan: `docs/superpowers/plans/2026-06-12-tool-registry.md`):
- **`ToolRegistry`** — `register`/`get`/`list` + `execute(name, input, ctx)`, which validates
  input against the tool's Zod schema and **never throws** (bad input, unknown tool, and handler
  errors all come back as `{ isError: true }` so the agent can self-correct).
- **10 tools**, real handlers over an injected `ToolContext`: `fs_read/write/list` (sandboxed to
  `workspaceRoot`, path-traversal rejected), `browser_navigate/click/type/snapshot`,
  `dom_query/dom_testids`, `playwright_run`.
- **Seams for TRE-32:** `BrowserSession` and `TestRunner` are interfaces (faked in tests via
  `src/tools/testing/fakes.ts`); TRE-32 injects the real Playwright-backed implementations.
- **Adapters:** `toAnthropic()` (JSON Schema via native `z.toJSONSchema`, `$schema` stripped) and
  `toMcp()` (Zod raw shape) — `createDefaultRegistry()` is exported from `@argus/core`.

Decision: **zod 4** (not 3) — MCP SDK 1.x accepts `^3.25 || ^4.0` and v4 has native
`z.toJSONSchema`, so no `zod-to-json-schema` dependency. Deferred to TRE-32: real Playwright
session/runner. Deferred (not in TRE-31 scope): git tools (serve Heal/TRE-39).

Verified: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green (core 22/22); built
`dist` exports `createDefaultRegistry` and both adapters return all 10 tools.

## Done: `TRE-32` (agent loop + real ToolContext)

Built in `packages/core/src/{agent,runtime}/` (spec/plan: `docs/superpowers/{specs,plans}/2026-06-12-agent-loop*.md`):
- **`runAgentLoop`** — hand-rolled Messages-API tool-use loop over the registry. Echoes full
  `response.content` back each turn, runs `tool_use` blocks through `registry.execute`, feeds
  `tool_result`s back, stops on `end_turn`/`refusal`/`max_tokens` or a `maxSteps` guard. Depends
  on an injected `AnthropicLike` client → unit-tested with a scripted fake (no key, no network).
- **`AgentObserver` + `ConsoleObserver`** — the observability seam reused by TRE-37 + TRE-46.
- **Real `ToolContext`:** `PlaywrightBrowserSession` (chromium) + `PlaywrightTestRunner` (spawns
  `playwright test --reporter=json`, pure `parsePlaywrightJson`). The TRE-31 interfaces, now real.
- **`argus smoke <url>`** — wires the real client/session/runner + `ConsoleObserver` into one
  watchable run; prints a step trace + a token/cost line. Defaults to the **fast model** (Haiku).

Decisions: adaptive thinking + `effort` are **Opus-tier only** (they 400 on Haiku), so the loop
gates them off when the caller asks (`smoke` passes `thinking:false`). `@anthropic-ai/sdk`
upgraded `0.32.1 → 0.104.1`; `playwright` added. Deferred: real Generate prompt/context
engineering (TRE-34), git tools (TRE-39), CI browser install (TRE-36).

Verified: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green (core **36/36**, incl. 4
real-chromium); built `dist` exports the loop + runtime.

### ▶ Try the E2E smoke run (needs API credit + chromium)
```bash
cp .env.example .env                                    # add a real ANTHROPIC_API_KEY
pnpm --filter @argus/core exec playwright install chromium   # one-time
pnpm build                                              # build core + cli
pnpm --filter @argus/sample-shop dev                    # terminal 1 → :3100
node --env-file=.env packages/cli/dist/index.js smoke http://localhost:3100/login   # terminal 2
```
Watch the agent navigate → snapshot → list testids → click through login → cart, then print a
cost line (~$0.05–0.15 on Haiku). A Max subscription does **not** fund the API — it needs a
Console API key with its own billing.

## Next: M1 — `TRE-33` (Generate behavior)

Drive `runAgentLoop` with a real Generate system prompt (the throwaway one in `smoke` is a
placeholder): explore the app via `createPlaywrightSession`, then write runnable Playwright specs
with `fs_write`. Needs the real app (done), tools (done), and loop (done). Context engineering for
the system prompt + DOM snapshots is the follow-on `TRE-34`.

## Process notes
- Design is locked in `docs/DESIGN.md`. Tickets in Linear mirror `docs/ROADMAP.md`.
- This project was scoped via the brainstorming process; each milestone gets built, verified,
  and committed before moving on. Keep that discipline: **don't claim done without running the
  verification commands.**
