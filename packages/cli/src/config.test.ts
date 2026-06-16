import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CONFIG_FILE,
  DEFAULT_CONFIG,
  detectPlaywrightConfig,
  loadArgusConfig,
  writeArgusConfig,
  hasAnthropicKey,
} from './config';

describe('argus config', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'argus-cfg-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loadArgusConfig returns defaults with found=false when absent', () => {
    const { config, found } = loadArgusConfig(dir);
    expect(found).toBe(false);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('loadArgusConfig merges a present file over defaults, found=true', () => {
    writeFileSync(join(dir, CONFIG_FILE), JSON.stringify({ baseUrl: 'https://x.test', model: 'claude-opus-4-8' }));
    const { config, found } = loadArgusConfig(dir);
    expect(found).toBe(true);
    expect(config.baseUrl).toBe('https://x.test');
    expect(config.model).toBe('claude-opus-4-8');
    // unspecified keys fall back to defaults
    expect(config.testDir).toBe(DEFAULT_CONFIG.testDir);
  });

  it('loadArgusConfig tolerates invalid JSON (found=false, defaults)', () => {
    writeFileSync(join(dir, CONFIG_FILE), '{ not json');
    const { config, found } = loadArgusConfig(dir);
    expect(found).toBe(false);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('writeArgusConfig scaffolds, then refuses to clobber without force', () => {
    const first = writeArgusConfig(dir);
    expect(first.written).toBe(true);
    expect(existsSync(first.path)).toBe(true);

    writeFileSync(first.path, '{"baseUrl":"https://keep.test"}');
    const second = writeArgusConfig(dir);
    expect(second.written).toBe(false);
    expect(JSON.parse(readFileSync(first.path, 'utf8')).baseUrl).toBe('https://keep.test');

    const forced = writeArgusConfig(dir, { force: true });
    expect(forced.written).toBe(true);
    expect(JSON.parse(readFileSync(first.path, 'utf8')).baseUrl).toBe(DEFAULT_CONFIG.baseUrl);
  });

  it('detectPlaywrightConfig finds a config file, else null', () => {
    expect(detectPlaywrightConfig(dir)).toBeNull();
    writeFileSync(join(dir, 'playwright.config.ts'), '');
    expect(detectPlaywrightConfig(dir)).toBe('playwright.config.ts');
  });

  it('hasAnthropicKey reads .env', () => {
    expect(hasAnthropicKey(dir)).toBe(false);
    writeFileSync(join(dir, '.env'), 'FOO=1\nANTHROPIC_API_KEY=sk-abc\n');
    expect(hasAnthropicKey(dir)).toBe(true);
  });
});
