import type Anthropic from '@anthropic-ai/sdk';
import type { ToolResult } from '../tools/types';

export type AgentStopReason =
  | 'end_turn'
  | 'refusal'
  | 'max_tokens'
  | 'max_steps'
  | 'stop_sequence';

/** Optional observability hook — the seam reused by TRE-37 (artifacts) and TRE-46 (Treeship). */
export interface AgentObserver {
  onLoopStart?(e: { system: string; model: string }): void;
  onModelRequest?(e: { step: number; messageCount: number }): void;
  onModelResponse?(e: { step: number; stopReason: string | null; usage: Anthropic.Usage }): void;
  onToolCall?(e: { step: number; name: string; input: unknown }): void;
  onToolResult?(e: { step: number; name: string; result: ToolResult }): void;
  onLoopEnd?(e: { steps: number; stopReason: AgentStopReason }): void;
}

/** Logs a compact line per loop event. Used by `argus smoke`. */
export class ConsoleObserver implements AgentObserver {
  onLoopStart(e: { system: string; model: string }): void {
    console.log(`[argus] loop start · model=${e.model}`);
  }
  onToolCall(e: { step: number; name: string; input: unknown }): void {
    console.log(`[argus]  → ${e.name} ${JSON.stringify(e.input)}`);
  }
  onToolResult(e: { step: number; name: string; result: ToolResult }): void {
    const flag = e.result.isError ? '✗' : '✓';
    const preview = e.result.content.slice(0, 80).replace(/\s+/g, ' ');
    console.log(`[argus]  ${flag} ${e.name}: ${preview}`);
  }
  onLoopEnd(e: { steps: number; stopReason: AgentStopReason }): void {
    console.log(`[argus] loop end · ${e.steps} steps · ${e.stopReason}`);
  }
}
