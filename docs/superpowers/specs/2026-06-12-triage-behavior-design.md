# Triage Behavior — Design Spec (TRE-38)

> Status: approved 2026-06-12 (completion sweep). Implements milestone **M3 / `TRE-38`**.
> First half of the self-healing loop; feeds **Heal (TRE-39)**.

## 1. Goal

Given a failed Playwright test, the agent classifies the failure as **`real-bug`**, **`dom-drift`**,
or **`flake`**, with a rationale and (for drift) a suggested corrected selector. This is the signal
that lets Heal fix drift safely while *blocking* real bugs.

## 2. How it classifies

The agent reads the failing spec + the error, then inspects the **live app** and compares:
- **`dom-drift`** — the element still exists but its locator/`data-testid` changed (the spec's
  selector no longer matches; a different one does). Suggest the new selector.
- **`real-bug`** — the expected element/behaviour is genuinely missing or broken (no equivalent
  selector exists; the flow doesn't work).
- **`flake`** — transient; passes on a re-run.

## 3. Structured verdict via a tool

The loop returns free text; to get a **structured** verdict, add a `report_verdict` tool the agent
calls exactly once at the end. The behavior captures its input (the same pattern `generate` uses to
capture `fs_write`).

```ts
// tools/definitions/report.ts
reportVerdict = defineTool({
  name: 'report_verdict',
  description: 'Report the triage verdict for the failed test. Call exactly once, last.',
  input: z.object({
    verdict: z.enum(['real-bug', 'dom-drift', 'flake']),
    confidence: z.enum(['low', 'medium', 'high']),
    rationale: z.string(),
    suggestedSelector: z.string().optional(), // for dom-drift: the correct current selector
  }),
  handler: async () => ({ content: 'Verdict recorded.' }),
});
```
`report_verdict` is **not** in the default registry — Triage builds its own registry
(`createDefaultRegistry()` + `register(reportVerdict)`).

## 4. `triage()` (`behaviors/triage.ts`)

```ts
export interface TriageOptions {
  client: AnthropicLike;
  specPath: string;   // the failing spec (read via fs_read)
  url: string;        // the live app to inspect
  errorText?: string; // the Playwright failure message, if known
  ctx: ToolContext;
  model?: string; maxSteps?: number; observer?: AgentObserver;
}
export interface Verdict {
  verdict: 'real-bug' | 'dom-drift' | 'flake';
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
  suggestedSelector?: string;
}
export interface TriageResult { verdict: Verdict | null; run: AgentRunResult; }
export function triage(opts: TriageOptions): Promise<TriageResult>;
```
Builds the triage registry, composes an observer that captures the `report_verdict` call input,
runs the loop with `TRIAGE_SYSTEM` (default model = Opus, thinking on), returns the captured
verdict. `TRIAGE_SYSTEM` tells the agent to read the spec, inspect the live DOM
(`dom_testids`/`dom_query`/`browser_snapshot`), compare, and call `report_verdict` once.

## 5. `extractFailure` (pure) — read a Playwright run

```ts
// runtime/playwright-runner.ts (alongside parsePlaywrightJson)
export interface PlaywrightFailure { specPath: string; title: string; error: string; }
export function extractFailures(report: PlaywrightJsonReport): PlaywrightFailure[];
```
Walks the report's nested `suites → specs → tests → results`, returning each spec whose result
status is not `passed`/`expected`, with its `file`, `title`, and first error `message`. Lets the
CLI pull `{specPath, errorText}` from a JSON report instead of requiring flags.

## 6. CLI — real `argus triage`

```
argus triage <url> --spec <path> [--error <text>] [--report <playwright.json>] [--model <id>]
```
Reads `--report` (extract first failure → spec+error) or uses `--spec`/`--error`; runs `triage()`;
prints the verdict (`verdict · confidence`), the rationale, and any `suggestedSelector`. Exits
non-zero for `real-bug` (gate stays blocked), zero for `dom-drift`/`flake` (healable).

## 7. Testing (Vitest)

- **`reportVerdict`** — schema validates the enum; bad verdict → registry `execute` returns isError.
- **`extractFailures`** — a canned nested report with one passing + one failing spec → returns the
  failing one with file/title/error; empty report → `[]`.
- **`triage`** — `FakeAnthropicClient` scripted `[ fs_read, dom_testids, report_verdict({verdict:'dom-drift', …}) , end_turn ]` over a real temp `ctx`; assert `result.verdict.verdict === 'dom-drift'` and the suggestedSelector is captured.

## 8. Non-goals (next tickets)

- **Heal** (rewrite locator, verify green, open a PR) — **TRE-39** (checkpoint first — it opens PRs).
- Seeded-drift demo scenario — **TRE-40**. CI on-failure triage → heal-PR job — **TRE-41**.

## 9. Done when

- `reportVerdict` + `extractFailures` + `triage()` exist and are unit-tested.
- `argus triage <url> --spec …` produces a structured verdict (drift/bug/flake) + rationale.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` is green.
