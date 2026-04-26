import { simulate } from './lib/simulator';
import { parseInstructions } from './lib/parser';

function dumpAll(code: string, pipelineType: string, forwarding: boolean) {
  const result = parseInstructions(code);
  if (result.errors.length > 0) { console.log('PARSE ERRORS', result.errors); return; }
  const sim = simulate(result.instructions, { pipelineType: pipelineType as any, forwardingEnabled: forwarding });
  const n = sim.totalCycles;

  console.log(`\n=== ${code.replace(/\n/g,' | ')} | ${pipelineType} | fwd:${forwarding} ===`);
  console.log(`totalCycles=${sim.totalCycles}`);

  for (const sch of sim.schedules) {
    const row: (string | undefined)[] = [];
    for (let c = 1; c <= n; c++) row.push(undefined);
    for (const cyc of sch.cycles) {
      if (cyc) row[cyc.cycle - 1] = cyc.stage;
    }
    const cells = row.map(c => c ?? '');
    console.log(`  "${sch.instruction.raw}" startCycle=${sch.startCycle} | ${cells.join(' | ')}`);
  }

  console.log(`Hazards: ${sim.hazards.map(h => `I${h.producerIndex+1}>I${h.consumerIndex+1} ${h.register} stalls=${h.stallsInserted}`).join(', ')}`);
}

// 5-stage cases
dumpAll('ADD R1, R2, R3\nSUB R4, R5, R6', '5-stage', false);
dumpAll('ADD R1, R2, R3\nSUB R4, R1, R5', '5-stage', false);
dumpAll('ADD R1, R2, R3\nSUB R4, R1, R5', '5-stage', true);
dumpAll('LW R1, 0(R2)\nADD R3, R1, R4', '5-stage', false);
dumpAll('LW R1, 0(R2)\nADD R3, R1, R4', '5-stage', true);
dumpAll('ADD R1, R2, R3\nADD R4, R5, R6\nSW R1, 0(R7)', '5-stage', false);
dumpAll('ADD R1, R2, R3\nADD R4, R5, R6\nSW R1, 0(R7)', '5-stage', true);
dumpAll('LW R1, 0(R2)\nADD R3, R1, R4\nSUB R5, R3, R6', '5-stage', false);
dumpAll('LW R1, 0(R2)\nADD R3, R1, R4\nSUB R5, R3, R6', '5-stage', true);
dumpAll('LW R8, 4(R2)\nADD R9, R8, R6\nSW R9, 0(R10)', '5-stage', false);
dumpAll('LW R8, 4(R2)\nADD R9, R8, R6\nSW R9, 0(R10)', '5-stage', true);
dumpAll('LW R1, 0(R2)\nADD R3, R1, R4\nSUB R5, R3, R6\nLW R7, 4(R2)', '5-stage', false);
dumpAll('LW R1, 0(R2)\nADD R3, R1, R4\nSUB R5, R3, R6\nLW R7, 4(R2)', '5-stage', true);

// 4-stage cases
dumpAll('ADD R1, R2, R3\nSUB R4, R1, R5', '4-stage', false);
dumpAll('ADD R1, R2, R3\nSUB R4, R1, R5', '4-stage', true);
dumpAll('ADD R1, R2, R3\nADD R4, R5, R6\nSUB R3, R1, R4', '4-stage', false);
dumpAll('ADD R1, R2, R3\nADD R4, R5, R6\nSUB R3, R1, R4', '4-stage', true);
dumpAll('LW R1, 0(R2)\nADD R3, R1, R4', '4-stage', false);
dumpAll('LW R1, 0(R2)\nADD R3, R1, R4', '4-stage', true);
dumpAll('LW R1, 0(R2)\nADD R4, R5, R6\nADD R3, R1, R4', '4-stage', false);
dumpAll('LW R1, 0(R2)\nADD R4, R5, R6\nADD R3, R1, R4', '4-stage', true);
dumpAll('ADD R1, R2, R3\nADD R1, R1, R4\nSUB R5, R1, R6', '4-stage', false);
dumpAll('ADD R1, R2, R3\nADD R1, R1, R4\nSUB R5, R1, R6', '4-stage', true);
dumpAll('ADD R1, R2, R3\nSW R1, 0(R4)', '4-stage', false);
dumpAll('ADD R1, R2, R3\nSW R1, 0(R4)', '4-stage', true);