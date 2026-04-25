import { PIPELINE_4_STAGE, PIPELINE_5_STAGE } from './constants';
import type { Hazard, Instruction, InstructionSchedule, SimConfig, CycleEntry, SimulationResult, StageLabel } from './types';

function getPipelineStages(config: SimConfig): StageLabel[] {
  return config.pipelineType === '5-stage'
    ? [...PIPELINE_5_STAGE]
    : [...PIPELINE_4_STAGE];
}

function isALU(op: Instruction['opcode']): boolean {
  return op === 'ADD' || op === 'SUB';
}

function isLW(op: Instruction['opcode']): boolean {
  return op === 'LW';
}

function computeStalls(producer: Instruction, consumer: Instruction, config: SimConfig): number {
  const producerIsALU = isALU(producer.opcode);
  const producerIsLW = isLW(producer.opcode);
  const consumerIsALU = isALU(consumer.opcode);

  if (!config.forwardingEnabled) {
    if (config.pipelineType === '5-stage') {
      const distance = consumer.index - producer.index;
      if (distance === 1) return 2;
      if (distance === 2) return 1;
      return 0;
    } else {
      const distance = consumer.index - producer.index;
      if (distance === 1) return 1;
      return 0;
    }
  }

  if (config.pipelineType === '5-stage') {
    if (producerIsALU && consumerIsALU) {
      return 0;
    }
    if (producerIsLW && consumerIsALU) {
      const distance = consumer.index - producer.index;
      if (distance === 1) return 1;
      return 0;
    }
    return 0;
  } else {
    if (producerIsALU && consumerIsALU) {
      return 0;
    }
    if (producerIsLW && consumerIsALU) {
      const distance = consumer.index - producer.index;
      if (distance === 1) return 1;
      return 0;
    }
    return 0;
  }
}

function hasRAWDependency(producer: Instruction, consumer: Instruction): boolean {
  if (producer.dest === null) return false;
  return producer.dest === consumer.src1 || producer.dest === consumer.src2;
}

function findRAWProducer(instructions: Instruction[], consumerIdx: number): Instruction | null {
  for (let i = consumerIdx - 1; i >= 0; i--) {
    if (hasRAWDependency(instructions[i], instructions[consumerIdx])) {
      return instructions[i];
    }
  }
  return null;
}

export function simulate(instructions: Instruction[], config: SimConfig): SimulationResult {
  if (instructions.length === 0) {
    return { schedules: [], hazards: [], totalCycles: 0 };
  }

  const stages = getPipelineStages(config);
  const schedules: InstructionSchedule[] = [];
  const hazards: Hazard[] = [];
  let currentCycle = 1;

  for (let j = 0; j < instructions.length; j++) {
    const instruction = instructions[j];
    let earliestStart = currentCycle;

    const producer = findRAWProducer(instructions, j);
    if (producer) {
      const stalls = computeStalls(producer, instruction, config);
      earliestStart = Math.max(earliestStart, producer.index + stalls + 1);

      const producerSchedule = schedules[producer.index];
      if (producerSchedule) {
        earliestStart = Math.max(earliestStart, producerSchedule.startCycle + stalls + 1);
      }

      hazards.push({
        producerIndex: producer.index,
        consumerIndex: j,
        register: producer.dest!,
        stallsInserted: stalls,
        resolvedByForwarding: config.forwardingEnabled && stalls === 0,
      });
    }

    const cycles: CycleEntry[] = [];
    let cycle = earliestStart;

    if (producer) {
      const stalls = computeStalls(producer, instruction, config);
      for (let s = 0; s < stalls; s++) {
        cycles.push({
          cycle: cycle++,
          stage: 'STALL',
          isStall: true,
          isForwarded: false,
        });
      }
    }

    for (const stage of stages) {
      let isForwarded = false;
      if (config.forwardingEnabled && !producer?.dest) {
        isForwarded = false;
      } else if (config.forwardingEnabled && producer) {
        const producerIsALU = isALU(producer.opcode);
        const consumerIsALU = isALU(instruction.opcode);
        if (producerIsALU && consumerIsALU) {
          isForwarded = stage !== 'IF' && stage !== 'ID';
        }
      }

      cycles.push({
        cycle: cycle++,
        stage,
        isStall: false,
        isForwarded,
      });
    }

    schedules.push({
      instruction,
      cycles,
      startCycle: earliestStart,
    });

    currentCycle = earliestStart + 1;
  }

  let totalCycles = 0;
  for (const schedule of schedules) {
    const lastCycle = schedule.cycles[schedule.cycles.length - 1];
    if (lastCycle && lastCycle.cycle > totalCycles) {
      totalCycles = lastCycle.cycle;
    }
  }

  return { schedules, hazards, totalCycles };
}
