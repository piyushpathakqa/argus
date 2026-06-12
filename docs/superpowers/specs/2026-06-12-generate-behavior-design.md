# Generate Behavior — Design Spec (TRE-33)

> Status: approved 2026-06-12. Implements milestone **M1 / `TRE-33`**.
> Builds on the agent loop + runtime (`TRE-32`) and Tool Registry (`TRE-31`).

## 1. Goal

The first **product behavior**: drive `runAgentLoop` with a spec-writing system prompt so the
agent explores a web app and writes a **runnable Playwright spec** to a deterministic path. Ship a
minimal `playwright.config.ts` so the spec actually runs, and wire a real `argus generate <url>
[--run]` that can generate-then-run green against `sample-shop`.

## 2. Non-goals (deferred)

- Deeper prompt + DOM context engineering (better snapshots, few-shot) — **TRE-34**.
- Author/Triage/Heal behaviors — TRE-?, **TRE-38**, **TRE-39**.
- CI wiring / GitHub Actions gate, `webServer` build mode — **TRE-36** (M2).

## 3. Decisions (resolved)

| Decision | Choice | Why |
|----------|--------|-----|
| Runnable scope | **Write spec + ship `playwright.config.ts` + optional `--run`** | A spec is only "runnable" with a config; `--run` closes the loop (generate → green). |
| Output path | **Deterministic, behavior-computed** (`tests/generated/<slug>.spec.ts`) | Predictable, findable, unit-testable. |
| Default model | **Primary (Opus 4.8), thinking on** | Generate is the reasoning-heavy "write a good test" stage; `--model claude-haiku-4-5` for cheap runs. |
| Spec prompt | **v1 inline prompt** | Good enough to emit a runnable spec; context engineering is TRE-34. |
| `--run` self-start | **`playwright.config.ts` has a `webServer` with `reuseExistingServer: true`** | `--run` works whether or not sample-shop is already up. |

## 4. Module layout

```
packages/core/src/behaviors/
  index.ts                # barrel
  generate.ts             # generate() + specPathForUrl()
packages/core/src/index.ts  # re-export behaviors barrel
playwright.config.ts        # NEW — repo root
packages/cli/src/index.ts   # real `generate` action (replaces placeholder)
package.json (root)         # add @playwright/test devDep
```

## 5. `specPathForUrl` (pure)

```ts
/** Map a URL to a deterministic spec path under `outDir` (default 'tests/generated'). */
export function specPathForUrl(url: string, outDir = 'tests/generated'): string;
```
Rules: parse the URL, take `pathname`; `'/'` or empty → slug `home`; otherwise join non-empty
segments with `-`, lowercase, and strip to `[a-z0-9-]`. Examples:
`http://localhost:3100/` → `tests/generated/home.spec.ts`;
`…/login` → `tests/generated/login.spec.ts`;
`…/products/42` → `tests/generated/products-42.spec.ts`.
Falls back to `home` if parsing yields an empty slug.

## 6. `generate()` (`behaviors/generate.ts`)

```ts
export interface GenerateOptions {
  client: AnthropicLike;
  url: string;
  registry: ToolRegistry;
  ctx: ToolContext;
  model?: string;       // default resolveModel('primary')
  outDir?: string;      // default 'tests/generated'
  maxSteps?: number;    // default 20
  observer?: AgentObserver;
}
export interface GenerateResult {
  specPath: string;             // the path the agent was told to write
  writtenFiles: string[];       // paths actually written via fs_write (no error)
  run: AgentRunResult;          // the underlying loop result (stopReason, usage, …)
}
export function generate(opts: GenerateOptions): Promise<GenerateResult>;
```

Behavior:
1. `specPath = specPathForUrl(url, outDir)`.
2. Compose an internal observer that wraps `opts.observer` and, on `onToolResult` where
   `name === 'fs_write'` and `!result.isError`, records `result.meta?.path` into `writtenFiles`.
3. `runAgentLoop({ client, system: GENERATE_SYSTEM, prompt, registry, ctx, model, thinking: <opus-tier?>, maxSteps, observer: composed })`.
   - `prompt` names the target URL and the **exact** `specPath` to write.
   - `thinking` is enabled only for Opus-tier models (Haiku would 400) — same gate as `smoke`.
4. Return `{ specPath, writtenFiles, run }`.

`GENERATE_SYSTEM` (v1, refined in TRE-34) instructs the agent to: navigate to the URL; explore
with `browser_snapshot` / `dom_testids`; if the app gates on login, discover the credentials shown
on the page and log in; then write **exactly one** Playwright spec to the given path via
`fs_write`. The spec must `import { test, expect } from '@playwright/test'`, prefer
`page.getByTestId(...)` / `[data-testid="…"]` locators, include meaningful assertions, be
self-contained, and not require manual edits. Keep exploration focused to bound cost.

## 7. `playwright.config.ts` (new, repo root)

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  use: { baseURL: 'http://localhost:3100' },
  webServer: {
    command: 'pnpm --filter @argus/sample-shop dev',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```
Generated specs land in `tests/generated/`. `reuseExistingServer: true` means `--run` works whether
or not the dev server is already up.

## 8. CLI — real `generate`

Replace the placeholder action:
```
argus generate <url> [--model <id>] [--run] [--out <dir>] [--max-steps <n>]
```
1. `createPlaywrightSession({ headless: true })` → `ctx = { workspaceRoot: process.cwd(), browser, runner: new PlaywrightTestRunner({ cwd: process.cwd() }) }`.
2. `const result = await generate({ client: createAnthropicClient(), url, registry: createDefaultRegistry(), ctx, model, outDir, observer: new ConsoleObserver() })`.
3. Print `writtenFiles` + a token/cost line (reuse the `smoke` price map).
4. If `--run`: `const tr = await ctx.runner.run(result.specPath)` → print `tr.summary` (`3 passed, 0 failed`) and exit non-zero if `tr.failed > 0`.
5. `finally { await close() }`.

## 9. Testing (Vitest)

- **`specPathForUrl`** — `/`, `/login`, `/products/42`, a trailing slash, and an empty/garbage path.
- **`generate`** — a `FakeAnthropicClient` scripted `[ tool_use browser_snapshot, tool_use fs_write({path: specPath, content: SPEC}), end_turn ]`, with a **real temp `workspaceRoot`** (`mkdtemp`) in `ctx` so `fs_write` truly writes. Assert: the file exists at `<tmp>/tests/generated/<slug>.spec.ts` with the spec content; `result.writtenFiles` contains that path; `result.specPath` matches. (Real LLM generation is verified manually via `argus generate`, like `smoke`.)

## 10. Dependencies

- Root `package.json`: add `@playwright/test@^1.60.0` (dev) — the runner for generated specs.
- `playwright` (browser automation) already in `@argus/core`.

## 11. Done when

- `@argus/core` exports `generate` + `specPathForUrl`.
- `generate()` drives the loop to write a runnable spec to the deterministic path and reports the
  written files + run result (proven by the fake-client + real-temp-fs test).
- `playwright.config.ts` exists; `npx playwright test tests/generated/<slug>.spec.ts` runs against
  sample-shop.
- `argus generate <url>` writes a spec and prints cost; `--run` runs it and reports pass/fail.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` is green.
