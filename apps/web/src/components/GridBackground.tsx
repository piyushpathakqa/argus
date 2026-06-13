'use client';

export function GridBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.25) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(120% 80% at 50% 0%, #000 30%, transparent 75%)',
        }}
      />
      <div
        className="absolute left-1/2 top-[-20%] h-[60vh] w-[60vh] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,.18), transparent 60%)' }}
      />
    </div>
  );
}
