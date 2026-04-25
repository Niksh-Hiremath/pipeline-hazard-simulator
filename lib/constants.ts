export const MAX_INSTRUCTIONS = 10;
export const MAX_REGISTERS = 32;
export const SUPPORTED_OPCODES = ['ADD', 'SUB', 'LW', 'SW'] as const;
export const PIPELINE_4_STAGE = ['IF', 'ID', 'EX', 'MEM/WB'] as const;
export const PIPELINE_5_STAGE = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const;
