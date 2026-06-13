'use client';

import { motion } from 'motion/react';

export function Provenance() {
  return (
    <section className="relative px-6 py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(80% 60% at 50% 50%, rgba(167,139,250,.12), transparent 70%)' }}
      />
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold">Self-healing QA you can audit.</h2>
          <p className="mt-4 text-[var(--color-muted)]">
            Every heal runs inside a signed Treeship session — each step, artifact and verdict is captured in a
            tamper-evident chain. When Argus opens a PR, you get a receipt, not a black box.
          </p>
        </div>
        <motion.pre
          className="glass overflow-x-auto rounded-xl p-6 font-mono text-sm leading-relaxed"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
        >
          <code>
            <span className="text-[var(--color-cyan)]">$ argus heal --spec checkout.spec.ts</span>
            {'\n'}triage   → dom-drift (locator stale)
            {'\n'}heal     → rewrote getByRole(&apos;button&apos;)
            {'\n'}verify   → 12 passed (green)
            {'\n'}pr       → #42 opened
            {'\n'}
            {'\n'}<span className="text-[var(--color-violet)]">✓ verified · 21 artifacts · chain intact</span>
          </code>
        </motion.pre>
      </div>
    </section>
  );
}
