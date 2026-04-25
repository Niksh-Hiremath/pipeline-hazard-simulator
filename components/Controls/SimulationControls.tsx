'use client';

import { Button } from '@/components/ui/button';
import { Play, SkipForward, RotateCcw } from 'lucide-react';

interface SimulationControlsProps {
  onRun: () => void;
  onStep: () => void;
  onReset: () => void;
  hasErrors: boolean;
  isComplete: boolean;
}

export function SimulationControls({
  onRun,
  onStep,
  onReset,
  hasErrors,
  isComplete,
}: SimulationControlsProps) {
  return (
    <div className="flex gap-2">
      <Button
        onClick={onRun}
        disabled={hasErrors || isComplete}
        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        <Play className="w-4 h-4 mr-2" />
        Run
      </Button>
      <Button
        onClick={onStep}
        disabled={hasErrors || isComplete}
        variant="secondary"
        className="flex-1"
      >
        <SkipForward className="w-4 h-4 mr-2" />
        Step
      </Button>
      <Button
        onClick={onReset}
        variant="outline"
        className="flex-1"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Reset
      </Button>
    </div>
  );
}
