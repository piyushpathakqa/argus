import { describe, it, expect, afterEach } from 'vitest';
import { resolveRefusalDispatcher } from './dispatcher';
import type { RefusalPayload } from './types';

const p: RefusalPayload = {
  specPath: 'tests/checkout-total.spec.ts',
  url: 'https://acme.example/checkout',
  rationale: 'behaviour changed',
  repo: 'acme/web',
  timestamp: '2026-06-30T00:00:00.000Z',
};

afterEach(() => {
  delete process.env.SLACK_WEBHOOK_URL;
  delete process.env.LINEAR_API_KEY;
  delete process.env.LINEAR_TEAM_ID;
  delete process.env.LINEAR_PROJECT_ID;
  delete process.env.LINEAR_LABEL_ID;
});

/** Records calls and answers Slack + Linear (search/create) by URL/body. */
function recorder(opts: { linearCreated?: boolean; existingUrl?: string } = {}) {
  const urls: string[] = [];
  const fn = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    urls.push(u);
    if (u.includes('api.linear.app')) {
      const body = String(init?.body ?? '');
      if (body.includes('issueCreate')) {
        return new Response(JSON.stringify({ data: { issueCreate: { success: true, issue: { url: 'https://linear.app/new' } } } }), { status: 200 });
      }
      const nodes = opts.existingUrl ? [{ url: opts.existingUrl, state: { type: 'started' } }] : [];
      return new Response(JSON.stringify({ data: { issueSearch: { nodes } } }), { status: 200 });
    }
    return new Response(null, { status: 200 }); // slack
  }) as unknown as typeof fetch;
  return { fn, urls };
}

describe('resolveRefusalDispatcher', () => {
  it('is a no-op when nothing is configured (zero network calls)', async () => {
    const { fn, urls } = recorder();
    const { results } = await resolveRefusalDispatcher({ fetchFn: fn }).dispatch(p);
    expect(urls).toHaveLength(0);
    expect(results).toHaveLength(0);
  });

  it('fires Slack only, when only SLACK_WEBHOOK_URL is set', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/z';
    const { fn, urls } = recorder();
    const { results } = await resolveRefusalDispatcher({ fetchFn: fn }).dispatch(p);
    expect(urls).toEqual(['https://hooks.slack.test/z']);
    expect(results).toHaveLength(1);
  });

  it('files a Linear ticket AND posts to Slack when Linear creates a new ticket', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/z';
    process.env.LINEAR_API_KEY = 'lin_k';
    process.env.LINEAR_TEAM_ID = 'team_1';
    const { fn, urls } = recorder({ linearCreated: true });
    const { results } = await resolveRefusalDispatcher({ fetchFn: fn }).dispatch(p);
    // search + create + slack
    expect(urls.filter((u) => u.includes('api.linear.app'))).toHaveLength(2);
    expect(urls.some((u) => u.includes('hooks.slack.test'))).toBe(true);
    expect(results).toHaveLength(2);
  });

  it('stays quiet on Slack when Linear finds an existing (dedup) ticket', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/z';
    process.env.LINEAR_API_KEY = 'lin_k';
    process.env.LINEAR_TEAM_ID = 'team_1';
    const { fn, urls } = recorder({ existingUrl: 'https://linear.app/x/issue/TRE-50' });
    const { results } = await resolveRefusalDispatcher({ fetchFn: fn }).dispatch(p);
    expect(urls.some((u) => u.includes('hooks.slack.test'))).toBe(false); // no slack
    expect(urls.filter((u) => u.includes('api.linear.app'))).toHaveLength(1); // search only
    expect(results).toHaveLength(1);
    expect(results[0]!.created).toBe(false);
  });
});
