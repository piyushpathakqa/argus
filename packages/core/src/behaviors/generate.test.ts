import { describe, it, expect } from 'vitest';
import { specPathForUrl } from './generate';

describe('specPathForUrl', () => {
  it('maps the root path to home', () => {
    expect(specPathForUrl('http://localhost:3100/')).toBe('tests/generated/home.spec.ts');
  });
  it('maps a single segment to its slug', () => {
    expect(specPathForUrl('http://localhost:3100/login')).toBe('tests/generated/login.spec.ts');
  });
  it('joins nested segments with a dash and lowercases', () => {
    expect(specPathForUrl('http://localhost:3100/Products/42')).toBe(
      'tests/generated/products-42.spec.ts',
    );
  });
  it('honours a custom outDir', () => {
    expect(specPathForUrl('http://x/login', 'tests/e2e')).toBe('tests/e2e/login.spec.ts');
  });
  it('falls back to home for an empty/garbage path', () => {
    expect(specPathForUrl('http://x')).toBe('tests/generated/home.spec.ts');
  });
});
