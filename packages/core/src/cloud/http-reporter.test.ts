import { describe, it, expect, afterEach } from 'vitest';
import { HttpCloudReporter, resolveCloudReporter } from './http-reporter';
import { NoopCloudReporter } from './types';
import type { CloudReceipt } from './types';

const receipt: CloudReceipt = {
  specPath: 'tests/login.spec.ts',
  url: 'http://localhost:3100/login',
  verdict: 'dom-drift',
  healed: true,
  rationale: 'testid changed',
  suggestedSelector: '[data-testid="submit-btn"]',
  framework: 'playwright',
  timestamp: '2026-06-24T00:00:00.000Z',
};

afterEach(() => {
  delete process.env.VIGILIS_CLOUD_KEY;
  delete process.env.VIGILIS_CLOUD_URL;
});

describe('resolveCloudReporter', () => {
  it('returns a NoopCloudReporter when no key is configured', () => {
    const r = resolveCloudReporter({});
    expect(r).toBeInstanceOf(NoopCloudReporter);
  });

  it('ignores VIGILIS_CLOUD_URL when there is no key → still Noop', () => {
    process.env.VIGILIS_CLOUD_URL = 'https://example.test';
    const r = resolveCloudReporter({});
    expect(r).toBeInstanceOf(NoopCloudReporter);
  });

  it('returns an HttpCloudReporter when a key is given via opts', () => {
    const r = resolveCloudReporter({ key: 'k_test', fetchFn: async () => new Response(null) });
    expect(r).toBeInstanceOf(HttpCloudReporter);
  });

  it('returns an HttpCloudReporter when the key comes from VIGILIS_CLOUD_KEY', () => {
    process.env.VIGILIS_CLOUD_KEY = 'k_env';
    const r = resolveCloudReporter({ fetchFn: async () => new Response(null) });
    expect(r).toBeInstanceOf(HttpCloudReporter);
  });
});

describe('HttpCloudReporter.report', () => {
  it('POSTs to <url>/api/ingest with the Bearer header + JSON body', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const r = new HttpCloudReporter({ url: 'https://cloud.vigilis.dev', key: 'k_test', fetchFn: fakeFetch });
    await r.report(receipt);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://cloud.vigilis.dev/api/ingest');
    expect(calls[0]!.init.method).toBe('POST');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers.authorization).toBe('Bearer k_test');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual(receipt);
  });

  it('strips a trailing slash from the base url', async () => {
    let seen = '';
    const fakeFetch = (async (url: string | URL) => {
      seen = String(url);
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const r = new HttpCloudReporter({ url: 'https://cloud.vigilis.dev/', key: 'k', fetchFn: fakeFetch });
    await r.report(receipt);
    expect(seen).toBe('https://cloud.vigilis.dev/api/ingest');
  });

  it('swallows a rejecting fetch — report() still resolves', async () => {
    const fakeFetch = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const r = new HttpCloudReporter({ url: 'https://cloud.vigilis.dev', key: 'k', fetchFn: fakeFetch });
    await expect(r.report(receipt)).resolves.toBeUndefined();
  });

  it('swallows a non-2xx response — report() still resolves', async () => {
    const fakeFetch = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    const r = new HttpCloudReporter({ url: 'https://cloud.vigilis.dev', key: 'k', fetchFn: fakeFetch });
    await expect(r.report(receipt)).resolves.toBeUndefined();
  });
});
