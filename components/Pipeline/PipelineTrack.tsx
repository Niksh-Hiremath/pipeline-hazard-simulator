'use client';

import { useMemo, type CSSProperties, type ComponentType } from 'react';
import { Cpu, Database, Eye, FlaskConical, HardDriveDownload } from 'lucide-react';
import { InstructionSprite } from './InstructionSprite';
import { HazardZapper } from './HazardZapper';
import { ForwardingCourier } from './ForwardingCourier';
import type { SimulationResult, SimConfig, StageLabel, InstructionSchedule } from '@/lib/types';

interface PipelineTrackProps {
  result: SimulationResult | null;
  currentCycle: number;
  config: SimConfig;
}

const STAGE_COLORS: Record<string, string> = {
  IF: 'oklch(0.72 0.17 200)',
  ID: 'oklch(0.7 0.2 290)',
  EX: 'oklch(0.78 0.14 85)',
  MEM: 'oklch(0.75 0.15 65)',
  WB: 'oklch(0.7 0.2 155)',
  'MEM/WB': 'oklch(0.68 0.18 170)',
};

const STAGE_ICON: Record<string, ComponentType<{ className?: string; style?: CSSProperties }>> = {
  IF: Eye,
  ID: Cpu,
  EX: FlaskConical,
  MEM: Database,
  WB: HardDriveDownload,
  'MEM/WB': HardDriveDownload,
};

function getStages(config: SimConfig): StageLabel[] {
  return config.pipelineType === '5-stage'
    ? ['IF', 'ID', 'EX', 'MEM', 'WB']
    : ['IF', 'ID', 'EX', 'MEM/WB'];
}

function getDisplayInfo(schedule: InstructionSchedule, cycle: number) {
  const entry = schedule.cycles.find((c) => c.cycle === cycle);
  if (!entry) return null;

  if (entry.isStall) {
    const prev = schedule.cycles.filter((c) => c.cycle < cycle && !c.isStall);
    const lastRealStage = prev[prev.length - 1];
    return {
      stage: lastRealStage?.stage || 'IF',
      isStall: true,
      isForwarded: false,
    };
  }

  return {
    stage: entry.stage,
    isStall: false,
    isForwarded: entry.isForwarded,
  };
}

function getForwardingLines(
  result: SimulationResult,
  currentCycle: number,
  stages: StageLabel[]
): { fromRow: number; toRow: number; fromCol: number; toCol: number; register: string }[] {
  const lines: { fromRow: number; toRow: number; fromCol: number; toCol: number; register: string }[] = [];

  for (const hazard of result.hazards) {
    if (!hazard.resolvedByForwarding) continue;

    const consumer = result.schedules[hazard.consumerIndex];
    if (!consumer) continue;

    const consumerExEntry = consumer.cycles.find((c) => c.stage === 'EX' && c.isForwarded);
    if (!consumerExEntry || consumerExEntry.cycle !== currentCycle) continue;

    const producer = result.schedules[hazard.producerIndex];
    if (!producer) continue;

    const fwdStage =
      producer.instruction.opcode === 'LW'
        ? (stages.includes('MEM') ? 'MEM' : 'MEM/WB')
        : 'EX';

    const fromCol = stages.indexOf(fwdStage as StageLabel);
    const toCol = stages.indexOf('ID');

    if (fromCol >= 0 && toCol >= 0) {
      lines.push({
        fromRow: hazard.producerIndex,
        toRow: hazard.consumerIndex,
        fromCol,
        toCol,
        register: hazard.register,
      });
    }
  }

  return lines;
}

export function PipelineTrack({ result, currentCycle, config }: PipelineTrackProps) {
  const stages = useMemo(() => getStages(config), [config]);
  const numCols = stages.length;

  const forwardingLines = useMemo(() => {
    if (!result) return [];
    return getForwardingLines(result, currentCycle, stages);
  }, [result, currentCycle, stages]);

  const hasAnyStallAtCycle = useMemo(() => {
    if (!result || currentCycle <= 0) return false;
    return result.schedules.some((schedule) =>
      schedule.cycles.some((entry) => entry.cycle === currentCycle && entry.isStall)
    );
  }, [result, currentCycle]);

  if (!result || result.schedules.length === 0) {
    return (
      <div className="pipeline-track flex items-center justify-center h-full">
        <div className="text-center space-y-2" style={{ animation: 'fade-in 0.5s ease' }}>
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'oklch(0.84 0.08 78)' }}>
            Orbital Lab Ready
          </p>
          <p className="text-sm" style={{ color: 'oklch(0.62 0.02 260)' }}>
            Add instructions to launch Barry into the corridor.
          </p>
        </div>
      </div>
    );
  }

  const idCol = stages.indexOf('ID');
  return (
    <div
      className="pipeline-track h-full flex flex-col"
      style={hasAnyStallAtCycle ? { animation: 'shake 0.25s ease-in-out' } : undefined}
    >
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, oklch(0.22 0.05 245 / 40%), oklch(0.1 0.03 245 / 25%)), repeating-linear-gradient(90deg, transparent 0, transparent 32px, oklch(0.95 0.01 80 / 3%) 32px, oklch(0.95 0.01 80 / 3%) 33px)',
          }}
        />
      </div>

      <div className="relative z-10 flex border-b" style={{ borderColor: 'oklch(0.35 0.03 245 / 45%)' }}>
        {stages.map((stage) => {
          const Icon = STAGE_ICON[stage];
          return (
            <div
              key={stage}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold tracking-widest uppercase"
              style={{
                color: STAGE_COLORS[stage],
                borderRight: stage !== stages[stages.length - 1] ? '1px solid oklch(0.35 0.03 245 / 35%)' : undefined,
                textShadow: `0 0 14px ${STAGE_COLORS[stage]}40`,
                fontFamily: 'var(--font-outfit), sans-serif',
                background:
                  'linear-gradient(180deg, oklch(0.2 0.05 245 / 88%), oklch(0.14 0.03 245 / 70%))',
              }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: STAGE_COLORS[stage] }} />
              {stage}
            </div>
          );
        })}
      </div>

      <div className="relative z-10 flex-1 overflow-hidden">
        {result.schedules.map((schedule, rowIdx) => {
          const display = currentCycle > 0 ? getDisplayInfo(schedule, currentCycle) : null;
          const isVisible = currentCycle >= schedule.startCycle;
          const lastCycleEntry = schedule.cycles[schedule.cycles.length - 1];
          const isCompleted = lastCycleEntry ? currentCycle > lastCycleEntry.cycle : false;
          const rowOffset = (rowIdx % 3) * 2;

          let colIndex = -1;
          if (display) {
            colIndex = stages.indexOf(display.stage as StageLabel);
            if (colIndex < 0) colIndex = 0;
          }

          return (
            <div
              key={schedule.instruction.index}
              className="relative flex"
              style={{
                height: `${100 / result.schedules.length}%`,
                minHeight: '48px',
                borderBottom:
                  rowIdx < result.schedules.length - 1 ? '1px solid oklch(0.26 0.02 245 / 55%)' : undefined,
              }}
            >
              {stages.map((stage, ci) => (
                <div
                  key={`${stage}-${ci}`}
                  className="flex-1"
                  style={{
                    borderRight: ci < numCols - 1 ? '1px solid oklch(0.25 0.02 245 / 32%)' : undefined,
                    background:
                      display && !display.isStall && colIndex === ci
                        ? `${STAGE_COLORS[stage]}12`
                        : display && display.isStall && colIndex === ci
                          ? 'oklch(0.62 0.24 28 / 11%)'
                          : 'oklch(0.11 0.02 245 / 58%)',
                  }}
                />
              ))}

              {isVisible && display && colIndex >= 0 && (
                <div
                  className="absolute h-full flex items-center justify-center"
                  style={{
                    top: `${rowOffset}px`,
                    width: `${100 / numCols}%`,
                    transform: `translateX(${colIndex * 100}%)`,
                    transition: 'transform 1.2s cubic-bezier(0.22, 0.61, 0.36, 1)',
                    zIndex: 14,
                  }}
                >
                  <InstructionSprite
                    instruction={schedule.instruction}
                    isStalled={display.isStall}
                    isForwarded={display.isForwarded}
                    isCompleted={isCompleted}
                    isVisible
                  />
                </div>
              )}

              {isVisible && display?.isStall && idCol >= 0 && (
                <HazardZapper
                  widthPercent={100 / numCols}
                  leftPercent={Math.min(colIndex + 1, numCols - 1) * (100 / numCols)}
                />
              )}
            </div>
          );
        })}

        {forwardingLines.map((line, idx) => {
          const totalRows = result.schedules.length;
          const rowHeight = 100 / totalRows;
          const fromY = (line.fromRow + 0.5) * rowHeight;
          const toY = (line.toRow + 0.5) * rowHeight;
          const colWidth = 100 / numCols;
          const fromX = (line.fromCol + 0.5) * colWidth;
          const toX = (line.toCol + 0.5) * colWidth;

          return (
            <ForwardingCourier
              key={`fwd-${idx}`}
              id={`${idx}`}
              fromX={fromX}
              fromY={fromY}
              toX={toX}
              toY={toY}
              register={line.register}
            />
          );
        })}

        {forwardingLines.length > 0 && idCol >= 0 && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              width: `${100 / numCols}%`,
              left: `${Math.min(idCol + 1, numCols - 1) * (100 / numCols)}%`,
              background: 'linear-gradient(180deg, oklch(0.72 0.18 155 / 14%), oklch(0.72 0.18 155 / 5%))',
              borderLeft: '2px solid oklch(0.72 0.18 155 / 70%)',
              boxShadow: '0 0 18px oklch(0.72 0.18 155 / 45%)',
              zIndex: 18,
            }}
          />
        )}
      </div>
    </div>
  );
}
