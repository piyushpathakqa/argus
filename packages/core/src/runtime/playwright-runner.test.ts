import { describe, it, expect } from 'vitest';
import { extractFailures, parsePlaywrightJson, PlaywrightTestRunner } from './playwright-runner';

describe('parsePlaywrightJson', () => {
  it('maps expected→passed and unexpected→failed', () => {
    const r = parsePlaywrightJson(
      { stats: { expected: 3, unexpected: 1, flaky: 0, skipped: 0 } },
      'test-results',
    );
    expect(r).toEqual({
      passed: 3,
      failed: 1,
      summary: '3 passed, 1 failed',
      artifactsDir: 'test-results',
    });
  });

  it('treats flaky as failed and reports it in the summary', () => {
    const r = parsePlaywrightJson(
      { stats: { expected: 2, unexpected: 0, flaky: 1, skipped: 1 } },
      'test-results',
    );
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.summary).toMatch(/flaky/);
  });

  it('handles a missing/empty stats block', () => {
    const r = parsePlaywrightJson({}, 'out');
    expect(r).toEqual({ passed: 0, failed: 0, summary: '0 passed, 0 failed', artifactsDir: 'out' });
  });
});

describe('PlaywrightTestRunner', () => {
  it('runs the json reporter and returns the parsed result', async () => {
    let calledWith: { cmd: string; args: string[] } | undefined;
    const fakeExec = async (cmd: string, args: string[]) => {
      calledWith = { cmd, args };
      return {
        stdout: JSON.stringify({ stats: { expected: 5, unexpected: 0 } }),
        stderr: '',
        code: 0,
      };
    };
    const runner = new PlaywrightTestRunner({ cwd: '/ws', exec: fakeExec });
    const result = await runner.run('tests/cart.spec.ts');
    expect(calledWith?.cmd).toBe('npx');
    expect(calledWith?.args).toEqual([
      'playwright',
      'test',
      'tests/cart.spec.ts',
      '--reporter=json',
    ]);
    expect(result.passed).toBe(5);
    expect(result.failed).toBe(0);
  });

  it('runs all specs when no path is given', async () => {
    const fakeExec = async () => ({ stdout: JSON.stringify({ stats: {} }), stderr: '', code: 1 });
    const runner = new PlaywrightTestRunner({ cwd: '/ws', exec: fakeExec });
    const result = await runner.run();
    expect(result.summary).toBe('0 passed, 0 failed');
  });
});

describe('extractFailures', () => {
  const report = {
    suites: [
      {
        specs: [
          {
            file: 'tests/generated/login.spec.ts',
            title: 'logs in',
            tests: [{ results: [{ status: 'passed' }] }],
          },
        ],
        suites: [
          {
            specs: [
              {
                file: 'tests/generated/cart.spec.ts',
                title: 'adds to cart',
                tests: [
                  {
                    results: [
                      { status: 'failed', error: { message: 'locator not found: add-to-cart' } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  it('returns only failing specs, recursing nested suites', () => {
    const failures = extractFailures(report);
    expect(failures).toEqual([
      {
        specPath: 'tests/generated/cart.spec.ts',
        title: 'adds to cart',
        error: 'locator not found: add-to-cart',
      },
    ]);
  });

  it('returns [] for an empty report', () => {
    expect(extractFailures({})).toEqual([]);
  });
});
