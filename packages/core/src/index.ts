/**
 * @argus/core — the agent core and shared Tool Registry.
 *
 * M0 scaffold: this currently exposes only configuration defaults. The agent
 * loop (TRE-32), Tool Registry (TRE-31), and behaviors (TRE-33+) land in M1.
 */

/** Default Claude models, overridable via environment variables. */
export const MODELS = {
  /** Deep-reasoning model used for generate + triage. */
  primary: process.env.ARGUS_MODEL_PRIMARY ?? 'claude-opus-4-8',
  /** Cheaper model used for lightweight steps. */
  fast: process.env.ARGUS_MODEL_FAST ?? 'claude-haiku-4-5',
} as const;

export type ModelTier = keyof typeof MODELS;

/** Resolve a model id for the given tier. */
export function resolveModel(tier: ModelTier = 'primary'): string {
  return MODELS[tier];
}
