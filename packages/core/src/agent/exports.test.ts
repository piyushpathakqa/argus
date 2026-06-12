import { describe, it, expect } from 'vitest';
import * as core from '../index';

describe('@argus/core agent + runtime exports', () => {
  it('exposes the agent loop and runtime classes', () => {
    for (const name of [
      'runAgentLoop',
      'createAnthropicClient',
      'ConsoleObserver',
      'PlaywrightBrowserSession',
      'createPlaywrightSession',
      'PlaywrightTestRunner',
      'parsePlaywrightJson',
    ]) {
      expect(name in core, name).toBe(true);
    }
  });
});
