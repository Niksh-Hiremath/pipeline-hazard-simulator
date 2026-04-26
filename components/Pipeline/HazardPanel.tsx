'use client';

import type { Hazard } from '@/lib/types';

interface HazardPanelProps {
  hazards: Hazard[];
  instructionRaws: Map<number, string>;
}

export function HazardPanel({ hazards, instructionRaws }: HazardPanelProps) {
  if (hazards.length === 0) {
    return (
      <div
        className="rounded-lg px-3 py-2.5"
        style={{
          background: 'oklch(0.13 0.015 260 / 60%)',
          border: '1px solid oklch(0.3 0.02 260 / 30%)',
        }}
      >
        <p className="text-[11px]" style={{ color: 'oklch(0.5 0.02 260)' }}>
          No hazards detected. Lab corridor is clear.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {hazards.map((hazard, idx) => {
        const producerLabel = `I${hazard.producerIndex + 1}`;
        const consumerLabel = `I${hazard.consumerIndex + 1}`;
        const producerRaw = instructionRaws.get(hazard.producerIndex) || '';
        const consumerRaw = instructionRaws.get(hazard.consumerIndex) || '';
        const resolved = hazard.resolvedByForwarding;

        return (
          <div
            key={idx}
            className="rounded-lg px-3 py-2 space-y-1"
            style={{
              background: resolved ? 'oklch(0.7 0.2 155 / 6%)' : 'oklch(0.6 0.25 25 / 6%)',
              border: `1px solid ${resolved ? 'oklch(0.7 0.2 155 / 25%)' : 'oklch(0.6 0.25 25 / 25%)'}`,
              animation: 'slide-in-right 0.3s ease backwards',
              animationDelay: `${idx * 80}ms`,
            }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  background: resolved ? 'oklch(0.7 0.2 155 / 15%)' : 'oklch(0.6 0.25 25 / 15%)',
                  color: resolved ? 'oklch(0.8 0.15 155)' : 'oklch(0.8 0.15 25)',
                  border: `1px solid ${resolved ? 'oklch(0.7 0.2 155 / 30%)' : 'oklch(0.6 0.25 25 / 30%)'}`,
                }}
              >
                {resolved ? 'Forwarding Unit' : 'RAW Hazard'}
              </span>

              <span className="text-[11px]" style={{ color: 'oklch(0.6 0.02 260)' }}>
                {producerLabel} -&gt; {consumerLabel} via{' '}
                <span className="font-mono font-bold" style={{ color: 'oklch(0.8 0.15 195)' }}>
                  {hazard.register}
                </span>
              </span>
            </div>

            <div className="text-[9px] font-mono pl-1" style={{ color: 'oklch(0.45 0.02 260)' }}>
              {producerLabel}: {producerRaw} -&gt; {consumerLabel}: {consumerRaw}
            </div>

            <div className="text-[10px] pl-1">
              {resolved ? (
                <span style={{ color: 'oklch(0.7 0.15 155)' }}>
                  Resolved by forwarding, no stall
                </span>
              ) : (
                <span style={{ color: 'oklch(0.7 0.15 25)' }}>
                  {hazard.stallsInserted} stall{hazard.stallsInserted !== 1 ? 's' : ''} inserted
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
