'use client';

import { motion } from 'motion/react';

export function EyeOrb({ size = 120 }: { size?: number }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: [1, 1.06, 1], opacity: 1 }}
      transition={{
        scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
        opacity: { duration: 0.8 },
      }}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 50%, #22d3ee 0%, #6366f1 45%, #0b1020 78%)',
        boxShadow: '0 0 60px 8px rgba(56,189,248,.45)',
      }}
    />
  );
}
