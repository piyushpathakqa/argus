import { describe, it, expect } from 'vitest';
import { ZMemProvider, resolveMemoryProvider } from './zmem-provider';
import { NoopMemoryProvider } from './types';
import type { Exec, ExecResult } from '../runtime/exec';

/** Build a fake Exec that returns canned responses per command (prefix match). */
function makeExec(responses: Record<string, ExecResult>): Exec {
  return async (cmd, args, _opts) => {
    const key = [cmd, ...args].join(' ');
    const match = Object.keys(responses).find((k) => key.startsWith(k));
    if (match) return responses[match]!;
    return { stdout: '', stderr: 'not found', code: 1 };
  };
}

describe('ZMemProvider', () => {
  describe('recall — argv', () => {
    it('calls zmem inject with positional task text and correct flags', async () => {
      const calls: Array<{ cmd: string; args: string[] }> = [];
      const fakeExec: Exec = async (cmd, args) => {
        calls.push({ cmd, args });
        return { stdout: JSON.stringify({ action_id: 'act_1', memories: [], withheld: [] }), stderr: '', code: 0 };
      };
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      await provider.recall({ specPath: 'tests/login.spec.ts', url: 'http://localhost:3100/login', errorText: 'locator not found' });

      expect(calls).toHaveLength(1);
      expect(calls[0]!.cmd).toBe('zmem');
      expect(calls[0]!.args[0]).toBe('inject');
      // positional task text (args[1]) includes the specPath and errorText
      expect(calls[0]!.args[1]).toContain('tests/login.spec.ts');
      expect(calls[0]!.args[1]).toContain('locator not found');
      // remaining flags
      expect(calls[0]!.args).toContain('--agent');
      expect(calls[0]!.args).toContain('vigilis');
      expect(calls[0]!.args).toContain('--risk');
      expect(calls[0]!.args).toContain('high');
      expect(calls[0]!.args).toContain('--scope');
      expect(calls[0]!.args).toContain('project');
    });

    it('omits error suffix in task text when no errorText provided', async () => {
      const calls: Array<{ cmd: string; args: string[] }> = [];
      const fakeExec: Exec = async (cmd, args) => {
        calls.push({ cmd, args });
        return { stdout: JSON.stringify({ action_id: 'act_2', memories: [], withheld: [] }), stderr: '', code: 0 };
      };
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      await provider.recall({ specPath: 'tests/cart.spec.ts', url: 'http://x' });

      expect(calls[0]!.args[1]).not.toContain(' — ');
      expect(calls[0]!.args[1]).toContain('tests/cart.spec.ts');
    });
  });

  describe('recall — parse', () => {
    it('parses memories[] from zmem inject JSON object response', async () => {
      const injectResponse = {
        action_id: 'act_abc123',
        merkle_root: 'abc',
        memories: [
          {
            id: 'mem_2386db3713eb4338',
            content: 'verdict=dom-drift: testid changed | selector=[data-testid="submit-btn"] | spec=tests/login.spec.ts',
            trust: 0.9,
            authority: 'medium',
            status: 'active',
            type: 'episodic',
            scope: 'project',
            labels: [],
          },
        ],
        withheld: [],
        retrieved_memory_ids: ['mem_2386db3713eb4338'],
        injected_memory_ids: ['mem_2386db3713eb4338'],
      };
      const fakeExec = makeExec({
        'zmem inject': { stdout: JSON.stringify(injectResponse), stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({
        specPath: 'tests/login.spec.ts',
        url: 'http://localhost:3100/login',
        errorText: 'locator not found',
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.content).toContain('dom-drift');
      expect(result[0]!.trust).toBe(0.9);
      expect(result[0]!.authority).toBe('medium');
      expect(result[0]!.memoryId).toBe('mem_2386db3713eb4338');
      expect(result[0]!.receiptId).toBe('act_abc123');
    });

    it('returns [] when memories array is empty', async () => {
      const fakeExec = makeExec({
        'zmem inject': {
          stdout: JSON.stringify({ action_id: 'act_1', memories: [], withheld: [] }),
          stderr: '', code: 0,
        },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] on non-JSON stdout', async () => {
      const fakeExec = makeExec({
        'zmem inject': { stdout: 'command not found: zmem', stderr: '', code: 127 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] on empty stdout', async () => {
      const fakeExec = makeExec({
        'zmem inject': { stdout: '', stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] when exec throws', async () => {
      const throwingExec: Exec = async () => { throw new Error('ENOENT: zmem not found'); };
      const provider = new ZMemProvider('/tmp/test', throwingExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] when stdout is a JSON object with no memories key', async () => {
      const fakeExec = makeExec({
        'zmem inject': { stdout: JSON.stringify({ error: 'no results' }), stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('returns [] when memories is not an array', async () => {
      const fakeExec = makeExec({
        'zmem inject': { stdout: JSON.stringify({ action_id: 'act_1', memories: null }), stderr: '', code: 0 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toEqual([]);
    });

    it('skips items in memories[] that have no string content', async () => {
      const fakeExec = makeExec({
        'zmem inject': {
          stdout: JSON.stringify({
            action_id: 'act_1',
            memories: [
              null,
              { id: 'mem_1', content: 42, trust: 0.5 },       // non-string content → skip
              { id: 'mem_2', content: 'valid memory text', trust: 0.8, authority: 'low' },
            ],
          }),
          stderr: '', code: 0,
        },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toHaveLength(1);
      expect(result[0]!.content).toBe('valid memory text');
      expect(result[0]!.trust).toBe(0.8);
      expect(result[0]!.authority).toBe('low');
    });

    it('withheld memories are NOT included in the result', async () => {
      const fakeExec = makeExec({
        'zmem inject': {
          stdout: JSON.stringify({
            action_id: 'act_1',
            memories: [
              { id: 'mem_authorized', content: 'authorized memory', trust: 0.9, authority: 'high' },
            ],
            withheld: [
              { id: 'mem_withheld', content: 'quarantined memory', trust: 0.5 },
            ],
          }),
          stderr: '', code: 0,
        },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      const result = await provider.recall({ specPath: 'a.spec.ts', url: 'http://x' });
      expect(result).toHaveLength(1);
      expect(result[0]!.content).toBe('authorized memory');
    });
  });

  describe('record — argv', () => {
    it('calls zmem propose with positional content and correct flags', async () => {
      const calls: Array<{ cmd: string; args: string[] }> = [];
      const fakeExec: Exec = async (cmd, args) => {
        calls.push({ cmd, args });
        return { stdout: '{"ok":true}', stderr: '', code: 0 };
      };
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      await provider.record({
        specPath: 'tests/login.spec.ts',
        url: 'http://localhost:3100/login',
        verdict: 'dom-drift',
        rationale: 'testid changed',
        suggestedSelector: '[data-testid="submit-btn"]',
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]!.cmd).toBe('zmem');
      expect(calls[0]!.args[0]).toBe('propose');
      // positional content (args[1]) serializes the entry
      const content = calls[0]!.args[1]!;
      expect(content).toContain('verdict=dom-drift');
      expect(content).toContain('testid changed');
      expect(content).toContain('selector=[data-testid="submit-btn"]');
      expect(content).toContain('spec=tests/login.spec.ts');
      // remaining flags
      expect(calls[0]!.args).toContain('--type');
      expect(calls[0]!.args).toContain('episodic');
      expect(calls[0]!.args).toContain('--scope');
      expect(calls[0]!.args).toContain('project');
      expect(calls[0]!.args).toContain('--source');
      expect(calls[0]!.args).toContain('agent');
    });

    it('omits selector from content when none provided', async () => {
      const calls: Array<{ cmd: string; args: string[] }> = [];
      const fakeExec: Exec = async (cmd, args) => {
        calls.push({ cmd, args });
        return { stdout: '', stderr: '', code: 0 };
      };
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      await provider.record({
        specPath: 'tests/cart.spec.ts',
        url: 'http://x',
        verdict: 'real-bug',
        rationale: 'button missing',
      });

      const content = calls[0]!.args[1]!;
      expect(content).not.toContain('selector=');
    });

    it('resolves even when exec throws', async () => {
      const throwingExec: Exec = async () => { throw new Error('ENOENT'); };
      const provider = new ZMemProvider('/tmp/test', throwingExec);
      await expect(
        provider.record({ specPath: 'a.spec.ts', url: 'http://x', verdict: 'real-bug', rationale: 'broken' }),
      ).resolves.toBeUndefined();
    });

    it('resolves even when zmem exits non-zero', async () => {
      const fakeExec = makeExec({
        'zmem propose': { stdout: '', stderr: 'zmem: error', code: 1 },
      });
      const provider = new ZMemProvider('/tmp/test', fakeExec);
      await expect(
        provider.record({ specPath: 'a.spec.ts', url: 'http://x', verdict: 'flake', rationale: 'transient' }),
      ).resolves.toBeUndefined();
    });
  });
});

describe('resolveMemoryProvider', () => {
  it('returns NoopMemoryProvider when mode is off', async () => {
    const fakeExec: Exec = async () => ({ stdout: '', stderr: '', code: 0 });
    const provider = await resolveMemoryProvider('/tmp', { mode: 'off', exec: fakeExec });
    expect(provider).toBeInstanceOf(NoopMemoryProvider);
  });

  it('returns ZMemProvider when mode is zmem', async () => {
    const fakeExec: Exec = async () => ({ stdout: '', stderr: '', code: 0 });
    const provider = await resolveMemoryProvider('/tmp', { mode: 'zmem', exec: fakeExec });
    expect(provider).toBeInstanceOf(ZMemProvider);
  });

  it('returns ZMemProvider when mode is auto and zmem is on PATH', async () => {
    const fakeExec = makeExec({
      'zmem --version': { stdout: 'zmem 0.1.0', stderr: '', code: 0 },
    });
    const provider = await resolveMemoryProvider('/tmp', { mode: 'auto', exec: fakeExec });
    expect(provider).toBeInstanceOf(ZMemProvider);
  });

  it('returns NoopMemoryProvider when mode is auto and zmem is not on PATH', async () => {
    const fakeExec: Exec = async () => ({ stdout: '', stderr: 'not found', code: 127 });
    const provider = await resolveMemoryProvider('/tmp', { mode: 'auto', exec: fakeExec });
    expect(provider).toBeInstanceOf(NoopMemoryProvider);
  });

  it('returns NoopMemoryProvider when mode is auto and exec throws', async () => {
    const throwingExec: Exec = async () => { throw new Error('ENOENT'); };
    const provider = await resolveMemoryProvider('/tmp', { mode: 'auto', exec: throwingExec });
    expect(provider).toBeInstanceOf(NoopMemoryProvider);
  });

  it('defaults to auto mode when no opts provided — uses fake exec to confirm interface shape', async () => {
    const notFoundExec: Exec = async () => ({ stdout: '', stderr: 'not found', code: 127 });
    const provider = await resolveMemoryProvider('/tmp', { exec: notFoundExec });
    expect(provider).toBeInstanceOf(NoopMemoryProvider);
    expect(typeof provider.recall).toBe('function');
    expect(typeof provider.record).toBe('function');
  });
});
