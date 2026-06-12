# Argus — Status & Handoff

> **Read this to resume work with zero context loss.** Last updated: 2026-06-12.

## ▶ To continue right now (start here)

1. Read `AGENTS.md`, then this file, then `docs/DESIGN.md`. The design is locked — don't
   re-litigate it; just build the next ticket.
2. **Next ticket: `TRE-31`** — the Tool Registry (browser / dom / fs / playwright tool
   definitions in `@argus/core`). `TRE-30` (sample-shop) is done — see
   [What exists right now](#what-exists-right-now).
3. Work the M1 order: ~~`TRE-30` (app)~~ → `TRE-31` (Tool Registry) → `TRE-32` (agent loop) →
   `TRE-33` (Generate) → `TRE-34` (prompts).
4. **Before claiming any task done, run and pass:**
   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
5. Commit per ticket with a message like `M1: <what> (TRE-31)`. If `pnpm` is missing:
   `corepack enable && corepack prepare pnpm@9.15.0 --activate`.

---

## TL;DR

- **M0 (Foundations) is complete and verified.** The monorepo builds, typechecks, lints, and
  tests green. The `argus` CLI runs with placeholder commands.
- **M1 in progress: `TRE-30` (sample-shop) is done and verified** — a Next.js login → products →
  cart app with a login gate and stable `data-testid`s, building/typechecking/linting green.
- **Next task: `TRE-31`** — the shared Tool Registry in `@argus/core`.
- **One open chore:** pushing to GitHub is blocked on adding the `workflow` OAuth scope to the
  `gh` CLI (see [Open chores](#open-chores)). The repo exists; the commit is local.

## What exists right now

### Verified green (run from repo root)
```bash
pnpm install     # ✓ 292 packages
pnpm lint        # ✓ eslint clean
pnpm typecheck   # ✓ tsc --noEmit, all 4 packages
pnpm test        # ✓ vitest — core 2/2 pass; mcp/cli pass-with-no-tests
pnpm build       # ✓ tsup (core/mcp/cli) + next build (sample-shop: 5 routes + middleware)
node packages/cli/dist/index.js --help     # ✓ prints command surface
pnpm --filter @argus/sample-shop dev        # ✓ serves login → products → cart on :3100
```

### Package inventory
| Package | State | Notes |
|---------|-------|-------|
| `@argus/core` | scaffold | Exports model config (`MODELS`, `resolveModel`) + a passing Vitest. Agent loop & Tool Registry land in M1. |
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

## Next: M1 — `TRE-31` (Tool Registry)

Define the shared QA tools once in `@argus/core` (the single registry both the agent loop and
the MCP server consume): `browser` / `dom` / `fs` / `playwright` tool definitions.
- After it lands, the order is `TRE-32` (agent loop) → `TRE-33` (Generate) → `TRE-34` (prompts).
  `TRE-33` needs both a real app (now done) and real tools (`TRE-31`) to exercise.

## Process notes
- Design is locked in `docs/DESIGN.md`. Tickets in Linear mirror `docs/ROADMAP.md`.
- This project was scoped via the brainstorming process; each milestone gets built, verified,
  and committed before moving on. Keep that discipline: **don't claim done without running the
  verification commands.**
