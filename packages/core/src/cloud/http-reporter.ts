import type { CloudReceipt, CloudReporter } from './types';
import { NoopCloudReporter } from './types';

/** A hung cloud must never freeze a heal run — bound every POST. */
const CLOUD_TIMEOUT_MS = 8000;

/** Default governance-cloud base URL; overridable via opts or VIGILIS_CLOUD_URL. */
const DEFAULT_CLOUD_URL = 'https://cloud.vigilis.dev';

/**
 * CloudReporter that POSTs each receipt's metadata to the governance cloud.
 *
 * All errors (network, non-2xx, timeout) are swallowed — report() never throws.
 * `fetchFn` is injected (default globalThis.fetch) so tests never hit the
 * network. No new runtime dependency: uses the global fetch.
 */
export class HttpCloudReporter implements CloudReporter {
  private readonly url: string;
  private readonly key: string;
  private readonly fetchFn: typeof fetch;

  constructor(opts: { url: string; key: string; fetchFn?: typeof fetch }) {
    this.url = opts.url;
    this.key = opts.key;
    this.fetchFn = opts.fetchFn ?? globalThis.fetch;
  }

  async report(receipt: CloudReceipt): Promise<void> {
    const endpoint = `${this.url.replace(/\/$/, '')}/api/ingest`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLOUD_TIMEOUT_MS);
    try {
      await this.fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.key}`,
        },
        body: JSON.stringify(receipt),
        signal: controller.signal,
      });
      // Non-2xx responses are intentionally ignored — best-effort, never throw.
    } catch {
      // swallow ALL errors — a broken cloud must never block a heal run
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Build the appropriate CloudReporter:
 *   - key from opts.key ?? VIGILIS_CLOUD_KEY
 *   - url from opts.url ?? VIGILIS_CLOUD_URL ?? https://cloud.vigilis.dev
 *
 * No key → NoopCloudReporter (no-op, zero behavior change for the OSS core).
 * Key present → HttpCloudReporter.
 */
export function resolveCloudReporter(
  opts: { url?: string; key?: string; fetchFn?: typeof fetch } = {},
): CloudReporter {
  const key = opts.key ?? process.env.VIGILIS_CLOUD_KEY;
  if (!key) return new NoopCloudReporter();
  const url = opts.url ?? process.env.VIGILIS_CLOUD_URL ?? DEFAULT_CLOUD_URL;
  return new HttpCloudReporter({ url, key, fetchFn: opts.fetchFn });
}
