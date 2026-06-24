import type { TestRunResult } from '../tools/types';

export interface MochaStats {
  tests?: number;
  passes?: number;
  pending?: number;
  failures?: number;
}
export interface MochaFailureRaw {
  fullTitle?: string;
  title?: string;
  file?: string;
  err?: { message?: string };
}
export interface MochaReport {
  stats?: MochaStats;
  failures?: MochaFailureRaw[];
}

export interface MochaFailure {
  specPath: string;
  title: string;
  error: string;
}

/** Walk a Mocha-JSON report's failures. Pure. */
export function extractMochaFailures(report: MochaReport): MochaFailure[] {
  return (report.failures ?? []).map((f) => ({
    specPath: f.file ?? '',
    title: f.fullTitle ?? f.title ?? '',
    error: f.err?.message ?? 'unknown failure',
  }));
}

/** Turn a Mocha-JSON report into a TestRunResult. Pure. */
export function parseMochaJson(report: MochaReport, artifactsDir: string): TestRunResult {
  const s = report.stats ?? {};
  const passed = s.passes ?? 0;
  const failed = s.failures ?? 0;
  const parts = [`${passed} passed`, `${failed} failed`];
  if (s.pending) parts.push(`${s.pending} pending`);
  return { passed, failed, summary: parts.join(', '), artifactsDir };
}

/** True when a report has no usable stats, or zero tests collected — treat as a failure.
 *  Catches both the "stats absent/empty" case and the "stats: { tests: 0 }" false-green. */
export function reportHasNoStats(report: MochaReport): boolean {
  return !report.stats || Object.keys(report.stats).length === 0 || (report.stats.tests ?? 0) === 0;
}

/**
 * Best-effort: pull the Mocha-JSON report object (the one carrying `"stats"`) out of a
 * noisy stdout stream — Cypress/Mocha print run banners and tables around it, and Cypress's
 * built-in `json` reporter often ignores `--reporter-options output=<file>` and writes to
 * stdout instead. Returns null if no parseable `{ "stats": … }` object is found, so the
 * caller fails closed rather than greening on garbage. Pure.
 */
export function extractMochaReportFromStdout(text: string): MochaReport | null {
  const key = text.indexOf('"stats"');
  if (key < 0) return null;
  // Walk backwards through candidate opening braces and balanced-parse forward from each.
  let start = text.lastIndexOf('{', key);
  while (start >= 0) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            const obj = JSON.parse(text.slice(start, i + 1)) as MochaReport;
            if (obj && obj.stats) return obj;
          } catch {
            /* not valid JSON from this brace — try an earlier one */
          }
          break;
        }
      }
    }
    start = text.lastIndexOf('{', start - 1);
  }
  return null;
}
