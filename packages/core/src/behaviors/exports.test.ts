import { describe, it, expect } from 'vitest';
import * as core from '../index';

describe('@argus/core behavior exports', () => {
  it('exposes generate + specPathForUrl + triage + heal', () => {
    expect('generate' in core).toBe(true);
    expect('specPathForUrl' in core).toBe(true);
    expect('triage' in core).toBe(true);
    expect('extractFailures' in core).toBe(true);
    expect('heal' in core).toBe(true);
    expect('createHealPr' in core).toBe(true);
  });
});
