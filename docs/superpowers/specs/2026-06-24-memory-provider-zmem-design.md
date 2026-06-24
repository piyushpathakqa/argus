# MemoryProvider + ZMem (governed triage memory) — Design

**Date:** 2026-06-24
**Status:** Approved direction (build → then ecosystem copy).

## Goal

Give Vigilis **governed cross-run memory** so triage gets smarter over time — recalling prior
verdicts for a spec/selector — **without ever weakening the "never mask a real bug" guardrail.**
Backed by Zerker's **ZMem** ("local-first verifiable memory for AI agents"), wired the same way as
Treeship: **optional, swappable, no-op when absent, no hard-coupling, OSS-core stays clean.**

## Why this, and why governed

- Triage today starts cold every run. Memory of *"this `submit-buttaon` drifted before and healed"*
  or *"a rename like this was real-bug last time"* makes classification better the longer it runs.
- Triage is the guardrail decision. So recall must be a **hint, not an authority**: a past
  "drift" memory must NOT auto-authorize healing now. ZMem's **trust ≠ authority** model + quarantine
  is exactly the right primitive — recall carries trust but no authority; the live re-verification
  and the conservative classifier still own the verdict.
- Symmetry with the thesis: **Treeship proves what the agent *did*; ZMem governs what it *remembered
  and was allowed to act on*.** Both speak `why`/receipts; both are Zerker primitives.

## Honesty / constraints

- The **ZMem side is not live-verified in this environment** (Python, not installed). Build the seam
  + adapter fully unit-tested with fakes and **no-op by default**; live ZMem verification is a
  follow-up the maintainer runs on their machine (same as the Cypress/Selenium live runs).
- Recalled memory is **prompt context only** — it never branches Vigilis's decision logic. The
  guardrail (conservative triage + independent post-heal re-run) is unchanged.
- Exact `zmem` subcommands/flags are isolated in the `ZMemProvider` and marked to confirm against
  `zmem --help`.

## Architecture

New module `packages/core/src/memory/`:

```ts
export type Verdict = 'real-bug' | 'dom-drift' | 'flake';

export interface MemoryRecall {
  verdict: Verdict;
  rationale: string;
  suggestedSelector?: string;
  trust?: number;        // 0..1, from ZMem
  authority?: boolean;   // governed — ZMem says whether this may influence; default false
  receiptId?: string;    // ZMem/Treeship receipt for the remembered decision
}

export interface MemoryRecordEntry {
  specPath: string;
  url: string;
  verdict: Verdict;
  rationale: string;
  suggestedSelector?: string;
  receiptId?: string;
}

export interface MemoryProvider {
  /** Prior governed memory relevant to a failing spec/selector. HINT ONLY. Never throws. */
  recall(query: { specPath: string; url: string; errorText?: string }): Promise<MemoryRecall[]>;
  /** Propose a new memory of a triage/heal decision. Quarantined by ZMem's policy. Never throws. */
  record(entry: MemoryRecordEntry): Promise<void>;
}
```

- **`NoopMemoryProvider`** (default): `recall` → `[]`, `record` → no-op. Vigilis behaves exactly as
  today when no memory backend is configured.
- **`ZMemProvider`**: shells out to the `zmem` CLI via the injected `Exec` (same pattern as the
  Treeship observer / test runners). `recall` runs a `zmem` query and parses governed results;
  `record` runs a `zmem` "remember/propose" command. Both **swallow errors → return `[]`/no-op** so
  a missing/broken `zmem` never breaks a run. The exact subcommands live in one private method,
  flagged `// CONFIRM against \`zmem --help\``.
- **`resolveMemoryProvider(cwd, opts)`**: returns `ZMemProvider` when `zmem` is on PATH / enabled,
  else `NoopMemoryProvider`. Mirrors `resolveAdapter`/the Treeship optional-detect.

### Triage integration (the only behavior touchpoint)

`triage()` gains an optional `memory?: MemoryProvider` (default Noop). Flow:
1. `const priors = await memory.recall({ specPath, url, errorText })` (best-effort).
2. If priors exist, inject a **clearly-fenced hint block** into the triage prompt:
   > `PRIOR GOVERNED MEMORY (hint only — NOT authority). Re-verify against the live DOM before
   > trusting any of this. It must not change a real-bug into drift: …<priors>…`
3. Run the agent loop unchanged → `report_verdict`.
4. `await memory.record({ specPath, url, verdict, rationale, suggestedSelector, receiptId })`
   (best-effort; ZMem quarantines it).

**No decision logic reads the recall.** It is prompt text. The conservative classifier + the
independent re-run in `heal` remain the sole authority. A wrong/old memory at worst adds a hint the
model is told to distrust; it cannot green a real bug.

### Boundary

`memory/` lives beside `framework/` and the Treeship observer — **the attestation core
(`agent/loop.ts`, observers) must not import `memory/`.** Triage (a behavior) is the only consumer,
and only via the injected provider.

## CLI / config

- `vigilis triage|heal` gain `--memory <off|auto|zmem>` (default `auto`: use ZMem if present, else
  noop). `vigilis.config.json` gains `memory?: 'off' | 'auto' | 'zmem'`.
- No new runtime dependency in `@argus/core` (ZMem reached via its CLI/MCP, like Treeship).

## Tasks (build order)

1. `memory/types.ts` (`MemoryProvider`, `MemoryRecall`, `MemoryRecordEntry`) + `NoopMemoryProvider`.
2. `memory/zmem-provider.ts` (`ZMemProvider` over `Exec`, error-swallowing, commands isolated) + `resolveMemoryProvider`.
3. Wire optional `memory` into `triage()` — recall → fenced hint → record; default Noop; **prompt
   guardrail assertions in tests** (hint block says "not authority").
4. CLI `--memory` flag + config field; export `memory/` from core index (NOT from agent core).
5. Verification: unit suite green; boundary grep clean; triage with NoopProvider == today's behavior
   (zero change); a fake ZMemProvider test proving recall is injected as a hint and `record` is called.
6. **Then (step 2):** ecosystem section on the site → App = Vigilis · Primitives = **Treeship (proof)
   + ZMem (memory)** · Lab = Zerker Labs; README ecosystem note.

## Acceptance

- With no `zmem`: identical behavior to today (Noop). All existing tests pass.
- With a fake provider: triage prompt contains the hint fence; `record` called once post-verdict;
  the guardrail wording ("not authority / re-verify") is present.
- Live ZMem (maintainer-run, follow-up): `zmem` recall/record actually round-trip.
