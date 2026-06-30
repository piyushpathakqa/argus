import type { RefusalAction, RefusalActionResult, RefusalPayload } from './types';

const SLACK_TIMEOUT_MS = 8000;

/** Builds the Slack message text. Honest "suspected" framing; links the receipt. */
export function slackText(p: RefusalPayload): string {
  const lines = [
    ':no_entry: *Vigilis refused to heal* — suspected real regression (behaviour change). Deploy blocked.',
    `*${p.specPath}*${p.repo ? ` · ${p.repo}` : ''}`,
  ];
  if (p.expected || p.actual) lines.push(`expected \`${p.expected ?? '?'}\`, got \`${p.actual ?? '?'}\``);
  lines.push(`_${p.rationale}_`);
  if (p.receiptUrl) lines.push(`Verify the signed receipt: ${p.receiptUrl}`);
  if (p.ticketUrl) lines.push(`Ticket: ${p.ticketUrl}`);
  return lines.join('\n');
}

/**
 * Posts a refusal alert to a Slack Incoming Webhook. Never throws — all errors
 * and non-2xx responses resolve to { ok: false }. `fetchFn` is injected so tests
 * never hit the network. No new runtime dependency: uses the global fetch.
 */
export class SlackRefusalAction implements RefusalAction {
  readonly name = 'slack';
  private readonly webhookUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(opts: { webhookUrl: string; fetchFn?: typeof fetch }) {
    this.webhookUrl = opts.webhookUrl;
    this.fetchFn = opts.fetchFn ?? globalThis.fetch;
  }

  async notify(p: RefusalPayload): Promise<RefusalActionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS);
    try {
      const res = await this.fetchFn(this.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: slackText(p) }),
        signal: controller.signal,
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    } finally {
      clearTimeout(timer);
    }
  }
}
