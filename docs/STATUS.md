# Argus — Status & Handoff

> **Read this to resume work with zero context loss.** Last updated: 2026-06-12.

## ▶ To continue right now (start here)

1. Read `AGENTS.md`, then this file, then `docs/DESIGN.md`. The design is locked — don't
   re-litigate it; just build the next ticket.
2. **Next ticket: `TRE-32`** — the Claude agent loop in `@argus/core` (Messages API + tool-use
   orchestration). It consumes the Tool Registry (`createDefaultRegistry`) and must provide the
   **real `BrowserSession` + `TestRunner`** (Playwright-backed) that the registry's `ToolContext`
   expects — these are interfaces today, faked in tests. `TRE-30` and `TRE-31` are done — see
   [What exists right now](#what-exists-right-now).
3. Work the M1 order: ~~`TRE-30` (app)~~ → ~~`TRE-31` (Tool Registry)~~ → `TRE-32` (agent loop) →
   `TRE-33` (Generate) → `TRE-34` (prompts).
4. **Before claiming any task done, run and pass:**
   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
5. Commit per ticket with a message like `M1: <what> (TRE-32)`. If `pnpm` is missing:
   `corepack enable && corepack prepare pnpm@9.15.0 --activate`.

---

## TL;DR

- **M0 (Foundations) is complete and verified.** The monorepo builds, typechecks, lints, and
  tests green. The `argus` CLI runs with placeholder commands.
- **M1 in progress: `TRE-30` (sample-shop) and `TRE-31` (Tool Registry) are done and verified.**
  sample-shop is a Next.js login → products → cart app with a login gate and stable
  `data-testid`s. The Tool Registry is the shared, Zod-backed tool set in `@argus/core` (10 tools,
  `toAnthropic`/`toMcp` adapters), with 22 passing tests.
- **Next task: `TRE-32`** — the Claude agent loop, which wires the registry and supplies the real
  Playwright-backed `BrowserSession` + `TestRunner`.
- **One open chore:** pushing to GitHub is blocked on adding the `workflow` OAuth scope to the
  `gh` CLI (see [Open chores](#open-chores)). The repo exists; the commit is local.

## What exists right now

### Verified green (run from repo root)
```bash
pnpm install     # ✓ 292 packages
pnpm lint        # ✓ eslint clean
pnpm typecheck   # ✓ tsc --noEmit, all 4 packages
pnpm test        # ✓ vitest — core 22/22 pass; mcp/cli pass-with-no-tests
pnpm build       # ✓ tsup (core/mcp/cli) + next build (sample-shop: 5 routes + middleware)
node packages/cli/dist/index.js --help     # ✓ prints command surface
pnpm --filter @argus/sample-shop dev        # ✓ serves login → products → cart on :3100
```

### Package inventory
| Package | State | Notes |
|---------|-------|-------|
| `@argus/core` | **registry built (`TRE-31`)** | Model config (`MODELS`, `resolveModel`) + the shared **Tool Registry**: 10 Zod-backed tools (fs/browser/dom/playwright) with real handlers over an injected `ToolContext`, `execute` (validates + never throws), and `toAnthropic`/`toMcp` adapters. `createDefaultRegistry()` exported. Agent loop = `TRE-32`. |
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

## Next: M1 — `TRE-32` (Claude agent loop)

Build the hand-rolled Claude agent loop in `@argus/core`: Anthropic Messages API + tool-use
orchestration over `createDefaultRegistry()`. It must supply the real Playwright-backed
`BrowserSession` + `TestRunner` for the registry's `ToolContext`.
- Then the order is `TRE-33` (Generate) → `TRE-34` (prompts). `TRE-33` needs the real app (done),
  the tools (done), and the loop (`TRE-32`) to exercise.
- Good engineering note for TRE-32: build in a pluggable `AgentObserver` hook from the start —
  it's reused by the CI artifact pipeline (TRE-37) and the optional Treeship showcase (TRE-46).

## Process notes
- Design is locked in `docs/DESIGN.md`. Tickets in Linear mirror `docs/ROADMAP.md`.
- This project was scoped via the brainstorming process; each milestone gets built, verified,
  and committed before moving on. Keep that discipline: **don't claim done without running the
  verification commands.**
