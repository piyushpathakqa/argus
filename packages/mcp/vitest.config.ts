import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Resolve @argus/core to its TypeScript source (not the built dist) so tests run
// without a prior build — mirroring the tsconfig `paths` used for typecheck.
export default defineConfig({
  resolve: {
    alias: {
      '@argus/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
});
