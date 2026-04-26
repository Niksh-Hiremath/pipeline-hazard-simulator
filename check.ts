import { simulate } from './lib/simulator';
import { parseInstructions } from './lib/parser';

const cases = [
  // 5S-TC4a: I1->I3 on R1, d=2, no fwd
  ['ADD R1, R2, R3\nADD R4, R5, R6\nSW R1, 0(R7)', '5-stage', false],
  // 4S-TC2a: I1->I3 on R1, d=2, no fwd
  ['ADD R1, R2, R3\nADD R4, R5, R6\nSUB R3, R1, R4', '4-stage', false],
  // 4S-TC2b: I1->I3 on R1, d=2, with fwd
  ['ADD R1, R2, R3\nADD R4, R5, R6\nSUB R3, R1, R4', '4-stage', true],
  // 4S-TC4b: LW->I3 on R1, d=2, with fwd
  ['LW R1, 0(R2)\nADD R4, R5, R6\nADD R3, R1, R4', '4-stage', true],
];

for (const [code, pt, fwd] of cases) {
  const r = parseInstructions(code as string);
  const s = simulate(r.instructions, { pipelineType: pt as any, forwardingEnabled: fwd as boolean });
  console.log(`\n${(code as string).replace(/\n/g, ' | ')} | ${pt} | fwd:${fwd}`);
  console.log(`totalCycles=${s.totalCycles}`);
  for (const sch of s.schedules) {
    const cells: string[] = [];
    for (const cyc of sch.cycles) {
      cells.push(cyc ? cyc.stage : '_');
    }
    console.log(`  "${sch.instruction.raw}" [${cells.join(',')}]`);
  }
  console.log(`  hazards: ${s.hazards.map(h => `I${h.producerIndex+1}>I${h.consumerIndex+1} ${h.register} stalls=${h.stallsInserted}`).join(', ')}`);
}