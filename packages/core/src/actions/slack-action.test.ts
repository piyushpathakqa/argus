import { describe, it, expect } from 'vitest';
import { SlackRefusalAction, slackText } from './slack-action';
import type { RefusalPayload } from './types';

const p: RefusalPayload = {
  specPath: 'tests/checkout-total.spec.ts',
  url: 'https://acme.example/checkout',
  rationale: 'behaviour changed, not selector drift',
  expected: '$49.00',
  actual: '$0.00',
  repo: 'acme/web',
  receiptUrl: 'https://treeship.dev/receipt/ssn_8f31c0',
  timestamp: '2026-06-30T00:00:00.000Z',
};

describe('slackText', () => {
  it('uses honest "suspected" wording and links the receipt', () => {
    const t = slackText(p);
    expect(t).toContain('refused to heal');
    expect(t).toContain('suspected real regression');
    expect(t).toContain('tests/checkout-total.spec.ts');
    expect(t).toContain('$49.00');
    expect(t).toContain('https://treeship.dev/receipt/ssn_8f31c0');
    expect(t).not.toContain('confirmed bug');
  });

  it('includes the ticket link when the dispatcher supplied one', () => {
    expect(slackText({ ...p, ticketUrl: 'https://linear.app/x/issue/TRE-99' })).toContain('TRE-99');
  });

  it('omits the assertion line when expected/actual are absent', () => {
    const t = slackText({ ...p, expected: undefined, actual: undefined });
    expect(t).not.toContain('expected');
  });
});

describe('SlackRefusalAction.notify', () => {
  it('POSTs JSON {text} to the webhook and returns ok', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const r = await new SlackRefusalAction({ webhookUrl: 'https://hooks.slack.test/xyz', fetchFn: fakeFetch }).notify(p);
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://hooks.slack.test/xyz');
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init.body as string).text).toContain('refused to heal');
  });

  it('returns { ok:false } on a rejecting fetch (never throws)', async () => {
    const fakeFetch = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    const r = new SlackRefusalAction({ webhookUrl: 'https://x', fetchFn: fakeFetch });
    await expect(r.notify(p)).resolves.toEqual({ ok: false });
  });

  it('returns { ok:false } on a non-2xx response', async () => {
    const fakeFetch = (async () => new Response('no', { status: 500 })) as unknown as typeof fetch;
    const r = new SlackRefusalAction({ webhookUrl: 'https://x', fetchFn: fakeFetch });
    await expect(r.notify(p)).resolves.toEqual({ ok: false });
  });
});
