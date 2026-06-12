#!/usr/bin/env node
/**
 * @argus/cli — the `argus` command.
 *
 * M0 scaffold: wires up the command surface with placeholder actions. Real
 * behaviors land in M1–M3 (generate: TRE-33, triage: TRE-38, heal: TRE-39).
 */
import { Command } from 'commander';
import {
  ConsoleObserver,
  createAnthropicClient,
  createDefaultRegistry,
  createPlaywrightSession,
  PlaywrightTestRunner,
  resolveModel,
  runAgentLoop,
} from '@argus/core';

const program = new Command();

const PRICES: Record<string, { in: number; out: number }> = {
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

const SMOKE_SYSTEM =
  'You are exploring a web app to understand it. Use the browser and dom tools to ' +
  'navigate, snapshot the page, list its data-testid values, and try the primary flow ' +
  '(e.g. log in, then add an item to the cart). Report concisely what you found. ' +
  'Do not write any files.';

program
  .name('argus')
  .description('Agentic QA: author, generate, triage, and self-heal Playwright tests.')
  .version('0.0.0');

program
  .command('generate')
  .argument('<url>', 'URL of the app under test')
  .description('Explore the app and write Playwright specs')
  .action((url: string) => {
    console.log(`[argus] generate ${url} — not implemented yet (M1, TRE-33).`);
    console.log(`[argus] would use model: ${resolveModel('primary')}`);
  });

program
  .command('author')
  .argument('<intent>', 'Plain-English description of what to test')
  .description('Compile an intent into a structured test plan')
  .action((intent: string) => {
    console.log(`[argus] author "${intent}" — not implemented yet (M1, TRE-?).`);
  });

program
  .command('triage')
  .argument('<runDir>', 'Path to a failed run directory')
  .description('Classify a failure: real bug, DOM drift, or flake')
  .action((runDir: string) => {
    console.log(`[argus] triage ${runDir} — not implemented yet (M3, TRE-38).`);
  });

program
  .command('heal')
  .argument('<runDir>', 'Path to a triaged drift failure')
  .description('Rewrite the locator, verify green, and open a PR')
  .action((runDir: string) => {
    console.log(`[argus] heal ${runDir} — not implemented yet (M3, TRE-39).`);
  });

program
  .command('smoke')
  .argument('<url>', 'URL of the app under test (e.g. http://localhost:3100/login)')
  .option('--model <id>', 'model id (default: fast model)')
  .option('--headed', 'run with a visible browser')
  .option('--max-steps <n>', 'max agent steps', '8')
  .description(
    'Run the agent loop against a URL and print a step trace + cost (needs ANTHROPIC_API_KEY + chromium)',
  )
  .action(async (url: string, opts: { model?: string; headed?: boolean; maxSteps: string }) => {
    const model = opts.model ?? resolveModel('fast');
    const isOpusTier = /opus|sonnet-4-6|fable/.test(model);
    const { session, close } = await createPlaywrightSession({ headless: !opts.headed });
    try {
      const result = await runAgentLoop({
        client: createAnthropicClient(),
        system: SMOKE_SYSTEM,
        prompt: `Explore ${url} and report its pages, data-testids, and how the add-to-cart flow works.`,
        registry: createDefaultRegistry(),
        ctx: {
          workspaceRoot: process.cwd(),
          browser: session,
          runner: new PlaywrightTestRunner({ cwd: process.cwd() }),
        },
        model,
        thinking: isOpusTier, // adaptive thinking + effort only on Opus-tier; Haiku would 400
        maxSteps: Number(opts.maxSteps),
        observer: new ConsoleObserver(),
      });
      console.log('\n--- result ---\n' + result.finalText);
      const price = PRICES[model];
      const cost = price
        ? `$${((result.usage.inputTokens / 1e6) * price.in + (result.usage.outputTokens / 1e6) * price.out).toFixed(4)}`
        : 'n/a';
      console.log(
        `\n[argus] ${result.steps} steps · ${result.usage.inputTokens} in / ${result.usage.outputTokens} out tokens · ~${cost} (${model})`,
      );
    } finally {
      await close();
    }
  });

program.parse();
