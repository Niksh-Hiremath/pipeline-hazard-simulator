'use client';

interface HazardZapperProps {
  leftPercent: number;
  widthPercent: number;
}

export function HazardZapper({ leftPercent, widthPercent }: HazardZapperProps) {
  return (
    <div
      className="absolute top-0 h-full pointer-events-none"
      style={{
        width: `${widthPercent}%`,
        left: `${leftPercent}%`,
        zIndex: 17,
      }}
    >
      <div
        className="absolute inset-y-0 left-0 right-0"
        style={{
          background:
            'linear-gradient(90deg, oklch(0.62 0.24 28 / 8%) 0%, oklch(0.62 0.24 28 / 40%) 45%, oklch(0.62 0.24 28 / 8%) 100%)',
          borderLeft: '2px solid oklch(0.62 0.24 28 / 75%)',
          borderRight: '2px solid oklch(0.62 0.24 28 / 65%)',
          boxShadow: '0 0 22px oklch(0.62 0.24 28 / 70%)',
          animation: 'zapper-pulse 0.6s ease-in-out infinite',
        }}
      />
    </div>
  );
}
