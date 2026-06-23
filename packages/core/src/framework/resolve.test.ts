import { describe, it, expect } from 'vitest';
import { resolveAdapter } from './resolve';

describe('resolveAdapter', () => {
  it('returns the CypressAdapter for an explicit cypress override', async () => {
    const a = await resolveAdapter(process.cwd(), 'cypress');
    expect(a.name).toBe('cypress');
  });

  it('returns the PlaywrightAdapter for an explicit playwright override', async () => {
    const a = await resolveAdapter(process.cwd(), 'playwright');
    expect(a.name).toBe('playwright');
  });

  it('still throws a clear error for the not-yet-built selenium adapter', async () => {
    await expect(resolveAdapter(process.cwd(), 'selenium')).rejects.toThrow(/not yet implemented/);
  });
});
