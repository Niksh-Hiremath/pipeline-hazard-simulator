/**
 * simulator.ts
 *
 * Pipeline logic ported directly from pipeline_hazard_simulator_extended.html.
 *
 * Core algorithm (computeSchedule in the HTML):
 *  - Track the last writer of every register via a Map.
 *  - For each instruction, compute stalls against the LAST writer of each source
 *    register using a distance-based formula (looks at ALL prior instructions,
 *    not just 2 back — fixing the structural in-order correctness issue).
 *  - Issue cycles cascade: nextIssueCycle = prevIssue + 1 + stalls.
 *  - Stall cells are placed between IF and ID (pre-ID slot), matching the HTML display.
 *
 * Stall formula:
 *   Without forwarding — needed = max(0, base − dist + 1)
 *     where base = 3 (5-stage) or 2 (4-stage), dist = consumerIdx − producerIdx
 *   With forwarding —
 *     LW producer: needed = max(0, 1 − dist + 1)  → 1 stall if adjacent, 0 otherwise
 *     ALU producer: needed = 0  (EX→EX forwarding, always in time)
 */

import { PIPELINE_4_STAGE, PIPELINE_5_STAGE } from './constants';
import type {
  Instruction,
  SimConfig,
  SimulationResult,
  InstructionSchedule,
  Hazard,
  CycleEntry,
  StageLabel,
  ForwardingDetail,
  StallDetail,
} from './types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getStages(config: SimConfig): StageLabel[] {
  return config.pipelineType === '5-stage'
    ? [...PIPELINE_5_STAGE] as StageLabel[]
    : [...PIPELINE_4_STAGE] as StageLabel[];
}

/** Registers read by an instruction (sources that trigger hazard checks). */
function getSources(instr: Instruction): string[] {
  const srcs: string[] = [];
  if (instr.src1) srcs.push(instr.src1);
  if (instr.src2) srcs.push(instr.src2);
  return srcs.filter(Boolean);
}

/** Number of stalls needed between producer j and consumer i. */
function stallsNeeded(
  producerOpcode: string,
  dist: number,          // consumerIdx − producerIdx  (always >= 1)
  config: SimConfig,
): number {
  if (!config.forwardingEnabled) {
    const base = config.pipelineType === '5-stage' ? 3 : 2;
    return Math.max(0, base - dist + 1);
  }
  // With forwarding
  if (producerOpcode === 'LW') {
    return Math.max(0, 1 - dist + 1); // 1 if dist===1, 0 otherwise
  }
  return 0; // ALU→ALU: EX forwarding, always in time
}

// ─── public API ───────────────────────────────────────────────────────────────

export function simulate(
  instructions: Instruction[],
  config: SimConfig,
): SimulationResult {
  if (instructions.length === 0) {
    return { schedules: [], hazards: [], totalCycles: 0, stallDetails: [], forwardingDetails: [] };
  }

  const stages = getStages(config);
  // Stages after IF (ID, EX, MEM, WB  or  ID, EX, MEM/WB)
  const postIfStages = stages.slice(1) as StageLabel[];

  // lastWriter[reg] = index of the most recent instruction that writes to reg
  const lastWriter = new Map<string, number>();

  const hazards: Hazard[] = [];
  const stallDetails: StallDetail[] = [];
  const forwardingDetails: ForwardingDetail[] = [];
  const schedules: InstructionSchedule[] = [];

  let nextIssueCycle = 1;
  let totalCycles = 0;

  instructions.forEach((instr, i) => {
    const sources = getSources(instr);
    let stalls = 0;

    // Find the worst-case stall from any source register
    for (const src of sources) {
      if (!lastWriter.has(src)) continue;

      const j = lastWriter.get(src)!;
      const producer = instructions[j];
      const dist = i - j; // always >= 1
      const needed = stallsNeeded(producer.opcode, dist, config);

      stalls = Math.max(stalls, needed);

      if (needed > 0) {
        hazards.push({
          producerIndex: j,
          consumerIndex: i,
          register: src,
          stallsInserted: needed,
          resolvedByForwarding: false,
        });
      } else if (config.forwardingEnabled && dist <= 2) {
        // Dependency exists but forwarding resolves it with 0 stalls
        hazards.push({
          producerIndex: j,
          consumerIndex: i,
          register: src,
          stallsInserted: 0,
          resolvedByForwarding: true,
        });
      }
    }

    const issueCycle = nextIssueCycle;

    // Build per-cycle entries:
    //   IF at issueCycle
    //   STALL × stalls at issueCycle+1 … issueCycle+stalls
    //   ID, EX, MEM, WB at issueCycle+stalls+1 …
    const cycles: CycleEntry[] = [];

    cycles.push({ cycle: issueCycle, stage: 'IF', isStall: false, isForwarded: false });

    for (let s = 1; s <= stalls; s++) {
      const stallCycle = issueCycle + s;
      // Record verbose stall detail
      const causedBy = hazards.filter(
        h => h.consumerIndex === i && !h.resolvedByForwarding && h.stallsInserted >= s,
      );
      stallDetails.push({
        instructionIndex: i,
        cycle: stallCycle,
        causedByProducers: causedBy.map(h => h.producerIndex),
        registers: causedBy.map(h => h.register),
      });
      cycles.push({ cycle: stallCycle, stage: 'STALL', isStall: true, isForwarded: false });
    }

    postIfStages.forEach((stage, si) => {
      const c = issueCycle + stalls + 1 + si;

      // Mark EX as forwarded if this instruction has a forwarding hazard
      const isForwarded =
        stage === 'EX' &&
        config.forwardingEnabled &&
        hazards.some(h => h.consumerIndex === i && h.resolvedByForwarding);

      cycles.push({ cycle: c, stage, isStall: false, isForwarded });
    });

    schedules.push({ instruction: instr, startCycle: issueCycle, cycles });

    const lastCycle = cycles[cycles.length - 1].cycle;
    totalCycles = Math.max(totalCycles, lastCycle);

    // Cascade: next instruction enters IF on the cycle after THIS instruction's last stall
    // (i.e., the same cycle this instruction enters ID)
    nextIssueCycle = issueCycle + 1 + stalls;

    // Update last writer
    if (instr.dest) lastWriter.set(instr.dest, i);
  });

  // Build forwarding details for resolved hazards
  for (const h of hazards) {
    if (!h.resolvedByForwarding) continue;
    const producerInstr = instructions[h.producerIndex];
    const producerSched = schedules[h.producerIndex];
    const consumerSched = schedules[h.consumerIndex];

    const fromStage: StageLabel = producerInstr.opcode === 'LW' ? 'MEM' : 'EX';
    const fromEntry = producerSched.cycles.find(e => e.stage === fromStage);
    const toEntry = consumerSched.cycles.find(e => e.stage === 'EX');

    if (fromEntry && toEntry) {
      forwardingDetails.push({
        producerIndex: h.producerIndex,
        consumerIndex: h.consumerIndex,
        register: h.register,
        fromStage,
        toStage: 'EX',
        fromCycle: fromEntry.cycle,
        toCycle: toEntry.cycle,
        isLoadUseForwarding: producerInstr.opcode === 'LW',
      });
    }
  }

  return { schedules, hazards, totalCycles, stallDetails, forwardingDetails };
}
