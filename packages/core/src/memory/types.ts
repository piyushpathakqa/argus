/** Triage verdict values — the outcome of classifying a test failure. */
export type Verdict = 'real-bug' | 'dom-drift' | 'flake';

/**
 * A single prior governed memory recalled from the memory backend (zmem inject).
 * `content` is the opaque free-text recalled string from zmem — it is HINT ONLY.
 * It must never directly branch decision logic; inject as prompt context only.
 */
export interface MemoryRecall {
  /** The remembered text recalled from zmem (free-form string). */
  content: string;
  /** Confidence value 0..1 from zmem's trust model. */
  trust?: number;
  /** zmem authority level: none | low | medium | high. */
  authority?: string;
  /** zmem memory id (e.g. mem_2386db3713eb4338). */
  memoryId?: string;
  /** zmem inject action_id — the receipt for this recall. */
  receiptId?: string;
}

/** An entry to propose recording in the memory backend after a verdict is reached. */
export interface MemoryRecordEntry {
  specPath: string;
  url: string;
  verdict: Verdict;
  rationale: string;
  suggestedSelector?: string;
  receiptId?: string;
}

/**
 * Swappable memory backend. Implementations must NEVER throw — all errors are
 * swallowed so a missing or broken backend never breaks a triage/heal run.
 */
export interface MemoryProvider {
  /**
   * Recall prior governed verdicts relevant to the failing spec/selector.
   * Returns empty array on any error or when no priors exist.
   * Result is HINT ONLY — inject as prompt context; never branch on it.
   */
  recall(query: {
    specPath: string;
    url: string;
    errorText?: string;
  }): Promise<MemoryRecall[]>;

  /**
   * Propose recording a new verdict in the memory backend.
   * The backend (ZMem) quarantines new entries per its own policy.
   * Resolves (no-op) on any error.
   */
  record(entry: MemoryRecordEntry): Promise<void>;
}

/**
 * Default no-op provider — recall always returns [], record is a no-op.
 * Used when no memory backend is configured; guarantees zero behavior change.
 */
export class NoopMemoryProvider implements MemoryProvider {
  async recall(_query: { specPath: string; url: string; errorText?: string }): Promise<MemoryRecall[]> {
    return [];
  }

  async record(_entry: MemoryRecordEntry): Promise<void> {
    // intentional no-op
  }
}
