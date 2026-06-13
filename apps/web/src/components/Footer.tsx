export function Footer() {
  return (
    <footer className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="text-2xl font-bold">Get started in seconds</h2>
      <pre className="glass mt-6 overflow-x-auto rounded-xl p-6 font-mono text-sm leading-relaxed">
        <code>
          git clone https://github.com/piyushpathakqa/argus
          {'\n'}cd argus &amp;&amp; pnpm install &amp;&amp; pnpm build
          {'\n'}pnpm argus generate --url http://localhost:3000
        </code>
      </pre>
      <nav className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[var(--color-muted)]">
        <a className="hover:text-[var(--color-ink)]" href="https://github.com/piyushpathakqa/argus">
          GitHub
        </a>
        <a className="hover:text-[var(--color-ink)]" href="https://github.com/piyushpathakqa/argus/blob/main/docs/DEMO.md">
          Demo
        </a>
        <a className="hover:text-[var(--color-ink)]" href="https://github.com/piyushpathakqa/argus/blob/main/docs/MCP.md">
          MCP
        </a>
      </nav>
      <p className="mt-8 text-xs text-[var(--color-muted)]">MIT · Built by Piyush Pathak</p>
    </footer>
  );
}
