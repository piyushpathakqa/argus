import { defaultExec } from '../runtime/exec';
import type { Exec, ExecResult } from '../runtime/exec';
import type { MemoryProvider, MemoryRecall, MemoryRecordEntry } from './types';
import { NoopMemoryProvider } from './types';

/** A hung `zmem` must never freeze a triage/heal run — bound every call. */
const ZMEM_TIMEOUT_MS = 8000;

/**
 * MemoryProvider backed by the `zmem` CLI (confirmed interface: zmem 0.x).
 *
 * Recall:  zmem inject "<task>" --agent vigilis --risk high --scope project
 *          Prints a JSON object; authorized memories are in obj.memories[].
 * Record:  zmem propose "<content>" --type episodic --scope project --source agent
 *          Stores a quarantined memory; output is ignored.
 *
 * All errors are swallowed — a missing or broken `zmem` binary must never break
 * a triage/heal run. Shells out via the injected `Exec` (same pattern as test
 * runners / Treeship observer) so tests can inject a fake without spawning real
 * processes.
 */
export class ZMemProvider implements MemoryProvider {
  constructor(
    private readonly cwd: string,
    private readonly exec: Exec = defaultExec,
  ) {}

  async recall(query: { specPath: string; url: string; errorText?: string }): Promise<MemoryRecall[]> {
    try {
      const { stdout } = await this.run(this.recallArgv(query));
      return this.parseRecalls(stdout);
    } catch {
      return [];
    }
  }

  async record(entry: MemoryRecordEntry): Promise<void> {
    try {
      await this.run(this.recordArgv(entry));
      // Non-zero exit codes: exec (defaultExec) does NOT throw on non-zero; it
      // resolves with { code: N }. Swallowing errors here covers exec throws only.
    } catch {
      // swallow — a broken zmem must never block a run
    }
  }

  /** Run `zmem` with the given argv, bounded by a timeout so a hung process can't hang triage. */
  private run(args: string[]): Promise<ExecResult> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('zmem timed out')), ZMEM_TIMEOUT_MS);
    });
    return Promise.race([this.exec('zmem', args, { cwd: this.cwd }), timeout]).finally(() =>
      clearTimeout(timer),
    );
  }

  /**
   * Build argv for `zmem inject` (governed recall).
   * zmem inject "<task>" --agent <id> --risk <level> --scope <scope>
   * task is a POSITIONAL argument (no --task flag).
   */
  private recallArgv(query: { specPath: string; url: string; errorText?: string }): string[] {
    const taskText = `triage failed test ${query.specPath}${query.errorText ? ' — ' + query.errorText : ''}`;
    return ['inject', taskText, '--agent', 'vigilis', '--risk', 'high', '--scope', 'project'];
  }

  /**
   * Build argv for `zmem propose` (governed record / quarantine).
   * zmem propose "<content>" --type episodic --scope <scope> --source agent
   * content is a POSITIONAL argument (no --content flag).
   */
  private recordArgv(entry: MemoryRecordEntry): string[] {
    const content =
      `verdict=${entry.verdict}: ${entry.rationale}` +
      (entry.suggestedSelector ? ` | selector=${entry.suggestedSelector}` : '') +
      ` | spec=${entry.specPath}`;
    return ['propose', content, '--type', 'episodic', '--scope', 'project', '--source', 'agent'];
  }

  /**
   * Parse `zmem inject` stdout into MemoryRecall[].
   * zmem prints a JSON object; authorized (injected) memories are in obj.memories[].
   * Withheld/quarantined memories are in obj.withheld — they are NOT returned.
   * Tolerates non-JSON, missing `memories` key, non-array → returns [].
   */
  private parseRecalls(stdout: string): MemoryRecall[] {
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const obj = parsed as Record<string, unknown>;
    const memories = obj['memories'];
    if (!Array.isArray(memories)) return [];
    const receiptId = typeof obj['action_id'] === 'string' ? obj['action_id'] : undefined;
    return memories
      .filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === 'object' && !Array.isArray(item) &&
          typeof (item as Record<string, unknown>)['content'] === 'string',
      )
      .map((item) => ({
        content: item['content'] as string,
        trust: typeof item['trust'] === 'number' ? item['trust'] : undefined,
        authority: typeof item['authority'] === 'string' ? item['authority'] : undefined,
        memoryId: typeof item['id'] === 'string' ? item['id'] : undefined,
        receiptId,
      }));
  }
}

/**
 * Build the appropriate MemoryProvider for the given mode:
 * - 'off'  → NoopMemoryProvider
 * - 'zmem' → ZMemProvider (always, regardless of PATH)
 * - 'auto' → ZMemProvider if `zmem` resolves on PATH, else NoopMemoryProvider
 *
 * Best-effort detection for 'auto': if unsure, default to Noop so behavior
 * is unchanged when zmem is absent.
 */
export async function resolveMemoryProvider(
  cwd: string,
  opts: { mode?: 'off' | 'auto' | 'zmem'; exec?: Exec } = {},
): Promise<MemoryProvider> {
  const { mode = 'auto', exec = defaultExec } = opts;

  if (mode === 'off') return new NoopMemoryProvider();
  if (mode === 'zmem') return new ZMemProvider(cwd, exec);

  // 'auto': probe zmem by running `zmem --version`
  try {
    const result = await exec('zmem', ['--version'], { cwd });
    if (result.code === 0) return new ZMemProvider(cwd, exec);
  } catch {
    // zmem not on PATH or exec threw — fall through to Noop
  }
  return new NoopMemoryProvider();
}
