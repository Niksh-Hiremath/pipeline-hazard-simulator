'use client';

import { Download, Minus, Plus, Save } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SimulationResult, InstructionSchedule } from '@/lib/types';

interface PipelineTableProps {
  result: SimulationResult | null;
  currentCycle?: number;
}

type ForwardingMarker = {
  kind: 'source' | 'receiver' | 'consumer_ex';
  text: string;
};

const STAGE_CELL_STYLES: Record<string, { bg: string; color: string; border: string; glow: string }> = {
  IF:      { bg: 'oklch(0.7 0.18 195 / 12%)', color: 'oklch(0.8 0.15 195)', border: 'oklch(0.7 0.18 195 / 30%)', glow: '0 0 8px oklch(0.7 0.18 195 / 15%)' },
  ID:      { bg: 'oklch(0.65 0.2 290 / 12%)', color: 'oklch(0.8 0.15 290)', border: 'oklch(0.65 0.2 290 / 30%)', glow: '0 0 8px oklch(0.65 0.2 290 / 15%)' },
  EX:      { bg: 'oklch(0.75 0.15 85 / 12%)',  color: 'oklch(0.85 0.12 85)',  border: 'oklch(0.75 0.15 85 / 30%)',  glow: '0 0 8px oklch(0.75 0.15 85 / 15%)' },
  MEM:     { bg: 'oklch(0.7 0.18 55 / 12%)',  color: 'oklch(0.85 0.12 55)',  border: 'oklch(0.7 0.18 55 / 30%)',  glow: '0 0 8px oklch(0.7 0.18 55 / 15%)' },
  WB:      { bg: 'oklch(0.7 0.2 155 / 12%)',  color: 'oklch(0.8 0.15 155)',  border: 'oklch(0.7 0.2 155 / 30%)',  glow: '0 0 8px oklch(0.7 0.2 155 / 15%)' },
  'MEM/WB':{ bg: 'oklch(0.65 0.18 170 / 12%)',color: 'oklch(0.8 0.12 170)',  border: 'oklch(0.65 0.18 170 / 30%)',glow: '0 0 8px oklch(0.65 0.18 170 / 15%)' },
};

function buildForwardingMarkerMap(result: SimulationResult | null) {
  const markerMap = new Map<number, Map<number, ForwardingMarker[]>>();
  if (!result) return markerMap;

  const pushMarker = (instructionIndex: number, cycle: number, marker: ForwardingMarker) => {
    if (!markerMap.has(instructionIndex)) markerMap.set(instructionIndex, new Map<number, ForwardingMarker[]>());
    const byCycle = markerMap.get(instructionIndex)!;
    if (!byCycle.has(cycle)) byCycle.set(cycle, []);
    byCycle.get(cycle)!.push(marker);
  };

  for (const hazard of result.hazards) {
    if (!hazard.resolvedByForwarding) continue;

    const producer = result.schedules[hazard.producerIndex];
    const consumer = result.schedules[hazard.consumerIndex];
    if (!producer || !consumer) continue;

    const producerStage = producer.instruction.opcode === 'LW'
      ? (producer.cycles.some((e) => e.stage === 'MEM') ? 'MEM' : 'MEM/WB')
      : 'EX';

    const sourceEntry = producer.cycles.find((e) => e.stage === producerStage && !e.isStall);
    const receiverEntry = consumer.cycles.find((e) => e.stage === 'ID' && !e.isStall);
    const consumerExEntry = consumer.cycles.find((e) => e.stage === 'EX' && !e.isStall);
    if (!sourceEntry || !receiverEntry) continue;

    const detail = `I${hazard.producerIndex + 1} ${producerStage} -> I${hazard.consumerIndex + 1} ID (${hazard.register})`;
    pushMarker(hazard.producerIndex, sourceEntry.cycle, { kind: 'source', text: detail });
    pushMarker(hazard.consumerIndex, receiverEntry.cycle, { kind: 'receiver', text: detail });
    if (consumerExEntry) {
      pushMarker(hazard.consumerIndex, consumerExEntry.cycle, { kind: 'consumer_ex', text: detail });
    }
  }

  return markerMap;
}

function StageCell({
  entry,
  dimmed,
  markers,
}: {
  entry: { stage: string; isStall: boolean; isForwarded: boolean };
  dimmed?: boolean;
  markers: ForwardingMarker[];
}) {
  const hasSource = markers.some((m) => m.kind === 'source');
  const hasReceiver = markers.some((m) => m.kind === 'receiver');
  const hasConsumerEx = markers.some((m) => m.kind === 'consumer_ex');
  const hasMarkers = markers.length > 0;

  if (entry.isStall) {
    return (
      <div
        className="w-full h-full px-2 py-1.5 text-center text-[10px] font-mono font-bold tracking-wider rounded-sm transition-all"
        style={{
          background: 'oklch(0.6 0.25 25 / 15%)',
          color: 'oklch(0.8 0.2 25)',
          border: '1px solid oklch(0.6 0.25 25 / 35%)',
          boxShadow: '0 0 8px oklch(0.6 0.25 25 / 15%)',
          animation: 'pulse-glow 1.5s ease-in-out infinite',
          opacity: dimmed ? 0.4 : 1,
        }}
      >
        STALL
      </div>
    );
  }

  const base = entry.isForwarded
    ? {
        bg: 'oklch(0.7 0.2 155 / 15%)',
        color: 'oklch(0.85 0.15 155)',
        border: 'oklch(0.7 0.2 155 / 40%)',
        glow: '0 0 10px oklch(0.7 0.2 155 / 20%)',
      }
    : STAGE_CELL_STYLES[entry.stage] || {
        bg: 'oklch(0.2 0.02 260 / 50%)',
        color: 'oklch(0.6 0.02 260)',
        border: 'oklch(0.3 0.02 260 / 30%)',
        glow: 'none',
      };

  const cell = (
    <div
      className="w-full h-full px-2 py-1.5 text-center text-[10px] font-mono font-bold tracking-wider rounded-sm relative"
      style={{
        background: base.bg,
        color: base.color,
        border: `1px solid ${base.border}`,
        boxShadow: base.glow,
        opacity: dimmed ? 0.4 : 1,
      }}
    >
      {entry.stage}
      {hasSource && <span className="ml-1" style={{ color: 'oklch(0.84 0.13 85)' }}>-&gt;</span>}
      {(hasReceiver || hasConsumerEx) && (
        <span className="ml-1" style={{ color: 'oklch(0.72 0.18 155)' }}>&lt;-</span>
      )}
    </div>
  );

  if (!hasMarkers) return cell;

  return (
    <Tooltip>
      <TooltipTrigger className="block w-full h-full">{cell}</TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5">
          {markers.map((marker, idx) => (
            <p key={idx} className="text-xs">{marker.text}</p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function InstructionRow({
  schedule,
  totalCycles,
  currentCycle,
  forwardingMarkers,
}: {
  schedule: InstructionSchedule;
  totalCycles: number;
  currentCycle?: number;
  forwardingMarkers: Map<number, ForwardingMarker[]>;
}) {
  const cycleMap = new Map<number, typeof schedule.cycles[0]>();
  for (const entry of schedule.cycles) cycleMap.set(entry.cycle, entry);

  const instructionLabel = `I${schedule.instruction.index + 1}`;
  const tooltipText = schedule.instruction.raw;
  const opcode = schedule.instruction.opcode;

  return (
    <div className="flex" style={{ animation: 'slide-in-right 0.3s ease backwards', animationDelay: `${schedule.instruction.index * 60}ms` }}>
      <Tooltip>
        <TooltipTrigger>
          <div
            className="w-[92px] min-w-[92px] px-2.5 py-2 text-[10px] font-mono font-bold flex items-center gap-1.5"
            style={{
              color: opcode === 'LW' || opcode === 'SW' ? 'oklch(0.8 0.15 195)' : 'oklch(0.8 0.15 290)',
              background: 'oklch(0.12 0.015 260)',
              borderRight: '1px solid oklch(0.3 0.02 260 / 40%)',
            }}
          >
            <span className="text-xs inline-flex items-center justify-center">
              {opcode === 'ADD' && <Plus className="w-3 h-3" />}
              {opcode === 'SUB' && <Minus className="w-3 h-3" />}
              {opcode === 'LW' && <Download className="w-3 h-3" />}
              {opcode === 'SW' && <Save className="w-3 h-3" />}
            </span>
            {instructionLabel}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="font-mono text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>

      <div className="flex flex-1">
        {Array.from({ length: totalCycles }, (_, i) => i + 1).map((cycle) => {
          const entry = cycleMap.get(cycle);
          const dimmed = currentCycle !== undefined && currentCycle > 0 && cycle > currentCycle;
          const isActive = currentCycle !== undefined && currentCycle > 0 && cycle === currentCycle;
          const markers = forwardingMarkers.get(cycle) || [];

          if (entry) {
            return (
              <div
                key={cycle}
                className="flex-1 min-w-[64px] p-1"
                style={{
                  borderRight: '1px solid oklch(0.2 0.015 260 / 30%)',
                  background: isActive ? 'oklch(0.7 0.18 195 / 5%)' : undefined,
                }}
              >
                <StageCell entry={entry} dimmed={dimmed} markers={markers} />
              </div>
            );
          }

          return (
            <div
              key={cycle}
              className="flex-1 min-w-[64px]"
              style={{
                borderRight: '1px solid oklch(0.2 0.015 260 / 30%)',
                background: isActive ? 'oklch(0.7 0.18 195 / 5%)' : 'oklch(0.1 0.01 260 / 50%)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function PipelineTable({ result, currentCycle }: PipelineTableProps) {
  if (!result || result.schedules.length === 0) {
    return (
      <div className="flex items-center justify-center h-36">
        <p className="text-xs" style={{ color: 'oklch(0.5 0.02 260)' }}>
          Run simulation to see pipeline stages
        </p>
      </div>
    );
  }

  const forwardingMarkerMap = buildForwardingMarkerMap(result);

  return (
    <div className="space-y-1" style={{ animation: 'slide-in-up 0.4s ease' }}>
      <div className="flex">
        <div
          className="w-[92px] min-w-[92px] px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider"
          style={{
            color: 'oklch(0.5 0.02 260)',
            background: 'oklch(0.1 0.015 260)',
            borderRight: '1px solid oklch(0.3 0.02 260 / 40%)',
            fontFamily: 'var(--font-outfit), sans-serif',
          }}
        >
          Instr
        </div>
        {Array.from({ length: result.totalCycles }, (_, i) => i + 1).map((cycle) => {
          const isActive = currentCycle !== undefined && cycle === currentCycle;
          return (
            <div
              key={cycle}
              className="flex-1 min-w-[64px] px-1.5 py-2 text-[10px] font-mono text-center"
              style={{
                color: isActive ? 'oklch(0.9 0.15 195)' : 'oklch(0.45 0.02 260)',
                background: isActive ? 'oklch(0.7 0.18 195 / 8%)' : 'oklch(0.1 0.015 260)',
                borderRight: '1px solid oklch(0.2 0.015 260 / 30%)',
                fontWeight: isActive ? 700 : 500,
              }}
            >
              C{cycle}
            </div>
          );
        })}
      </div>

      <ScrollArea className="w-full">
        <div className="min-w-max">
          {result.schedules.map((schedule) => (
            <InstructionRow
              key={schedule.instruction.index}
              schedule={schedule}
              totalCycles={result.totalCycles}
              currentCycle={currentCycle}
              forwardingMarkers={forwardingMarkerMap.get(schedule.instruction.index) || new Map<number, ForwardingMarker[]>()}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <div
        className="text-[10px] text-right pt-1.5 font-mono"
        style={{ color: 'oklch(0.5 0.02 260)' }}
      >
        Total Cycles: <span style={{ color: 'oklch(0.8 0.15 195)' }}>{result.totalCycles}</span>
      </div>
    </div>
  );
}
