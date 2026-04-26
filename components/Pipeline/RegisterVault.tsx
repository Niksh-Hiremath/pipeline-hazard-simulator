'use client';

import type { PipelineType, SimulationResult } from '@/lib/types';

interface RegisterVaultProps {
  result: SimulationResult | null;
  currentCycle: number;
  pipelineType: PipelineType;
}

type RegisterState = {
  writer: string;
  cycle: number;
};

function getCommitStage(pipelineType: PipelineType) {
  return pipelineType === '5-stage' ? 'WB' : 'MEM/WB';
}

function buildRegisterSnapshot(
  result: SimulationResult,
  currentCycle: number,
  pipelineType: PipelineType
): Map<string, RegisterState> {
  const snapshot = new Map<string, RegisterState>();
  const commitStage = getCommitStage(pipelineType);

  for (const schedule of result.schedules) {
    const dest = schedule.instruction.dest;
    if (!dest) continue;

    const commitEntry = schedule.cycles.find(
      (entry) =>
        entry.stage === commitStage &&
        !entry.isStall &&
        entry.cycle <= (currentCycle || result.totalCycles)
    );

    if (!commitEntry) continue;
    snapshot.set(dest, {
      writer: `I${schedule.instruction.index + 1} ${schedule.instruction.opcode}`,
      cycle: commitEntry.cycle,
    });
  }

  return snapshot;
}

export function RegisterVault({ result, currentCycle, pipelineType }: RegisterVaultProps) {
  if (!result || result.schedules.length === 0) {
    return (
      <div
        className="rounded-lg px-3 py-2.5 text-[11px]"
        style={{
          background: 'oklch(0.16 0.02 190 / 20%)',
          border: '1px solid oklch(0.65 0.12 190 / 25%)',
          color: 'oklch(0.76 0.08 190)',
        }}
      >
        Vault idle. Run the pipeline to see WB commits.
      </div>
    );
  }

  const snapshot = buildRegisterSnapshot(result, currentCycle, pipelineType);

  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: 'linear-gradient(180deg, oklch(0.15 0.03 188 / 45%), oklch(0.12 0.02 188 / 45%))',
        border: '1px solid oklch(0.65 0.12 190 / 28%)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'oklch(0.8 0.11 190)' }}>
          WB Vault
        </span>
        <span className="text-[10px] font-mono" style={{ color: 'oklch(0.78 0.06 190)' }}>
          Registers R0-R31
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
        {Array.from({ length: 32 }, (_, idx) => `R${idx}`).map((reg) => {
          const state = snapshot.get(reg);
          return (
            <div
              key={reg}
              className="rounded px-2 py-1.5 text-[10px]"
              style={{
                background: state ? 'oklch(0.7 0.2 155 / 12%)' : 'oklch(0.12 0.02 188 / 45%)',
                border: `1px solid ${state ? 'oklch(0.7 0.2 155 / 35%)' : 'oklch(0.28 0.03 188 / 45%)'}`,
              }}
            >
              <div className="font-mono font-bold" style={{ color: 'oklch(0.93 0.01 260)' }}>
                {reg}
              </div>
              <div className="font-mono truncate" style={{ color: state ? 'oklch(0.82 0.14 155)' : 'oklch(0.56 0.02 260)' }}>
                {state ? state.writer : '--'}
              </div>
              <div className="font-mono" style={{ color: 'oklch(0.52 0.02 260)' }}>
                {state ? `C${state.cycle}` : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
