import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from './registry';
import { defineTool, ToolError, type ToolContext } from './types';

const ctx = {} as ToolContext;

const echo = defineTool({
  name: 'echo',
  description: 'Echo a message',
  input: z.object({ msg: z.string() }),
  handler: async ({ msg }) => ({ content: `echo: ${msg}` }),
});

const boom = defineTool({
  name: 'boom',
  description: 'Always throws',
  input: z.object({}),
  handler: async () => {
    throw new ToolError('kaboom');
  },
});

describe('ToolRegistry', () => {
  it('registers, lists, and gets tools', () => {
    const r = new ToolRegistry();
    r.register(echo);
    expect(r.list().map((t) => t.name)).toEqual(['echo']);
    expect(r.get('echo')?.description).toBe('Echo a message');
    expect(r.get('nope')).toBeUndefined();
  });

  it('rejects duplicate names', () => {
    const r = new ToolRegistry();
    r.register(echo);
    expect(() => r.register(echo)).toThrow(/already registered/i);
  });

  it('executes a tool with valid input', async () => {
    const r = new ToolRegistry();
    r.register(echo);
    expect(await r.execute('echo', { msg: 'hi' }, ctx)).toEqual({ content: 'echo: hi' });
  });

  it('returns isError for an unknown tool', async () => {
    const r = new ToolRegistry();
    const res = await r.execute('ghost', {}, ctx);
    expect(res.isError).toBe(true);
    expect(res.content).toMatch(/unknown tool: ghost/i);
  });

  it('returns isError for invalid input instead of throwing', async () => {
    const r = new ToolRegistry();
    r.register(echo);
    const res = await r.execute('echo', { msg: 123 }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content).toMatch(/invalid input for echo/i);
  });

  it('defaults nullish input to {} before validating', async () => {
    const r = new ToolRegistry();
    r.register(boom);
    const res = await r.execute('boom', undefined, ctx);
    expect(res.isError).toBe(true);
    expect(res.content).toBe('kaboom');
  });

  it('catches a throwing handler and reports it as isError', async () => {
    const r = new ToolRegistry();
    r.register(boom);
    const res = await r.execute('boom', {}, ctx);
    expect(res).toEqual({ content: 'kaboom', isError: true });
  });
});
