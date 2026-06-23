import { detectFramework, pickFramework } from './detect';
import { PlaywrightAdapter } from './playwright-adapter';
import type { Framework, FrameworkAdapter } from './types';

const ADAPTERS: Partial<Record<Framework, () => FrameworkAdapter>> = {
  playwright: () => new PlaywrightAdapter(),
  // cypress, selenium land in SP2 / SP3
};

/**
 * Resolve the adapter for a project. An explicit `override` (CLI --framework / config)
 * wins; otherwise detect from cwd; otherwise default to Playwright.
 */
export async function resolveAdapter(cwd: string, override?: Framework): Promise<FrameworkAdapter> {
  const chosen = override ?? pickFramework(await detectFramework(cwd)) ?? 'playwright';
  const make = ADAPTERS[chosen];
  if (!make) throw new Error(`Framework "${chosen}" is detected but its adapter is not built yet.`);
  return make();
}
