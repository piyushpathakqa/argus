/**
 * Cloud-reporter contract (TRE-61).
 *
 * The optional governance-cloud seam: an OSS agent run may POST a small
 * metadata receipt of each heal/refusal to the commercial governance cloud
 * when configured. This is the open-core boundary — exactly like the Treeship
 * observer and MemoryProvider:
 *   - OPTIONAL: a NoopCloudReporter is used when no key is configured.
 *   - NO-OP without a key: zero behavior change for the OSS core.
 *   - ERROR-SWALLOWING: report() MUST never throw — a missing/broken cloud
 *     must never break a heal/triage run.
 *
 * The OSS core MUST NOT depend on the cloud existing. The agent/ directory
 * MUST NOT import this module — only the CLI (and optionally behaviors) may.
 */

/** Metadata sent to the governance cloud ingest endpoint. Provenance, not payload. */
export interface CloudReceipt {
  specPath: string;
  url: string; // app under test
  verdict: string; // 'real-bug' | 'dom-drift' | 'flake'
  healed: boolean; // true if a heal was applied AND verified green
  rationale?: string;
  suggestedSelector?: string;
  framework?: string; // playwright | cypress | selenium
  repo?: string; // git remote slug, best-effort
  receiptId?: string; // Treeship session id
  receiptUrl?: string; // hosted Treeship receipt URL
  timestamp: string; // ISO-8601
}

/** Swappable cloud reporter. Implementations MUST never throw from report(). */
export interface CloudReporter {
  /** Best-effort report of a heal/refusal. MUST never throw. */
  report(receipt: CloudReceipt): Promise<void>;
}

/**
 * Default no-op reporter — used when no governance cloud is configured.
 * Guarantees zero behavior change for the OSS core.
 */
export class NoopCloudReporter implements CloudReporter {
  async report(): Promise<void> {}
}
