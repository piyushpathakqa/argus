import type Anthropic from '@anthropic-ai/sdk';
import { resolveModel } from '../index';
import type { ToolRegistry } from '../tools/registry';
import type { ToolContext } from '../tools/types';
import type { AnthropicLike } from './client';
import type { AgentObserver, AgentStopReason } from './observer';

export interface AgentRunResult {
  finalText: string;
  stopReason: AgentStopReason;
  steps: number;
  messages: Anthropic.MessageParam[];
  usage: { inputTokens: number; outputTokens: number };
}

export interface RunAgentLoopOptions {
  client: AnthropicLike;
  system: string;
  prompt: string;
  registry: ToolRegistry;
  ctx: ToolContext;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'max';
  thinking?: boolean;
  maxSteps?: number;
  maxTokens?: number;
  observer?: AgentObserver;
}

const TERMINAL: AgentStopReason[] = ['end_turn', 'refusal', 'max_tokens', 'stop_sequence'];

function coerceStop(reason: string | null): AgentStopReason {
  return (TERMINAL as string[]).includes(reason ?? '') ? (reason as AgentStopReason) : 'end_turn';
}

/**
 * Hand-rolled Messages API tool-use loop over the shared Tool Registry. Sends the
 * conversation, executes any requested tools via `registry.execute`, feeds the
 * results back, and repeats until the model stops calling tools (or `maxSteps`).
 */
export async function runAgentLoop(opts: RunAgentLoopOptions): Promise<AgentRunResult> {
  const {
    client,
    system,
    prompt,
    registry,
    ctx,
    model = resolveModel('primary'),
    effort,
    thinking = true,
    maxSteps = 25,
    maxTokens = 16000,
    observer,
  } = opts;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }];
  const usage = { inputTokens: 0, outputTokens: 0 };
  observer?.onLoopStart?.({ system, model });

  let steps = 0;
  while (steps < maxSteps) {
    steps += 1;
    observer?.onModelRequest?.({ step: steps, messageCount: messages.length });

    const body: Anthropic.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: maxTokens,
      system,
      messages,
      tools: registry.toAnthropic() as unknown as Anthropic.Tool[],
      ...(thinking ? { thinking: { type: 'adaptive' } } : {}),
      ...(effort ? { output_config: { effort } } : {}),
    };

    const res = await client.messages.create(body);
    usage.inputTokens += res.usage.input_tokens;
    usage.outputTokens += res.usage.output_tokens;
    observer?.onModelResponse?.({ step: steps, stopReason: res.stop_reason, usage: res.usage });

    messages.push({ role: 'assistant', content: res.content as Anthropic.ContentBlockParam[] });

    if (res.stop_reason !== 'tool_use') {
      const finalText = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      const stopReason = coerceStop(res.stop_reason);
      observer?.onLoopEnd?.({ steps, stopReason });
      return { finalText, stopReason, steps, messages, usage };
    }

    const toolUses = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUses) {
      observer?.onToolCall?.({ step: steps, name: block.name, input: block.input });
      const result = await registry.execute(block.name, block.input, ctx);
      observer?.onToolResult?.({ step: steps, name: block.name, result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result.content,
        is_error: result.isError ?? false,
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  observer?.onLoopEnd?.({ steps, stopReason: 'max_steps' });
  return { finalText: '', stopReason: 'max_steps', steps, messages, usage };
}
