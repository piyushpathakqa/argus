import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { heal } from './heal';
import { FakeAnthropicClient, FakeTestRunner, makeFakeCtx, makeMessage } from '../tools/testing/fakes';

async function scratchSpec() {
  const root = await mkdtemp(join(tmpdir(), 'argus-heal-'));
  await mkdir(join(root, 'tests/generated'), { recursive: true });
  await writeFile(join(root, 'tests/generated/login.spec.ts'), '// stale', 'utf8');
  return root;
}

const fixTurns = () => [
  makeMessage(
    [{ type: 'tool_use', id: 'r1', name: 'fs_read', input: { path: 'tests/generated/login.spec.ts' } }],
    'tool_use',
  ),
  makeMessage(
    [
      {
        type: 'tool_use',
        id: 'w1',
        name: 'fs_write',
        input: { path: 'tests/generated/login.spec.ts', content: '// fixed with new selector' },
      },
    ],
    'tool_use',
  ),
  makeMessage([{ type: 'text', text: 'Fixed the locator.' }], 'end_turn'),
];

describe('heal', () => {
  it('verifies green via an independent re-run and reports the changed file', async () => {
    const root = await scratchSpec();
    try {
      const runner = new FakeTestRunner(); // default result: failed: 0
      const result = await heal({
        client: new FakeAnthropicClient(fixTurns()),
        specPath: 'tests/generated/login.spec.ts',
        url: 'http://localhost:3100/login',
        suggestedSelector: '[data-testid="submit-btn"]',
        ctx: makeFakeCtx({ workspaceRoot: root, runner }),
      });
      expect(result.verified).toBe(true);
      expect(result.changedFiles).toContain('tests/generated/login.spec.ts');
      expect(runner.lastSpec).toBe('tests/generated/login.spec.ts'); // re-ran the exact spec
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reports not-verified when the re-run still fails', async () => {
    const root = await scratchSpec();
    try {
      const runner = new FakeTestRunner();
      runner.result = { passed: 0, failed: 1, summary: '0 passed, 1 failed', artifactsDir: 't' };
      const result = await heal({
        client: new FakeAnthropicClient(fixTurns()),
        specPath: 'tests/generated/login.spec.ts',
        url: 'http://localhost:3100/login',
        suggestedSelector: '[data-testid="submit-btn"]',
        ctx: makeFakeCtx({ workspaceRoot: root, runner }),
      });
      expect(result.verified).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
