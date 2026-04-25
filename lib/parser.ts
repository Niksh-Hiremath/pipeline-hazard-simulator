import { MAX_INSTRUCTIONS, SUPPORTED_OPCODES } from './constants';
import type { Instruction, Opcode, ParseError, ParseResult } from './types';

function normalizeRegister(reg: string): string {
  return reg.toUpperCase().trim();
}

function isValidRegister(reg: string): boolean {
  const match = reg.toUpperCase().trim().match(/^R(\d+)$/);
  if (!match) return false;
  const num = parseInt(match[1], 10);
  return num >= 0 && num <= 31;
}

function parseRegister(reg: string): string {
  return normalizeRegister(reg);
}

function parseLWSW(line: string, opcode: 'LW' | 'SW'): { dest: string | null; src1: string; src2: string; offset?: number } | null {
  const match = line.match(/^(LW|SW)\s+(R\d+),?\s*(-?\d+)\((R\d+)\)$/i);
  if (!match) return null;
  return {
    dest: opcode === 'LW' ? parseRegister(match[2]) : null,
    src1: parseRegister(match[4]),
    src2: parseRegister(match[4]),
    offset: parseInt(match[3], 10),
  };
}

function parseALU(line: string): { dest: string | null; src1: string; src2: string } | null {
  const match = line.match(/^(ADD|SUB)\s+(R\d+),?\s*(R\d+),?\s*(R\d+)$/i);
  if (!match) return null;
  return {
    dest: parseRegister(match[2]),
    src1: parseRegister(match[3]),
    src2: parseRegister(match[4]),
  };
}

export function parseInstructions(code: string): ParseResult {
  const lines = code.split('\n');
  const instructions: Instruction[] = [];
  const errors: ParseError[] = [];
  let instructionCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i].trim();

    if (raw === '' || raw.startsWith('#')) {
      continue;
    }

    instructionCount++;
    if (instructionCount > MAX_INSTRUCTIONS) {
      errors.push({
        line: lineNum,
        message: `Max ${MAX_INSTRUCTIONS} instructions allowed (excluding comments)`,
      });
      continue;
    }

    const upperLine = raw.toUpperCase();
    const opcodeMatch = upperLine.match(/^(ADD|SUB|LW|SW)/);
    if (!opcodeMatch) {
      const unknownMatch = raw.match(/^(\w+)/);
      if (unknownMatch) {
        errors.push({
          line: lineNum,
          message: `Unknown opcode '${unknownMatch[1]}'. Supported: ${SUPPORTED_OPCODES.join(', ')}`,
        });
      } else {
        errors.push({ line: lineNum, message: `Invalid instruction format` });
      }
      continue;
    }

    const opcode = opcodeMatch[1] as Opcode;

    if (!SUPPORTED_OPCODES.includes(opcode)) {
      errors.push({
        line: lineNum,
        message: `Unknown opcode '${opcode}'. Supported: ${SUPPORTED_OPCODES.join(', ')}`,
      });
      continue;
    }

    let parsed: { dest: string | null; src1: string; src2: string; offset?: number } | null = null;

    if (opcode === 'LW' || opcode === 'SW') {
      parsed = parseLWSW(raw, opcode);
    } else {
      parsed = parseALU(raw);
    }

    if (!parsed) {
      if (opcode === 'LW' || opcode === 'SW') {
        errors.push({ line: lineNum, message: `Invalid LW/SW syntax. Use: ${opcode} Rd, offset(Rb)` });
      } else {
        errors.push({ line: lineNum, message: `Invalid ${opcode} syntax. Use: ${opcode} Rd, Rs1, Rs2` });
      }
      continue;
    }

    if (parsed.dest && !isValidRegister(parsed.dest)) {
      errors.push({ line: lineNum, message: `Invalid register '${parsed.dest}'. Use R0–R31` });
      continue;
    }

    if (!isValidRegister(parsed.src1)) {
      errors.push({ line: lineNum, message: `Invalid register '${parsed.src1}'. Use R0–R31` });
      continue;
    }

    if (!isValidRegister(parsed.src2)) {
      errors.push({ line: lineNum, message: `Invalid register '${parsed.src2}'. Use R0–R31` });
      continue;
    }

    instructions.push({
      index: instructions.length,
      raw,
      opcode,
      dest: parsed.dest,
      src1: parsed.src1,
      src2: parsed.src2,
      offset: parsed.offset,
    });
  }

  return { instructions, errors };
}
