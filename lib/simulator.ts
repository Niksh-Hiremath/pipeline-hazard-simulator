import { PIPELINE_4_STAGE, PIPELINE_5_STAGE } from './constants';
import type { Hazard, Instruction, InstructionSchedule, SimConfig, CycleEntry, SimulationResult, StageLabel } from './types';

function getPipelineStages(config: SimConfig): StageLabel[] {
  return config.pipelineType === '5-stage'
    ? [...PIPELINE_5_STAGE]
    : [...PIPELINE_4_STAGE];
}

function getStageCount(config: SimConfig): number {
  return config.pipelineType === '5-stage' ? 5 : 4;
}

/**
 * Core stall computation (cycle-accurate model).
 *
 * Key insight: IF cycles are always consecutive — instruction i always enters IF
 * at cycle (i + 1). Stalls are inserted WITHIN a row between IF and ID, not as
 * gaps before IF. This matches the real pipeline stall mechanism where the front-end
 * is frozen while downstream stages drain.
 *
 * With ifStart[i] = i + 1:
 *   idCycle[i]   = i + 1 + stalls[i] + 1 = i + stalls[i] + 2
 *   exCycle[i]   = i + stalls[i] + 3
 *   memCycle[i]  = i + stalls[i] + 4   (MEM in 5-stage, MEM/WB in 4-stage)
 *   wbCycle[i]   = i + stalls[i] + 5   (WB in 5-stage only)
 *   lastCycle[i] = i + stalls[i] + nStages
 *
 * Rules:
 *   No forwarding:   consumer ID must be STRICTLY AFTER producer last stage
 *                    → stalls[i] ≥ producerLastCycle − i − 1
 *
 *   Fwd, ALU→*:      consumer EX must be ≥ producer EX (non-strict, EX→EX forward)
 *                    → stalls[i] ≥ producerExCycle − i − 3
 *
 *   Fwd, LW→*:       consumer EX must be STRICTLY AFTER producer MEM (MEM→EX forward)
 *                    → stalls[i] ≥ producerMemCycle − i − 2
 *
 * Note: for chained hazards (producer itself has stalls), this naturally produces
 * more stalls than the simplified textbook distance-based formula. This is the
 * physically correct behaviour.
 */
function computeAllStalls(instructions: Instruction[], config: SimConfig): number[] {
  const n = instructions.length;
  const nStages = getStageCount(config);
  const stalls: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const instr = instructions[i];
    let minStalls = 0;

    for (let j = 0; j < i; j++) {
      const prev = instructions[j];
      if (prev.dest === null) continue;
      if (prev.dest !== instr.src1 && prev.dest !== instr.src2) continue;

      let required: number;

      if (!config.forwardingEnabled) {
        // producerLastCycle = (j+1) + stalls[j] + (nStages-1) = j + stalls[j] + nStages
        const producerLastCycle = j + stalls[j] + nStages;
        // consumerIdCycle = i + stalls[i] + 2 must be > producerLastCycle
        // stalls[i] >= producerLastCycle - i - 1
        required = producerLastCycle - i - 1;
      } else if (prev.opcode === 'LW') {
        // MEM→EX forwarding. producerMemCycle = j + stalls[j] + 4
        // consumerExCycle = i + stalls[i] + 3 must be strictly > producerMemCycle
        // stalls[i] > producerMemCycle - i - 3 → stalls[i] >= producerMemCycle - i - 2
        const producerMemCycle = j + stalls[j] + 4;
        required = producerMemCycle - i - 2;
      } else {
        // EX→EX forwarding (ALU producer). producerExCycle = j + stalls[j] + 3
        // consumerExCycle = i + stalls[i] + 3 must be STRICTLY AFTER producerExCycle
        // (forwarding delivers result from end of EX, so consumer EX must start next cycle)
        // stalls[i] > producerExCycle - i - 3 → stalls[i] >= producerExCycle - i - 2
        const producerExCycle = j + stalls[j] + 3;
        required = producerExCycle - i - 2;
      }

      minStalls = Math.max(minStalls, required);
    }

    stalls[i] = Math.max(0, minStalls);
  }

  return stalls;
}

export function simulate(instructions: Instruction[], config: SimConfig): SimulationResult {
  if (instructions.length === 0) {
    return { schedules: [], hazards: [], totalCycles: 0 };
  }

  const stages = getPipelineStages(config);
  const nStages = getStageCount(config);

  // --- Pass 1: Compute stall counts ---
  const stalls = computeAllStalls(instructions, config);

  // ifStart[i] = i + 1  (always consecutive, stalls are WITHIN the row)
  const ifStart = instructions.map((_, i) => i + 1);

  // Total cycles = end of last instruction's final stage
  // lastCycle[i] = ifStart[i] + stalls[i] + (nStages - 1) = i + 1 + stalls[i] + nStages - 1 = i + stalls[i] + nStages
  const totalCycles = Math.max(...instructions.map((_, i) => i + stalls[i] + nStages));

  // --- Pass 2: Record hazards ---
  const hazards: Hazard[] = [];
  for (let i = 0; i < instructions.length; i++) {
    const instr = instructions[i];
    for (let j = 0; j < i; j++) {
      const prev = instructions[j];
      if (prev.dest === null) continue;
      if (prev.dest !== instr.src1 && prev.dest !== instr.src2) continue;

      // Stall count attributable to this specific producer-consumer pair
      let pairStalls: number;
      if (!config.forwardingEnabled) {
        const producerLastCycle = j + stalls[j] + nStages;
        pairStalls = Math.max(0, producerLastCycle - i - 1);
      } else if (prev.opcode === 'LW') {
        const producerMemCycle = j + stalls[j] + 4;
        pairStalls = Math.max(0, producerMemCycle - i - 2);
      } else {
        // EX→EX forwarding: consumer EX must be strictly after producer EX
        const producerExCycle = j + stalls[j] + 3;
        pairStalls = Math.max(0, producerExCycle - i - 2);
      }

      hazards.push({
        producerIndex: j,
        consumerIndex: i,
        register: prev.dest,
        stallsInserted: pairStalls,
        resolvedByForwarding: config.forwardingEnabled && pairStalls === 0,
      });
    }
  }

  // --- Pass 3: Build pipeline table rows ---
  const indexedSchedules: InstructionSchedule[] = [];

  for (let i = 0; i < instructions.length; i++) {
    const instr = instructions[i];
    const start = ifStart[i];       // always i + 1
    const stallCount = stalls[i];

    // Special case: 4-stage LW→consumer with forwarding.
    // The stall appears AT the EX slot (after IF and ID proceed normally).
    // Row layout: IF | ID | STALL | EX | MEM/WB
    // This only applies when LW is the most recent producer causing stalls.
    const mostRecentProducer = (() => {
      for (let j = i - 1; j >= 0; j--) {
        const prev = instructions[j];
        if (prev.dest === null) continue;
        if (prev.dest === instr.src1 || prev.dest === instr.src2) return prev;
      }
      return null;
    })();

    // Special case: LW→consumer with forwarding enabled (both 4-stage and 5-stage).
    // The stall appears AFTER ID (between ID and EX), not after IF.
    // 4-stage row: IF | ID | STALL | EX | MEM/WB
    // 5-stage row: IF | ID | STALL | EX | MEM | WB
    const isLWForwardStall =
      config.forwardingEnabled &&
      mostRecentProducer !== null &&
      mostRecentProducer.opcode === 'LW' &&
      stallCount > 0;

    const cycleMap = new Map<number, { stage: StageLabel; isStall: boolean }>();

    if (isLWForwardStall) {
      // IF and ID happen normally at their natural positions
      cycleMap.set(start, { stage: 'IF', isStall: false });
      cycleMap.set(start + 1, { stage: 'ID', isStall: false });
      // Stall(s) appear between ID and EX
      let cursor = start + 2;
      for (let s = 0; s < stallCount; s++) {
        cycleMap.set(cursor++, { stage: 'STALL', isStall: true });
      }
      // Remaining stages after IF and ID
      for (const stage of stages) {
        if (stage === 'IF' || stage === 'ID') continue;
        cycleMap.set(cursor++, { stage: stage as StageLabel, isStall: false });
      }
    } else {
      // Standard: IF first, then stallCount STALL bubbles, then remaining stages
      cycleMap.set(start, { stage: 'IF', isStall: false });

      let cursor = start + 1;
      for (let s = 0; s < stallCount; s++) {
        cycleMap.set(cursor++, { stage: 'STALL', isStall: true });
      }
      for (const stage of stages) {
        if (stage === 'IF') continue;
        cycleMap.set(cursor++, { stage: stage as StageLabel, isStall: false });
      }
    }

    // Build sorted CycleEntry array
    const cycleKeys = Array.from(cycleMap.keys()).sort((a, b) => a - b);
    const cycles: CycleEntry[] = cycleKeys.map(cycle => {
      const { stage, isStall } = cycleMap.get(cycle)!;

      // Mark EX as forwarded when any hazard for this instruction was resolved by forwarding
      const isForwarded =
        !isStall &&
        stage === 'EX' &&
        config.forwardingEnabled &&
        hazards.some(h => h.consumerIndex === i && h.resolvedByForwarding);

      return { cycle, stage, isStall, isForwarded };
    });

    indexedSchedules.push({
      instruction: instr,
      startCycle: start,
      cycles,
    });
  }

  return {
    schedules: indexedSchedules,
    hazards,
    totalCycles,
  };
}
