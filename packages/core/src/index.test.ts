import { describe, expect, it } from 'vitest';
import { MODELS, resolveModel } from './index.js';

describe('@argus/core config', () => {
  it('defaults the primary tier to an Opus model', () => {
    expect(resolveModel()).toBe(MODELS.primary);
    expect(MODELS.primary).toContain('opus');
  });

  it('resolves the fast tier', () => {
    expect(resolveModel('fast')).toBe(MODELS.fast);
  });
});
