'use client';

interface ForwardingCourierProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  register: string;
  id: string;
}

export function ForwardingCourier({
  fromX,
  fromY,
  toX,
  toY,
  register,
  id,
}: ForwardingCourierProps) {
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 24 }}>
      <defs>
        <linearGradient id={`fwd-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="oklch(0.78 0.14 85)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="oklch(0.72 0.18 155)" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      <line
        x1={`${fromX}%`}
        y1={`${fromY}%`}
        x2={`${toX}%`}
        y2={`${toY}%`}
        stroke={`url(#fwd-grad-${id})`}
        strokeWidth="3.2"
        strokeDasharray="7 4"
      />

      <g>
        <rect
          x={`${fromX - 2.8}%`}
          y={`${fromY - 6.7}%`}
          width="5.6%"
          height="3.2%"
          rx="2"
          fill="oklch(0.14 0.02 245 / 90%)"
          stroke="oklch(0.78 0.14 85 / 70%)"
          strokeWidth="0.9"
        />
        <text
          x={`${fromX}%`}
          y={`${fromY - 5.1}%`}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="oklch(0.86 0.12 85)"
          fontSize="9.2"
          fontFamily="var(--font-geist-mono), monospace"
          fontWeight="700"
        >
          EX
        </text>
      </g>

      <g>
        <rect
          x={`${toX - 2.8}%`}
          y={`${toY - 6.7}%`}
          width="5.6%"
          height="3.2%"
          rx="2"
          fill="oklch(0.14 0.02 245 / 90%)"
          stroke="oklch(0.72 0.18 155 / 70%)"
          strokeWidth="0.9"
        />
        <text
          x={`${toX}%`}
          y={`${toY - 5.1}%`}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="oklch(0.82 0.14 155)"
          fontSize="9.2"
          fontFamily="var(--font-geist-mono), monospace"
          fontWeight="700"
        >
          ID
        </text>
      </g>

      <g>
        <rect
          x={`${midX - 4.6}%`}
          y={`${midY - 8.4}%`}
          width="9.2%"
          height="3.6%"
          rx="2"
          fill="oklch(0.12 0.02 245 / 92%)"
          stroke="oklch(0.7 0.2 155 / 60%)"
          strokeWidth="0.9"
        />
        <text
          x={`${midX}%`}
          y={`${midY - 6.6}%`}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="oklch(0.86 0.15 155)"
          fontSize="9.4"
          fontFamily="var(--font-geist-mono), monospace"
          fontWeight="700"
        >
          EX -&gt; ID
        </text>
      </g>

      <g style={{ animation: 'courier-zip 0.5s ease-out', transformOrigin: `${midX}% ${midY}%` }}>
        <circle cx={`${midX - 2.1}%`} cy={`${midY + 2.1}%`} r="2.8" fill="oklch(0.14 0.02 245)" />
        <circle cx={`${midX + 2.5}%`} cy={`${midY + 2.1}%`} r="2.8" fill="oklch(0.14 0.02 245)" />
        <rect
          x={`${midX - 4.8}%`}
          y={`${midY - 2.8}%`}
          width="10.4%"
          height="5.2%"
          rx="3"
          fill="oklch(0.16 0.02 245 / 95%)"
          stroke="oklch(0.92 0.01 80 / 70%)"
          strokeWidth="1"
        />
        <circle cx={`${midX - 1.5}%`} cy={`${midY - 0.5}%`} r="1.4" fill="oklch(0.95 0.01 80)" />
        <rect
          x={`${midX + 1.5}%`}
          y={`${midY - 2.4}%`}
          width="3%"
          height="3.2%"
          rx="1.5"
          fill="oklch(0.78 0.14 85 / 95%)"
          stroke="oklch(0.9 0.07 75)"
          strokeWidth="0.8"
        />
      </g>

      <circle cx={`${fromX}%`} cy={`${fromY}%`} r="3.4" fill="oklch(0.78 0.14 85)" />
      <circle cx={`${toX}%`} cy={`${toY}%`} r="3.6" fill="oklch(0.72 0.18 155)" />

      <g>
        <rect
          x={`${toX - 3.2}%`}
          y={`${toY - 4.4}%`}
          width="6.4%"
          height="8.8%"
          rx="3"
          fill="oklch(0.15 0.02 155)"
          stroke="oklch(0.72 0.18 155)"
          strokeWidth="1.2"
        />
        <text
          x={`${toX}%`}
          y={`${toY + 0.6}%`}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="oklch(0.86 0.16 155)"
          fontSize="10.5"
          fontFamily="var(--font-geist-mono), monospace"
          fontWeight="700"
        >
          {register}
        </text>
      </g>
    </svg>
  );
}
