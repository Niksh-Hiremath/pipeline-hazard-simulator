'use client';

import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SimulationResult, InstructionSchedule } from '@/lib/types';

interface PipelineTableProps {
  result: SimulationResult | null;
}

function StageCell({ entry }: { entry: { stage: string; isStall: boolean; isForwarded: boolean } }) {
  const baseClasses = 'px-3 py-2 text-center text-xs font-mono font-medium transition-colors';

  if (entry.isStall) {
    return (
      <div className={`${baseClasses} bg-red-900/30 text-red-400 border border-red-900/50`}>
        STALL
      </div>
    );
  }

  if (entry.isForwarded) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <div className={`${baseClasses} bg-green-900/30 text-green-400 border border-green-900/50 relative`}>
            {entry.stage}
            <span className="ml-1 text-green-500">↓</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Forwarded from previous stage</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  const stageColors: Record<string, string> = {
    IF: 'bg-blue-900/30 text-blue-400 border-blue-900/50',
    ID: 'bg-purple-900/30 text-purple-400 border-purple-900/50',
    EX: 'bg-yellow-900/30 text-yellow-400 border-yellow-900/50',
    MEM: 'bg-orange-900/30 text-orange-400 border-orange-900/50',
    WB: 'bg-green-900/30 text-green-400 border-green-900/50',
    'MEM/WB': 'bg-green-900/30 text-green-400 border-green-900/50',
  };

  const colorClass = stageColors[entry.stage] || 'bg-muted text-muted-foreground border-border';

  return (
    <div className={`${baseClasses} ${colorClass} border`}>
      {entry.stage}
    </div>
  );
}

function InstructionRow({ schedule, totalCycles }: { schedule: InstructionSchedule; totalCycles: number }) {
  const maxCycle = totalCycles;
  const cycleMap = new Map<number, typeof schedule.cycles[0]>();

  for (const entry of schedule.cycles) {
    cycleMap.set(entry.cycle, entry);
  }

  const instructionLabel = `I${schedule.instruction.index + 1}`;
  const tooltipText = schedule.instruction.raw;

  return (
    <div className="flex">
      <Tooltip>
        <TooltipTrigger>
          <div className="w-20 min-w-[80px] px-2 py-2 text-xs font-mono font-bold text-primary bg-muted/50 border-r border-border flex items-center">
            {instructionLabel}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="font-mono text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>

      <div className="flex flex-1">
        {Array.from({ length: maxCycle }, (_, i) => i + 1).map((cycle) => {
          const entry = cycleMap.get(cycle);
          if (entry) {
            return (
              <div key={cycle} className="flex-1 min-w-[60px] border-r border-border last:border-r-0">
                <StageCell entry={entry} />
              </div>
            );
          }
          return (
            <div
              key={cycle}
              className="flex-1 min-w-[60px] bg-muted/20 border-r border-border last:border-r-0"
            />
          );
        })}
      </div>
    </div>
  );
}

export function PipelineTable({ result }: PipelineTableProps) {
  if (!result || result.schedules.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Run simulation to see pipeline stages
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex">
        <div className="flex flex-1">
          <div className="w-20 min-w-20 px-2 py-2 text-xs font-bold text-muted-foreground bg-muted/30 border-r border-border">
            Instruction
          </div>
          {Array.from({ length: result.totalCycles }, (_, i) => i + 1).map((cycle) => (
            <div
              key={cycle}
              className="flex-1 min-w-15 px-2 py-2 text-xs font-mono text-center text-muted-foreground bg-muted/30 border-r border-border last:border-r-0"
            >
              C{cycle}
            </div>
          ))}
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="min-w-max">
          {result.schedules.map((schedule) => (
            <InstructionRow
              key={schedule.instruction.index}
              schedule={schedule}
              totalCycles={result.totalCycles}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <div className="text-xs text-muted-foreground text-right pt-2">
        Total Cycles: {result.totalCycles}
      </div>
    </div>
  );
}
