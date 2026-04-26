'use client';

import { useState } from 'react';

interface LightStrip {
  top: number;
  left: number;
  width: number;
  delay: number;
}

export function StarfieldBg() {
  const [strips] = useState<LightStrip[]>(() =>
    Array.from({ length: 30 }, () => ({
      top: Math.random() * 100,
      left: Math.random() * 100,
      width: 20 + Math.random() * 80,
      delay: Math.random() * 4,
    }))
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 10% 25%, oklch(0.72 0.16 195 / 10%) 0%, transparent 45%),
            radial-gradient(ellipse at 90% 65%, oklch(0.64 0.2 290 / 8%) 0%, transparent 50%),
            linear-gradient(180deg, oklch(0.11 0.03 245), oklch(0.09 0.02 245))
          `,
        }}
      />

      <div className="absolute inset-0">
        {strips.map((strip, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              top: `${strip.top}%`,
              left: `${strip.left}%`,
              width: `${strip.width}px`,
              height: '1px',
              background: 'oklch(0.96 0.01 80 / 22%)',
              animation: `twinkle 3.6s ease-in-out ${strip.delay}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
