#!/usr/bin/env node
/**
 * @argus/cli — the `argus` command.
 *
 * M0 scaffold: wires up the command surface with placeholder actions. Real
 * behaviors land in M1–M3 (generate: TRE-33, triage: TRE-38, heal: TRE-39).
 */
import { Command } from 'commander';
import { resolveModel } from '@argus/core';

const program = new Command();

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

program.parse();
