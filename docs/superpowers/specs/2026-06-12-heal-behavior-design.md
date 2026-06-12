# Heal Behavior — Design Spec (TRE-39)

> Status: approved 2026-06-12 (completion sweep; user chose full-auto PRs). Implements **M3 / `TRE-39`**.
> Consumes a Triage (`TRE-38`) `dom-drift` verdict.

## 1. Goal

Given a `dom-drift` verdict (stale locator + the correct `suggestedSelector`), the agent rewrites
the spec to use the correct selector, **the behavior independently re-runs the spec to confirm
green**, and — only then — opens a pull request with the fix.

## 2. Guardrails (load-bearing)

- **Heal only runs on `dom-drift`.** The CLI triages first; `real-bug` → refuse + exit non-zero
  (gate stays blocked), `flake` → no fix. This proves Argus improves signal, never hides bugs.
- **Verify before PR.** After the agent edits, `heal()` calls `ctx.runner.run(specPath)` itself; a
  PR is opened only if `failed === 0`. The agent's "it passes" claim is not trusted.
- **PR creation is deterministic behavior code, not an agent tool** — the outward action is
  controlled by the harness, not the LLM's discretion.

## 3. Components

### `createHealPr` (`runtime/git.ts`) — deterministic git/PR
```ts
export type GitExec = (cmd: string, args: string[], opts: { cwd: string }) => Promise<{ stdout: string; stderr: string; code: number | null }>;
export interface CreateHealPrOptions { cwd: string; branch: string; files: string[]; title: string; body: string; base?: string; exec?: GitExec; }
export function createHealPr(opts: CreateHealPrOptions): Promise<{ branch: string; url: string }>;
```
Runs, in order: `git checkout -b <branch>` → `git add <files>` → `git commit -m <title>` →
`git push -u origin <branch>` → `gh pr create --base <base|main> --head <branch> --title --body`
(returns the printed PR URL). `exec` is injected (default = `spawn`) so the sequence is unit-tested
with a fake.

### `heal()` (`behaviors/heal.ts`) — agentic fix + self-verify
```ts
export interface HealOptions { client: AnthropicLike; specPath: string; url: string; suggestedSelector: string; ctx: ToolContext; model?: string; maxSteps?: number; observer?: AgentObserver; }
export interface HealResult { verified: boolean; changedFiles: string[]; run: AgentRunResult; }
export function heal(opts: HealOptions): Promise<HealResult>;
```
Runs the loop with `HEAL_SYSTEM` (read spec → replace the stale locator with `suggestedSelector`
via `fs_write` → `playwright_run` to check). Captures `fs_write` paths (like `generate`). Then
**re-runs `ctx.runner.run(specPath)` independently**; `verified = result.failed === 0`. Returns
`{ verified, changedFiles, run }`. `HEAL_SYSTEM` forbids changing test intent — locators only.

### CLI — guarded self-heal flow
```
argus heal <url> --spec <path> [--no-pr] [--model <id>]
```
1. `triage()` the failure. Print the verdict.
2. `real-bug` → refuse, exit 1. `flake` → exit 0, no fix. Only `dom-drift` (with a
   `suggestedSelector`) proceeds.
3. `heal()`. If `!verified` or nothing changed → exit 1 ("no verified green fix").
4. Verified + changed: unless `--no-pr`, `createHealPr({ branch: \`argus/heal-<slug>-<ts>\`, files,
   title, body: verdict rationale + old→new })` → print the PR URL. `--no-pr` leaves the fix on a
   local branch and prints the `gh pr create` command.

## 4. Testing (Vitest)

- **`createHealPr`** — fake `exec` records calls; assert the exact git sequence + `gh pr create`
  args, and that the returned `url` is the gh stdout.
- **`heal`** — `FakeAnthropicClient` scripted `[ fs_read, fs_write(specPath, fixed), end_turn ]`
  over a real temp `ctx` whose `runner` (a `FakeTestRunner`) reports `failed: 0`; assert
  `verified === true` and `changedFiles` contains the spec. A second case: runner reports
  `failed: 1` → `verified === false`.

Live PR creation is exercised manually (the TRE-40 seeded-drift demo), not in unit tests.

## 5. Non-goals

- Seeded-drift end-to-end demo (opens a real PR) — **TRE-40**.
- CI on-failure triage → conditional heal-PR job — **TRE-41**.

## 6. Done when

- `createHealPr` + `heal()` exist and are unit-tested (incl. the verify-fails-no-PR path).
- `argus heal <url> --spec …` triages, and on `dom-drift` rewrites + verifies green + opens a PR
  (or `--no-pr`), refusing to touch `real-bug`.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` is green.
