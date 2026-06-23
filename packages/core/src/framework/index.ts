export { FRAMEWORKS } from './types';
export type { Framework, FrameworkAdapter, RunnerOpts } from './types';
export { detectFramework, pickFramework } from './detect';
export type { FrameworkScore, DetectFs } from './detect';
export { PlaywrightAdapter } from './playwright-adapter';
export { resolveAdapter } from './resolve';
