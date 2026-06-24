import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestRunner, TestRunResult } from '../tools/types';
import { defaultExec, type Exec } from './exec';
import {
  parseMochaJson,
  reportHasNoStats,
  extractMochaReportFromStdout,
  type MochaReport,
} from './mocha-json';

export interface SeleniumTestRunnerOptions {
  cwd: string;
  exec?: Exec;
  artifactsDir?: string;
  readReport?: (path: string) => Promise<string>;
}

/** Runs `npx mocha <spec> --reporter json` (writing JSON to a file) and parses it. Fails closed. */
export class SeleniumTestRunner implements TestRunner {
  constructor(private readonly opts: SeleniumTestRunnerOptions) {}

  async run(specPath?: string): Promise<TestRunResult> {
    const exec = this.opts.exec ?? defaultExec;
    const readReport = this.opts.readReport ?? ((p: string) => readFile(p, 'utf8'));
    const artifactsDir = this.opts.artifactsDir ?? 'test-results';
    const reportPath = join(tmpdir(), 'vigilis-selenium-report.json');
    const failClosed: TestRunResult = {
      passed: 0,
      failed: 1,
      summary: 'mocha/selenium produced no parseable report (treated as failure)',
      artifactsDir,
    };

    const args = [
      'mocha',
      ...(specPath ? [specPath] : ['tests/selenium/**/*.test.ts']),
      '--reporter',
      'json',
      '--reporter-options',
      `output=${reportPath}`,
    ];
    const { stdout } = await exec('npx', args, { cwd: this.opts.cwd });

    // Prefer the file; fall back to the JSON mocha prints to stdout. Fail closed otherwise.
    let report: MochaReport | undefined;
    try {
      report = JSON.parse(await readReport(reportPath)) as MochaReport;
    } catch {
      report = undefined;
    }
    if (!report || reportHasNoStats(report)) {
      report = extractMochaReportFromStdout(stdout) ?? undefined;
    }
    if (!report || reportHasNoStats(report)) return failClosed;
    return parseMochaJson(report, artifactsDir);
  }
}
