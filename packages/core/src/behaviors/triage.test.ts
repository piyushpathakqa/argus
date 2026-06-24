import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { triage } from './triage';
import { FakeAnthropicClient, makeFakeCtx, makeMessage } from '../tools/testing/fakes';
import type { MemoryProvider, MemoryRecall, MemoryRecordEntry } from '../memory/types';
import { NoopMemoryProvider } from '../memory/types';

describe('triage', () => {
  it('captures a structured verdict from the report_verdict tool call', async () => {
    const root = await mkdtemp(join(tmpdir(), 'argus-triage-'));
    try {
      await mkdir(join(root, 'tests/generated'), { recursive: true });
      await writeFile(join(root, 'tests/generated/login.spec.ts'), '// spec', 'utf8');

      const client = new FakeAnthropicClient([
        makeMessage(
          [{ type: 'tool_use', id: 't1', name: 'fs_read', input: { path: 'tests/generated/login.spec.ts' } }],
          'tool_use',
        ),
        makeMessage([{ type: 'tool_use', id: 't2', name: 'dom_testids', input: {} }], 'tool_use'),
        makeMessage(
          [
            {
              type: 'tool_use',
              id: 't3',
              name: 'report_verdict',
              input: {
                verdict: 'dom-drift',
                confidence: 'high',
                rationale: 'login-submit testid is now submit-btn',
                suggestedSelector: '[data-testid="submit-btn"]',
              },
            },
          ],
          'tool_use',
        ),
        makeMessage([{ type: 'text', text: 'Classified as dom-drift.' }], 'end_turn'),
      ]);

      const result = await triage({
        client,
        specPath: 'tests/generated/login.spec.ts',
        url: 'http://localhost:3100/login',
        errorText: 'locator [data-testid="login-submit"] not found',
        ctx: makeFakeCtx({ workspaceRoot: root }),
      });

      expect(result.verdict?.verdict).toBe('dom-drift');
      expect(result.verdict?.suggestedSelector).toBe('[data-testid="submit-btn"]');
      expect(result.run.stopReason).toBe('end_turn');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('with NoopMemoryProvider, the system prompt has no hint block', async () => {
    const root = await mkdtemp(join(tmpdir(), 'argus-triage-noop-'));
    try {
      await mkdir(join(root, 'tests/generated'), { recursive: true });
      await writeFile(join(root, 'tests/generated/login.spec.ts'), '// spec', 'utf8');

      const capturedSystems: string[] = [];
      const client = new FakeAnthropicClient([
        makeMessage(
          [
            {
              type: 'tool_use',
              id: 't1',
              name: 'report_verdict',
              input: {
                verdict: 'dom-drift',
                confidence: 'high',
                rationale: 'testid changed',
                suggestedSelector: '[data-testid="new-btn"]',
              },
            },
          ],
          'tool_use',
        ),
        makeMessage([{ type: 'text', text: 'Done.' }], 'end_turn'),
      ]);

      // Wrap client to capture the system prompt
      const wrappedClient = {
        messages: {
          create: async (body: Parameters<typeof client.messages.create>[0]) => {
            capturedSystems.push(body.system ?? '');
            return client.messages.create(body);
          },
        },
      };

      await triage({
        client: wrappedClient,
        specPath: 'tests/generated/login.spec.ts',
        url: 'http://localhost:3100/login',
        errorText: 'locator not found',
        ctx: makeFakeCtx({ workspaceRoot: root }),
        memory: new NoopMemoryProvider(),
      });

      // With Noop, the system prompt must NOT contain the hint fence
      expect(capturedSystems[0]).not.toContain('PRIOR GOVERNED MEMORY');
      expect(capturedSystems[0]).not.toContain('NOT authority');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('with a fake provider returning one prior, the system prompt contains the hint fence and record is called', async () => {
    const root = await mkdtemp(join(tmpdir(), 'argus-triage-fake-'));
    try {
      await mkdir(join(root, 'tests/generated'), { recursive: true });
      await writeFile(join(root, 'tests/generated/login.spec.ts'), '// spec', 'utf8');

      const capturedSystems: string[] = [];
      const recordedEntries: MemoryRecordEntry[] = [];

      const fakePrior: MemoryRecall = {
        verdict: 'dom-drift',
        rationale: 'testid was login-submit, is now submit-btn',
        suggestedSelector: '[data-testid="submit-btn"]',
        trust: 0.85,
        authority: false,
      };

      const fakeProvider: MemoryProvider = {
        recall: async (_query) => [fakePrior],
        record: async (entry) => {
          recordedEntries.push(entry);
        },
      };

      const client = new FakeAnthropicClient([
        makeMessage(
          [
            {
              type: 'tool_use',
              id: 't1',
              name: 'report_verdict',
              input: {
                verdict: 'dom-drift',
                confidence: 'high',
                rationale: 'testid changed',
                suggestedSelector: '[data-testid="submit-btn"]',
              },
            },
          ],
          'tool_use',
        ),
        makeMessage([{ type: 'text', text: 'Done.' }], 'end_turn'),
      ]);

      const wrappedClient = {
        messages: {
          create: async (body: Parameters<typeof client.messages.create>[0]) => {
            capturedSystems.push(body.system ?? '');
            return client.messages.create(body);
          },
        },
      };

      const result = await triage({
        client: wrappedClient,
        specPath: 'tests/generated/login.spec.ts',
        url: 'http://localhost:3100/login',
        errorText: 'locator not found',
        ctx: makeFakeCtx({ workspaceRoot: root }),
        memory: fakeProvider,
      });

      // System prompt must contain the hint fence
      expect(capturedSystems[0]).toContain('PRIOR GOVERNED MEMORY');
      expect(capturedSystems[0]).toContain('NOT authority');
      expect(capturedSystems[0]).toContain('re-verify against the live DOM');
      expect(capturedSystems[0]).toContain('dom-drift');
      expect(capturedSystems[0]).toContain('testid was login-submit, is now submit-btn');

      // record must have been called once with the verdict
      expect(recordedEntries).toHaveLength(1);
      expect(recordedEntries[0]!.verdict).toBe('dom-drift');
      expect(recordedEntries[0]!.rationale).toBe('testid changed');
      expect(recordedEntries[0]!.specPath).toBe('tests/generated/login.spec.ts');
      expect(recordedEntries[0]!.url).toBe('http://localhost:3100/login');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
