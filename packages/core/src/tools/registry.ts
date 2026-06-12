import { z } from 'zod';
import type {
  AnthropicToolParam,
  McpToolParam,
  ToolContext,
  ToolDefinition,
  ToolResult,
} from './types';

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(def: ToolDefinition): void {
    if (this.tools.has(def.name)) {
      throw new Error(`Tool "${def.name}" is already registered`);
    }
    this.tools.set(def.name, def);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolResult> {
    const def = this.tools.get(name);
    if (!def) {
      return { content: `Unknown tool: ${name}`, isError: true };
    }
    const parsed = def.input.safeParse(rawInput ?? {});
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      return { content: `Invalid input for ${name}: ${detail}`, isError: true };
    }
    try {
      return await def.handler(parsed.data, ctx);
    } catch (err) {
      return { content: err instanceof Error ? err.message : String(err), isError: true };
    }
  }

  toAnthropic(): AnthropicToolParam[] {
    return this.list().map((def) => {
      const schema = z.toJSONSchema(def.input) as Record<string, unknown>;
      delete schema.$schema;
      return {
        name: def.name,
        description: def.description,
        input_schema: schema as AnthropicToolParam['input_schema'],
      };
    });
  }

  toMcp(): McpToolParam[] {
    return this.list().map((def) => ({
      name: def.name,
      description: def.description,
      inputSchema: def.input.shape,
    }));
  }
}
