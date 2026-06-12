/**
 * @argus/mcp — MCP server wrapping the Argus Tool Registry.
 *
 * M0 scaffold only. The real stdio server (TRE-42) lands in M4.
 */
import { resolveModel } from '@argus/core';

export function describeServer(): string {
  return `argus-mcp (primary model: ${resolveModel('primary')})`;
}
