'use client';

import { Button } from '@/components/ui/button';
import { Play, SkipBack, SkipForward, RotateCcw } from 'lucide-react';

interface SimulationControlsProps {
  onRun: () => void;
  onPrev: () => void;
  onStep: () => void;
  onReset: () => void;
  hasErrors: boolean;
  isComplete: boolean;
  isAutoRunning?: boolean;
  currentCycle?: number;
}

export function SimulationControls({
  onRun,
  onPrev,
  onStep,
  onReset,
  hasErrors,
  isComplete,
  isAutoRunning,
  currentCycle,
}: SimulationControlsProps) {
  return (
    <div className="space-y-2">
      <div
        className="text-[10px] uppercase tracking-widest font-semibold px-1"
        style={{ color: 'oklch(0.56 0.02 260)' }}
      >
        Action Lever
      </div>
      <div className="grid grid-cols-2 gap-2">
      <Button
        id="btn-run"
        onClick={onRun}
        disabled={hasErrors || isComplete || isAutoRunning}
        className="flex-1 relative overflow-hidden font-semibold tracking-wide"
        style={{
          background: hasErrors || isComplete || isAutoRunning
            ? 'oklch(0.2 0.02 260)'
            : 'linear-gradient(135deg, oklch(0.55 0.18 195), oklch(0.5 0.2 260))',
          color: 'oklch(0.95 0.01 260)',
          border: '1px solid oklch(0.5 0.15 195 / 40%)',
          boxShadow: hasErrors || isComplete || isAutoRunning
            ? 'none'
            : '0 0 16px oklch(0.7 0.18 195 / 20%), inset 0 1px 0 oklch(1 0 0 / 10%)',
          animation: !hasErrors && !isComplete && !isAutoRunning ? 'pulse-glow 1.5s ease-in-out infinite' : undefined,
        }}
      >
        <Play className="w-4 h-4 mr-2" />
        {isAutoRunning ? 'Running' : 'Auto Run'}
      </Button>

      <Button
        id="btn-prev"
        onClick={onPrev}
        disabled={hasErrors || (currentCycle ?? 0) <= 1}
        className="flex-1 font-semibold tracking-wide relative overflow-hidden"
        style={{
          background: hasErrors || (currentCycle ?? 0) <= 1
            ? 'oklch(0.2 0.02 260)'
            : 'linear-gradient(180deg, oklch(0.19 0.02 260), oklch(0.15 0.02 260))',
          color: 'oklch(0.86 0.02 260)',
          border: '1px solid oklch(0.32 0.02 260 / 60%)',
          boxShadow: 'inset 0 2px 0 oklch(1 0 0 / 6%)',
        }}
      >
        <SkipBack className="w-4 h-4 mr-2" />
        Previous Cycle
      </Button>

      <Button
        id="btn-step"
        onClick={onStep}
        disabled={hasErrors || isComplete}
        className="flex-1 font-semibold tracking-wide relative overflow-hidden"
        style={{
          background: hasErrors || isComplete
            ? 'oklch(0.2 0.02 260)'
            : 'linear-gradient(180deg, oklch(0.2 0.02 260), oklch(0.16 0.02 260))',
          color: 'oklch(0.86 0.02 260)',
          border: '1px solid oklch(0.32 0.02 260 / 60%)',
          boxShadow: 'inset 0 2px 0 oklch(1 0 0 / 6%)',
        }}
      >
        <span
          className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-1 rounded-full"
          style={{ background: 'oklch(0.75 0.15 85 / 55%)' }}
        />
        <SkipForward className="w-4 h-4 mr-2 ml-1" />
        Next Cycle
      </Button>

      <Button
        id="btn-reset"
        onClick={onReset}
        className="flex-1 font-semibold tracking-wide group"
        style={{
          background: 'oklch(0.18 0.05 25)',
          color: 'oklch(0.8 0.15 25)',
          border: '1px solid oklch(0.4 0.15 25 / 40%)',
        }}
      >
        <RotateCcw className="w-4 h-4 mr-2 transition-transform group-hover:-rotate-180 duration-500" />
        Reset
      </Button>
      </div>
    </div>
  );
}
