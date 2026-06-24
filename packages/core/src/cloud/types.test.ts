import { describe, it, expect } from 'vitest';
import { NoopCloudReporter } from './types';
import type { CloudReceipt } from './types';

describe('CloudReceipt type shape', () => {
  it('accepts a full receipt object', () => {
    const r: CloudReceipt = {
      specPath: 'tests/login.spec.ts',
      url: 'http://localhost:3100/login',
      verdict: 'dom-drift',
      healed: true,
      rationale: 'testid changed',
      suggestedSelector: '[data-testid="submit-btn"]',
      framework: 'playwright',
      repo: 'piyushpathakqa/Vigilis',
      receiptId: 'sess_abc123',
      receiptUrl: 'https://treeship.dev/receipt/abc',
      timestamp: '2026-06-24T00:00:00.000Z',
    };
    expect(r.verdict).toBe('dom-drift');
    expect(r.healed).toBe(true);
    expect(r.repo).toBe('piyushpathakqa/Vigilis');
  });

  it('accepts a minimal receipt object (only required fields)', () => {
    const r: CloudReceipt = {
      specPath: 'tests/login.spec.ts',
      url: 'http://localhost:3100/login',
      verdict: 'real-bug',
      healed: false,
      timestamp: '2026-06-24T00:00:00.000Z',
    };
    expect(r.healed).toBe(false);
    expect(r.rationale).toBeUndefined();
    expect(r.receiptUrl).toBeUndefined();
  });
});

describe('NoopCloudReporter', () => {
  it('report() resolves without doing anything', async () => {
    const noop = new NoopCloudReporter();
    await expect(noop.report()).resolves.toBeUndefined();
  });
});
