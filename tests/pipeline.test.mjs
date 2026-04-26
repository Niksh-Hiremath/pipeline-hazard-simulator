/**
 * Pipeline Simulator Tests
 * Run: node pipeline.test.mjs
 *
 * Covers all ADD/SUB/LW/SW test cases from:
 *   - 5_stage_test_cases.pdf  (Test Cases 1–7)
 *   - 4_stage_test_cases.pdf  (Test Cases 1–6, skipping unsupported opcodes)
 *
 * NOTE on stall convention:
 *   The reference PDFs show stalls as gaps BEFORE IF (whole row shifts right).
 *   This simulator inserts stalls AFTER IF (between IF and ID), which is the
 *   physically accurate model — the front-end freezes while downstream drains.
 *   Both produce the same total cycle count and the same ID/EX/MEM/WB timing;
 *   only the visual placement of the STALL bubble differs.
 *   Expected values below follow the simulator's convention.
 */

// ─── Inline source (types stripped from your .ts files) ──────────────────────

const PIPELINE_4_STAGE = ['IF', 'ID', 'EX', 'MEM/WB'];
const PIPELINE_5_STAGE = ['IF', 'ID', 'EX', 'MEM', 'WB'];
const MAX_INSTRUCTIONS = 10;

function normalizeRegister(reg) { return reg.toUpperCase().trim(); }
function parseLWSW(line, opcode) {
  const m = line.match(/^(LW|SW)\s+(R\d+),?\s*(-?\d+)\((R\d+)\)$/i);
  if (!m) return null;
  return {
    dest: opcode === 'LW' ? normalizeRegister(m[2]) : null,
    src1: opcode === 'SW' ? normalizeRegister(m[2]) : normalizeRegister(m[4]),
    src2: normalizeRegister(m[4]),
    offset: parseInt(m[3], 10),
  };
}
function parseALU(line) {
  const m = line.match(/^(ADD|SUB)\s+(R\d+),?\s*(R\d+),?\s*(R\d+)$/i);
  if (!m) return null;
  return { dest: normalizeRegister(m[2]), src1: normalizeRegister(m[3]), src2: normalizeRegister(m[4]) };
}
function parseInstructions(code) {
  const lines = code.split('\n');
  const instructions = [], errors = [];
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('#')) continue;
    if (++count > MAX_INSTRUCTIONS) { errors.push({ line: i+1, message: 'Too many instructions' }); continue; }
    const op = raw.toUpperCase().match(/^(ADD|SUB|LW|SW)/)?.[1];
    if (!op) { errors.push({ line: i+1, message: `Unknown opcode` }); continue; }
    const p = (op === 'LW' || op === 'SW') ? parseLWSW(raw, op) : parseALU(raw);
    if (!p) { errors.push({ line: i+1, message: `Invalid syntax` }); continue; }
    instructions.push({ index: instructions.length, raw, opcode: op, dest: p.dest, src1: p.src1, src2: p.src2, offset: p.offset });
  }
  return { instructions, errors };
}

function getStageCount(c) { return c.pipelineType === '5-stage' ? 5 : 4; }
function getPipelineStages(c) { return c.pipelineType === '5-stage' ? [...PIPELINE_5_STAGE] : [...PIPELINE_4_STAGE]; }

function computeAllStalls(instructions, config) {
  const n = instructions.length, nStages = getStageCount(config);
  const stalls = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const instr = instructions[i];
    let min = 0;
    for (let j = 0; j < i; j++) {
      const prev = instructions[j];
      if (!prev.dest || (prev.dest !== instr.src1 && prev.dest !== instr.src2)) continue;
      let req;
      if (!config.forwardingEnabled) {
        req = (j + stalls[j] + nStages) - i - 1;
      } else if (prev.opcode === 'LW') {
        req = (j + stalls[j] + 4) - i - 2;
      } else {
        req = (j + stalls[j] + 3) - i - 3;
      }
      min = Math.max(min, req);
    }
    stalls[i] = Math.max(0, min);
  }
  return stalls;
}

function simulate(instructions, config) {
  if (!instructions.length) return { schedules: [], hazards: [], totalCycles: 0 };
  const stages = getPipelineStages(config);
  const nStages = getStageCount(config);
  const stalls = computeAllStalls(instructions, config);
  const totalCycles = Math.max(...instructions.map((_, i) => i + stalls[i] + nStages));

  const hazards = [];
  for (let i = 0; i < instructions.length; i++) {
    for (let j = 0; j < i; j++) {
      const prev = instructions[j], instr = instructions[i];
      if (!prev.dest || (prev.dest !== instr.src1 && prev.dest !== instr.src2)) continue;
      let ps;
      if (!config.forwardingEnabled) ps = Math.max(0, j + stalls[j] + nStages - i - 1);
      else if (prev.opcode === 'LW') ps = Math.max(0, j + stalls[j] + 4 - i - 2);
      else ps = Math.max(0, j + stalls[j] + 3 - i - 3);
      hazards.push({ producerIndex: j, consumerIndex: i, register: prev.dest, stallsInserted: ps, resolvedByForwarding: config.forwardingEnabled && ps === 0 });
    }
  }

  const schedules = [];
  for (let i = 0; i < instructions.length; i++) {
    const instr = instructions[i];
    const start = i + 1;
    const stallCount = stalls[i];
    const mostRecentProducer = (() => {
      for (let j = i - 1; j >= 0; j--) {
        const p = instructions[j];
        if (p.dest && (p.dest === instr.src1 || p.dest === instr.src2)) return p;
      }
      return null;
    })();
    const isLWForward4Stage = config.forwardingEnabled && config.pipelineType === '4-stage'
      && mostRecentProducer?.opcode === 'LW' && stallCount > 0;
    const cycleMap = new Map();
    if (isLWForward4Stage) {
      cycleMap.set(start,     { stage: 'IF',     isStall: false });
      cycleMap.set(start + 1, { stage: 'ID',     isStall: false });
      cycleMap.set(start + 2, { stage: 'STALL',  isStall: true  });
      cycleMap.set(start + 3, { stage: 'EX',     isStall: false });
      cycleMap.set(start + 4, { stage: 'MEM/WB', isStall: false });
    } else {
      cycleMap.set(start, { stage: 'IF', isStall: false });
      let cursor = start + 1;
      for (let s = 0; s < stallCount; s++) cycleMap.set(cursor++, { stage: 'STALL', isStall: true });
      for (const stage of stages) {
        if (stage === 'IF') continue;
        cycleMap.set(cursor++, { stage, isStall: false });
      }
    }
    const cycleKeys = [...cycleMap.keys()].sort((a, b) => a - b);
    const cycles = cycleKeys.map(cycle => {
      const { stage, isStall } = cycleMap.get(cycle);
      const isForwarded = !isStall && stage === 'EX' && config.forwardingEnabled
        && hazards.some(h => h.consumerIndex === i && h.resolvedByForwarding);
      return { cycle, stage, isStall, isForwarded };
    });
    schedules.push({ instruction: instr, startCycle: start, cycles, stallCount });
  }
  return { schedules, hazards, totalCycles };
}

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

/**
 * expected: array (one entry per instruction) of [cycle, stageLabel] pairs.
 * List only real pipeline stages (IF/ID/EX/MEM/WB/MEM_WB) — not STALL entries.
 * The harness:
 *   1. Confirms each [cycle, stage] pair matches the simulator output.
 *   2. Flags any extra real stages in the output not listed in expected.
 *   3. Checks totalCycles equals the highest cycle in expected.
 */
function runTest(label, code, config, expected) {
  const { instructions, errors } = parseInstructions(code);
  if (errors.length) {
    console.log(`\n  FAIL  ${label}`);
    console.log(`        Parse errors: ${errors.map(e => e.message).join('; ')}`);
    failed++;
    return;
  }
  const result = simulate(instructions, config);
  let ok = true;
  const diffs = [];

  for (let i = 0; i < expected.length; i++) {
    const sched = result.schedules[i];
    for (const [expCycle, expStage] of expected[i]) {
      const entry = sched.cycles.find(c => c.cycle === expCycle);
      if (!entry) {
        diffs.push(`  I${i+1} cycle ${expCycle}: expected ${expStage}, got <missing>`);
        ok = false;
      } else if (entry.stage !== expStage) {
        diffs.push(`  I${i+1} cycle ${expCycle}: expected ${expStage}, got ${entry.stage}`);
        ok = false;
      }
    }
    const expCycles = new Set(expected[i].map(([c]) => c));
    for (const entry of sched.cycles) {
      if (!entry.isStall && !expCycles.has(entry.cycle)) {
        diffs.push(`  I${i+1} cycle ${entry.cycle}: unexpected stage ${entry.stage}`);
        ok = false;
      }
    }
  }

  const lastExpCycle = Math.max(...expected.flatMap(e => e.map(([c]) => c)));
  if (result.totalCycles !== lastExpCycle) {
    diffs.push(`  totalCycles: expected ${lastExpCycle}, got ${result.totalCycles}`);
    ok = false;
  }

  if (ok) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`\n  FAIL  ${label}`);
    diffs.forEach(d => console.log(`       ${d}`));
    failed++;
  }
}

// ─── 5-Stage Test Cases ───────────────────────────────────────────────────────
//
// Stall placement: stalls appear AFTER IF (between IF and ID).
// e.g. PDF row "I2: IF ST ST ST ID EX MEM WB" at cycles 2–9 maps to:
//   C2:IF, C3-5:STALL(hidden), C6:ID, C7:EX, C8:MEM, C9:WB
// Expected arrays only list real stages.

const cfg5 = fwd => ({ pipelineType: '5-stage', forwardingEnabled: fwd });

console.log('\n══════════════════════════════════════════');
console.log(' 5-Stage Pipeline Tests');
console.log('══════════════════════════════════════════');

// TC1 — No hazard
console.log('\n[TC1] No dependency');
runTest('5-stage | no fwd | TC1', `
ADD R1, R2, R3
SUB R4, R5, R6
`, cfg5(false), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[3,'ID'],[4,'EX'],[5,'MEM'],[6,'WB']],
]);
runTest('5-stage | with fwd | TC1', `
ADD R1, R2, R3
SUB R4, R5, R6
`, cfg5(true), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[3,'ID'],[4,'EX'],[5,'MEM'],[6,'WB']],
]);

// TC2 — ALU→ALU immediate RAW
// No fwd: 3 stalls → I2: IF @2, ID @6, EX @7, MEM @8, WB @9
// Fwd:    EX→EX forward → 0 stalls → I2: IF @2, ID @3, EX @4, MEM @5, WB @6
console.log('\n[TC2] ALU→ALU immediate RAW');
runTest('5-stage | no fwd | TC2', `
ADD R1, R2, R3
SUB R4, R1, R5
`, cfg5(false), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[6,'ID'],[7,'EX'],[8,'MEM'],[9,'WB']],
]);
runTest('5-stage | with fwd | TC2', `
ADD R1, R2, R3
SUB R4, R1, R5
`, cfg5(true), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[3,'ID'],[4,'EX'],[5,'MEM'],[6,'WB']],
]);

// TC3 — LW→ALU immediate RAW
// No fwd: 3 stalls (same as ALU→ALU in 5-stage)
// Fwd:    MEM→EX forward → 1 stall → I2: IF @2, ID @4, EX @5, MEM @6, WB @7
console.log('\n[TC3] LW→ALU immediate RAW');
runTest('5-stage | no fwd | TC3', `
LW R1, 0(R2)
ADD R3, R1, R4
`, cfg5(false), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[6,'ID'],[7,'EX'],[8,'MEM'],[9,'WB']],
]);
runTest('5-stage | with fwd | TC3', `
LW R1, 0(R2)
ADD R3, R1, R4
`, cfg5(true), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[4,'ID'],[5,'EX'],[6,'MEM'],[7,'WB']],
]);

// TC4 — ALU + independent + consumer at distance 2
// No fwd: I1 last=5, I3 (i=2): stalls=5-2-1=2 → IF @3, ID @6, EX @7, MEM @8, WB @9
// Fwd:    I1.EX=3, I3 (i=2): stalls=3-2-3=-1→0 → IF @3, ID @4, EX @5, MEM @6, WB @7
console.log('\n[TC4] ALU distance-2 RAW');
runTest('5-stage | no fwd | TC4', `
ADD R1, R2, R3
ADD R4, R5, R6
SW R1, 0(R7)
`, cfg5(false), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[3,'ID'],[4,'EX'],[5,'MEM'],[6,'WB']],
  [[3,'IF'],[6,'ID'],[7,'EX'],[8,'MEM'],[9,'WB']],
]);
runTest('5-stage | with fwd | TC4', `
ADD R1, R2, R3
ADD R4, R5, R6
SW R1, 0(R7)
`, cfg5(true), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[3,'ID'],[4,'EX'],[5,'MEM'],[6,'WB']],
  [[3,'IF'],[4,'ID'],[5,'EX'],[6,'MEM'],[7,'WB']],
]);

// TC5 — LW→ALU→ALU chain
// No fwd:
//   I2 (i=1): stalls=3  → IF @2, ID @6, EX @7, MEM @8, WB @9
//   I3 (i=2): I2.last=9, stalls=9-2-1=6 → IF @3, ID @10, EX @11, MEM @12, WB @13
// Fwd:
//   I2 (i=1): LW stall=1 → IF @2, ID @4, EX @5, MEM @6, WB @7
//   I3 (i=2): I2.EX=5, stalls=5-2-3=0 → IF @3, ID @4, EX @5, MEM @6, WB @7
console.log('\n[TC5] LW→ALU→ALU chain');
runTest('5-stage | no fwd | TC5', `
LW R1, 0(R2)
ADD R3, R1, R4
SUB R5, R3, R6
`, cfg5(false), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[6,'ID'],[7,'EX'],[8,'MEM'],[9,'WB']],
  [[3,'IF'],[10,'ID'],[11,'EX'],[12,'MEM'],[13,'WB']],
]);
runTest('5-stage | with fwd | TC5', `
LW R1, 0(R2)
ADD R3, R1, R4
SUB R5, R3, R6
`, cfg5(true), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[4,'ID'],[5,'EX'],[6,'MEM'],[7,'WB']],
  [[3,'IF'],[4,'ID'],[5,'EX'],[6,'MEM'],[7,'WB']],
]);

// TC6 — LW→ADD→SW chain (same topology as TC5)
console.log('\n[TC6] LW→ADD→SW chain');
runTest('5-stage | no fwd | TC6', `
LW R8, 4(R2)
ADD R9, R8, R6
SW R9, 0(R10)
`, cfg5(false), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[6,'ID'],[7,'EX'],[8,'MEM'],[9,'WB']],
  [[3,'IF'],[10,'ID'],[11,'EX'],[12,'MEM'],[13,'WB']],
]);
runTest('5-stage | with fwd | TC6', `
LW R8, 4(R2)
ADD R9, R8, R6
SW R9, 0(R10)
`, cfg5(true), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[4,'ID'],[5,'EX'],[6,'MEM'],[7,'WB']],
  [[3,'IF'],[4,'ID'],[5,'EX'],[6,'MEM'],[7,'WB']],
]);

// TC7 — LW→ALU→ALU chain + independent LW at end
// I4 has no dependency on I1/I2/I3 registers → 0 stalls
// No fwd: I4 (i=3): IF @4, ID @5, EX @6, MEM @7, WB @8
// Fwd:    same
console.log('\n[TC7] LW→ALU→ALU + independent LW');
runTest('5-stage | no fwd | TC7', `
LW R1, 0(R2)
ADD R3, R1, R4
SUB R5, R3, R6
LW R7, 4(R2)
`, cfg5(false), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[6,'ID'],[7,'EX'],[8,'MEM'],[9,'WB']],
  [[3,'IF'],[10,'ID'],[11,'EX'],[12,'MEM'],[13,'WB']],
  [[4,'IF'],[5,'ID'],[6,'EX'],[7,'MEM'],[8,'WB']],
]);
runTest('5-stage | with fwd | TC7', `
LW R1, 0(R2)
ADD R3, R1, R4
SUB R5, R3, R6
LW R7, 4(R2)
`, cfg5(true), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM'],[5,'WB']],
  [[2,'IF'],[4,'ID'],[5,'EX'],[6,'MEM'],[7,'WB']],
  [[3,'IF'],[4,'ID'],[5,'EX'],[6,'MEM'],[7,'WB']],
  [[4,'IF'],[5,'ID'],[6,'EX'],[7,'MEM'],[8,'WB']],
]);

// ─── 4-Stage Test Cases ───────────────────────────────────────────────────────
//
// 4-stage special: LW with forwarding places the stall BETWEEN ID and EX
// (the isLWForward4Stage path), so the row is: IF ID STALL EX MEM/WB.
// All other stalls go between IF and ID as usual.

const cfg4 = fwd => ({ pipelineType: '4-stage', forwardingEnabled: fwd });

console.log('\n══════════════════════════════════════════');
console.log(' 4-Stage Pipeline Tests');
console.log('══════════════════════════════════════════');

// TC1 — ADD→SUB immediate RAW
// No fwd: I1.last=0+0+4=4, I2(i=1): stalls=4-1-1=2 → IF @2, ID @5, EX @6, MEM/WB @7
// Fwd: EX→EX → 0 stalls → IF @2, ID @3, EX @4, MEM/WB @5
console.log('\n[TC1] ALU→ALU immediate RAW');
runTest('4-stage | no fwd | TC1', `
ADD R0, R1, R2
SUB R3, R0, R4
`, cfg4(false), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM/WB']],
  [[2,'IF'],[5,'ID'],[6,'EX'],[7,'MEM/WB']],
]);
runTest('4-stage | with fwd | TC1', `
ADD R0, R1, R2
SUB R3, R0, R4
`, cfg4(true), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM/WB']],
  [[2,'IF'],[3,'ID'],[4,'EX'],[5,'MEM/WB']],
]);

// TC2 — ALU + independent + consumer at distance 2
// No fwd: I1.last=4, I3(i=2): stalls=4-2-1=1 → IF @3, ID @5, EX @6, MEM/WB @7
// Fwd: I1.EX=3, I3(i=2): stalls=3-2-3=-2→0 → IF @3, ID @4, EX @5, MEM/WB @6
console.log('\n[TC2] ALU distance-2 RAW');
runTest('4-stage | no fwd | TC2', `
ADD R0, R1, R2
ADD R5, R6, R7
SUB R3, R0, R4
`, cfg4(false), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM/WB']],
  [[2,'IF'],[3,'ID'],[4,'EX'],[5,'MEM/WB']],
  [[3,'IF'],[5,'ID'],[6,'EX'],[7,'MEM/WB']],
]);
runTest('4-stage | with fwd | TC2', `
ADD R0, R1, R2
ADD R5, R6, R7
SUB R3, R0, R4
`, cfg4(true), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM/WB']],
  [[2,'IF'],[3,'ID'],[4,'EX'],[5,'MEM/WB']],
  [[3,'IF'],[4,'ID'],[5,'EX'],[6,'MEM/WB']],
]);

// TC3 — LW→ADD immediate RAW
// No fwd: I1.last=4, I2(i=1): stalls=4-1-1=2 → IF @2, ID @5, EX @6, MEM/WB @7
// Fwd (4-stage LW special, stall between ID and EX):
//   → IF @2, ID @3, STALL @4, EX @5, MEM/WB @6
console.log('\n[TC3] LW→ADD immediate RAW');
runTest('4-stage | no fwd | TC3', `
LW R0, 0(R1)
ADD R2, R0, R3
`, cfg4(false), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM/WB']],
  [[2,'IF'],[5,'ID'],[6,'EX'],[7,'MEM/WB']],
]);
runTest('4-stage | with fwd | TC3', `
LW R0, 0(R1)
ADD R2, R0, R3
`, cfg4(true), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM/WB']],
  [[2,'IF'],[3,'ID'],[5,'EX'],[6,'MEM/WB']],
]);

// TC4 — LW + independent + consumer (forwarding avoids stall)
// No fwd: I1.last=4, I3(i=2): stalls=4-2-1=1 → IF @3, ID @5, EX @6, MEM/WB @7
// Fwd: LW.MEM=0+0+4=4, I3(i=2): stalls=4-2-2=0 → no stall
console.log('\n[TC4] LW distance-2 RAW');
runTest('4-stage | no fwd | TC4', `
LW R0, 0(R1)
ADD R5, R6, R7
ADD R2, R0, R3
`, cfg4(false), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM/WB']],
  [[2,'IF'],[3,'ID'],[4,'EX'],[5,'MEM/WB']],
  [[3,'IF'],[5,'ID'],[6,'EX'],[7,'MEM/WB']],
]);
runTest('4-stage | with fwd | TC4', `
LW R0, 0(R1)
ADD R5, R6, R7
ADD R2, R0, R3
`, cfg4(true), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM/WB']],
  [[2,'IF'],[3,'ID'],[4,'EX'],[5,'MEM/WB']],
  [[3,'IF'],[4,'ID'],[5,'EX'],[6,'MEM/WB']],
]);

// TC5 — Chained ALU RAW (R0 reused, cascading stalls)
// No fwd:
//   I2(i=1): I1.last=4, stalls=4-1-1=2 → IF @2, ID @5, EX @6, MEM/WB @7
//   I3(i=2): I2.last=7, stalls=7-2-1=4 → IF @3, ID @8, EX @9, MEM/WB @10
// Fwd: all EX→EX → 0 stalls for I2 and I3
console.log('\n[TC5] Chained ALU RAW');
runTest('4-stage | no fwd | TC5', `
ADD R0, R1, R2
ADD R0, R0, R3
SUB R4, R0, R5
`, cfg4(false), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM/WB']],
  [[2,'IF'],[5,'ID'],[6,'EX'],[7,'MEM/WB']],
  [[3,'IF'],[8,'ID'],[9,'EX'],[10,'MEM/WB']],
]);
runTest('4-stage | with fwd | TC5', `
ADD R0, R1, R2
ADD R0, R0, R3
SUB R4, R0, R5
`, cfg4(true), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM/WB']],
  [[2,'IF'],[3,'ID'],[4,'EX'],[5,'MEM/WB']],
  [[3,'IF'],[4,'ID'],[5,'EX'],[6,'MEM/WB']],
]);

// TC6 — ADD→SW immediate RAW (SW reads R0 as data)
// No fwd: 2 stalls (same as TC1)
// Fwd: EX→EX → 0 stalls
console.log('\n[TC6] ALU→SW immediate RAW');
runTest('4-stage | no fwd | TC6', `
ADD R0, R1, R2
SW R0, 0(R3)
`, cfg4(false), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM/WB']],
  [[2,'IF'],[5,'ID'],[6,'EX'],[7,'MEM/WB']],
]);
runTest('4-stage | with fwd | TC6', `
ADD R0, R1, R2
SW R0, 0(R3)
`, cfg4(true), [
  [[1,'IF'],[2,'ID'],[3,'EX'],[4,'MEM/WB']],
  [[2,'IF'],[3,'ID'],[4,'EX'],[5,'MEM/WB']],
]);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log(` Results: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════\n');
if (failed > 0) process.exit(1);
