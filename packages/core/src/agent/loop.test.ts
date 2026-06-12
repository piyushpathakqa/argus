import { describe, it, expect } from 'vitest';
import { runAgentLoop } from './loop';
import { createDefaultRegistry } from '../tools/definitions';
import {
  FakeAnthropicClient,
  FakeBrowserSession,
  makeFakeCtx,
  makeMessage,
} from '../tools/testing/fakes';

describe('runAgentLoop', () => {
  it('runs a tool_use turn, feeds the result back, and returns final text', async () => {
    const client = new FakeAnthropicClient([
      makeMessage(
        [{ type: 'tool_use', id: 'tu_1', name: 'browser_navigate', input: { url: 'http://x/' } }],
        'tool_use',
      ),
      makeMessage([{ type: 'text', text: 'Done exploring.' }], 'end_turn'),
    ]);
    const browser = new FakeBrowserSession();
    const ctx = makeFakeCtx({ browser });

    const calls: string[] = [];
    const result = await runAgentLoop({
      client,
      system: 'sys',
      prompt: 'go',
      registry: createDefaultRegistry(),
      ctx,
      thinking: false,
      observer: { onToolCall: (e) => calls.push(e.name) },
    });

    expect(browser.calls).toEqual(['navigate:http://x/']);
    expect(calls).toEqual(['browser_navigate']);
    expect(result.finalText).toBe('Done exploring.');
    expect(result.stopReason).toBe('end_turn');
    expect(result.steps).toBe(2);
    // 2nd request carried user(prompt) + assistant(tool_use) + user(tool_result)
    expect(client.messageCounts).toEqual([1, 3]);
    expect(result.usage.inputTokens).toBe(20);
  });

  it('stops at maxSteps when the model keeps calling tools', async () => {
    const tool = () =>
      makeMessage([{ type: 'tool_use', id: 'tu', name: 'dom_testids', input: {} }], 'tool_use');
    const client = new FakeAnthropicClient([tool(), tool(), tool()]);
    const result = await runAgentLoop({
      client,
      system: 'sys',
      prompt: 'go',
      registry: createDefaultRegistry(),
      ctx: makeFakeCtx(),
      thinking: false,
      maxSteps: 2,
    });
    expect(result.stopReason).toBe('max_steps');
    expect(result.steps).toBe(2);
  });

  it('ends cleanly on refusal', async () => {
    const client = new FakeAnthropicClient([makeMessage([], 'refusal')]);
    const result = await runAgentLoop({
      client,
      system: 'sys',
      prompt: 'go',
      registry: createDefaultRegistry(),
      ctx: makeFakeCtx(),
      thinking: false,
    });
    expect(result.stopReason).toBe('refusal');
  });

  it('includes thinking/output_config only when set', async () => {
    const client = new FakeAnthropicClient([makeMessage([{ type: 'text', text: 'hi' }], 'end_turn')]);
    await runAgentLoop({
      client,
      system: 'sys',
      prompt: 'go',
      registry: createDefaultRegistry(),
      ctx: makeFakeCtx(),
      thinking: true,
      effort: 'high',
    });
    const body = client.bodies[0] as unknown as Record<string, unknown>;
    expect(body.thinking).toEqual({ type: 'adaptive' });
    expect(body.output_config).toEqual({ effort: 'high' });
  });
});
