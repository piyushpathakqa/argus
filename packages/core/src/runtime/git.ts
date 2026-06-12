import { spawn } from 'node:child_process';

export interface GitExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
}
export type GitExec = (
  cmd: string,
  args: string[],
  opts: { cwd: string },
) => Promise<GitExecResult>;

const defaultExec: GitExec = (cmd, args, opts) =>
  new Promise<GitExecResult>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += String(d)));
    child.stderr.on('data', (d) => (stderr += String(d)));
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code }));
  });

export interface CreateHealPrOptions {
  cwd: string;
  branch: string;
  files: string[];
  title: string;
  body: string;
  base?: string;
  exec?: GitExec;
}

/**
 * Deterministically open a heal PR: branch → add → commit → push → `gh pr create`.
 * The outward action lives in the harness (not an agent tool). `exec` is injected
 * for testability. Returns the new branch + the PR URL printed by `gh`.
 */
export async function createHealPr(
  opts: CreateHealPrOptions,
): Promise<{ branch: string; url: string }> {
  const exec = opts.exec ?? defaultExec;
  const run = async (cmd: string, args: string[]): Promise<GitExecResult> => {
    const r = await exec(cmd, args, { cwd: opts.cwd });
    if (r.code !== 0) {
      throw new Error(`${cmd} ${args.join(' ')} failed (${r.code}): ${r.stderr.trim()}`);
    }
    return r;
  };

  await run('git', ['checkout', '-b', opts.branch]);
  await run('git', ['add', ...opts.files]);
  await run('git', ['commit', '-m', opts.title]);
  await run('git', ['push', '-u', 'origin', opts.branch]);
  const pr = await run('gh', [
    'pr',
    'create',
    '--base',
    opts.base ?? 'main',
    '--head',
    opts.branch,
    '--title',
    opts.title,
    '--body',
    opts.body,
  ]);
  return { branch: opts.branch, url: pr.stdout.trim() };
}
