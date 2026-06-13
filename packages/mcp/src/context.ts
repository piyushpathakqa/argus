import {
  createPlaywrightSession,
  PlaywrightTestRunner,
  type ToolContext,
} from '@argus/core';

export interface LazyContext {
  getContext: () => Promise<ToolContext>;
  close: () => Promise<void>;
}

/**
 * A tool context that launches chromium on first use (so merely starting the
 * server doesn't spawn a browser) and reuses it thereafter.
 */
export function createLazyContext(): LazyContext {
  let ctx: ToolContext | undefined;
  let close: (() => Promise<void>) | undefined;

  return {
    getContext: async () => {
      if (!ctx) {
        const handle = await createPlaywrightSession({ headless: true });
        close = handle.close;
        ctx = {
          workspaceRoot: process.cwd(),
          browser: handle.session,
          runner: new PlaywrightTestRunner({ cwd: process.cwd() }),
        };
      }
      return ctx;
    },
    close: async () => {
      if (close) await close();
    },
  };
}
