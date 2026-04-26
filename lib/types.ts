export type Opcode = 'ADD' | 'SUB' | 'LW' | 'SW';

export type Instruction = {
  index: number;
  raw: string;
  opcode: Opcode;
  dest: string | null;
  src1: string;
  src2: string;
  offset?: number;
};

export type PipelineType = '4-stage' | '5-stage';

export type SimConfig = {
  pipelineType: PipelineType;
  forwardingEnabled: boolean;
};

export type StageLabel = 'IF' | 'ID' | 'EX' | 'MEM' | 'WB' | 'MEM/WB' | 'STALL' | 'FWD';

export type CycleEntry = {
  cycle: number;
  stage: StageLabel;
  isStall: boolean;
  isForwarded: boolean;
};

export type InstructionSchedule = {
  instruction: Instruction;
  cycles: CycleEntry[];
  startCycle: number;
};

export type Hazard = {
  producerIndex: number;
  consumerIndex: number;
  register: string;
  stallsInserted: number;
  resolvedByForwarding: boolean;
};

export type StallDetail = {
  instructionIndex: number;
  cycle: number;
  causedByProducers: number[];
  registers: string[];
};

export type ForwardingDetail = {
  producerIndex: number;
  consumerIndex: number;
  register: string;
  fromStage: StageLabel;
  toStage: StageLabel;
  fromCycle: number;
  toCycle: number;
  isLoadUseForwarding: boolean;
};

export type SimulationResult = {
  schedules: InstructionSchedule[];
  hazards: Hazard[];
  totalCycles: number;
  stallDetails: StallDetail[];
  forwardingDetails: ForwardingDetail[];
};

export type ParseError = {
  line: number;
  message: string;
};

export type ParseResult = {
  instructions: Instruction[];
  errors: ParseError[];
};
