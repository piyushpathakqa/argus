import { describe, it, expect } from 'vitest';
import { NoopMemoryProvider } from './types';
import type { MemoryRecall } from './types';

describe('MemoryRecall type shape', () => {
  it('accepts a full recall object from zmem inject response', () => {
    const recall: MemoryRecall = {
      content: 'verdict=dom-drift: testid changed | selector=[data-testid="submit-btn"] | spec=tests/login.spec.ts',
      trust: 0.9,
      authority: 'medium',
      memoryId: 'mem_2386db3713eb4338',
      receiptId: 'act_abc123',
    };
    expect(recall.content).toContain('dom-drift');
    expect(recall.trust).toBe(0.9);
    expect(recall.authority).toBe('medium');
    expect(recall.memoryId).toBe('mem_2386db3713eb4338');
    expect(recall.receiptId).toBe('act_abc123');
  });

  it('accepts a minimal recall object (only content required)', () => {
    const recall: MemoryRecall = { content: 'some remembered text' };
    expect(recall.content).toBe('some remembered text');
    expect(recall.trust).toBeUndefined();
    expect(recall.authority).toBeUndefined();
    expect(recall.memoryId).toBeUndefined();
    expect(recall.receiptId).toBeUndefined();
  });
});

describe('NoopMemoryProvider', () => {
  it('recall always returns empty array', async () => {
    const provider = new NoopMemoryProvider();
    const result = await provider.recall({
      specPath: 'tests/login.spec.ts',
      url: 'http://localhost:3100/login',
      errorText: 'element not found',
    });
    expect(result).toEqual([]);
  });

  it('recall returns empty array with no errorText', async () => {
    const provider = new NoopMemoryProvider();
    const result = await provider.recall({
      specPath: 'tests/login.spec.ts',
      url: 'http://localhost:3100/login',
    });
    expect(result).toEqual([]);
  });

  it('record resolves without throwing', async () => {
    const provider = new NoopMemoryProvider();
    await expect(
      provider.record({
        specPath: 'tests/login.spec.ts',
        url: 'http://localhost:3100/login',
        verdict: 'dom-drift',
        rationale: 'testid changed',
        suggestedSelector: '[data-testid="new-btn"]',
      }),
    ).resolves.toBeUndefined();
  });

  it('record resolves for real-bug verdict', async () => {
    const provider = new NoopMemoryProvider();
    await expect(
      provider.record({
        specPath: 'tests/cart.spec.ts',
        url: 'http://localhost:3100/cart',
        verdict: 'real-bug',
        rationale: 'button is gone',
      }),
    ).resolves.toBeUndefined();
  });
});
