# CLAUDE.md — Pipeline Hazard Simulator

## Project Overview

Build an interactive **Pipeline Hazard Simulator** as a Next.js web app. The user types assembly instructions into a code editor, configures the pipeline, and watches the cycle-by-cycle execution table populate with stage labels, stalls, and forwarding info.

**Stack**: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, CodeMirror 6.
**Theme**: Space / orbital deck aesthetic — dark background, clean monospace feel.

---

## Project Constants (Single Source of Truth)

All tunable limits live in one file: `lib/constants.ts`. Never hardcode these values anywhere else — always import from here.

```ts
// lib/constants.ts
export const MAX_INSTRUCTIONS = 10;        // Max instructions per simulation (excluding comments/blank lines)
export const MAX_REGISTERS = 32;           // R0–R31
export const SUPPORTED_OPCODES = ['ADD', 'SUB', 'LW', 'SW'] as const;
export const PIPELINE_4_STAGE = ['IF', 'ID', 'EX', 'MEM/WB'] as const;
export const PIPELINE_5_STAGE = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const;
```

---

## File Structure

```
app/
  page.tsx                  # Main page layout (editor left, config+table right)
  layout.tsx                # Root layout with space theme
  globals.css

components/
  Editor/
    AssemblyEditor.tsx       # CodeMirror 6 editor with syntax highlight + validation
    editorExtensions.ts      # CodeMirror language definition, highlighter, linter
  Pipeline/
    PipelineConfig.tsx       # Pipeline type selector + forwarding toggle
    PipelineTable.tsx        # Cycle-by-cycle grid visualization
    HazardPanel.tsx          # List of detected RAW hazards
  Controls/
    SimulationControls.tsx   # Step / Run / Reset buttons

lib/
  constants.ts              # ALL magic numbers and config (single source of truth)
  types.ts                  # Shared TypeScript types
  parser.ts                 # Instruction parser and validator
  simulator.ts              # Core simulation logic (pure functions)
```

---

## Types (`lib/types.ts`)

```ts
export type Opcode = 'ADD' | 'SUB' | 'LW' | 'SW';

export type Instruction = {
  index: number;            // 0-based position in program
  raw: string;              // original line text
  opcode: Opcode;
  dest: string | null;      // null for SW (no destination register)
  src1: string;
  src2: string;             // for LW/SW this is the base register
  offset?: number;          // only for LW/SW
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
  isForwarded: boolean;     // true if this stage benefited from forwarding
};

export type InstructionSchedule = {
  instruction: Instruction;
  cycles: CycleEntry[];     // ordered list of cycle entries for this instruction
  startCycle: number;       // cycle when IF begins
};

export type Hazard = {
  producerIndex: number;    // instruction index that writes the register
  consumerIndex: number;    // instruction index that reads it
  register: string;         // the conflicting register
  stallsInserted: number;   // how many stalls were needed
  resolvedByForwarding: boolean;
};

export type SimulationResult = {
  schedules: InstructionSchedule[];
  hazards: Hazard[];
  totalCycles: number;
};

export type ParseError = {
  line: number;             // 1-based
  message: string;
};

export type ParseResult = {
  instructions: Instruction[];
  errors: ParseError[];
};
```

---

## Instruction Format

### Syntax Rules

| Instruction | Format | Example |
|---|---|---|
| ADD | `ADD Rd, Rs1, Rs2` | `ADD R1, R2, R3` |
| SUB | `SUB Rd, Rs1, Rs2` | `SUB R4, R1, R5` |
| LW | `LW Rd, offset(Rb)` | `LW R1, 0(R2)` |
| SW | `SW Rs, offset(Rb)` | `SW R3, 4(R1)` |

- Registers: `R0`–`R31` (case-insensitive, normalize to uppercase)
- Offset: integer (can be negative), e.g. `-4`, `0`, `8`
- Comments: lines starting with `#` are ignored entirely
- Blank lines are ignored
- Max `MAX_INSTRUCTIONS` non-comment, non-blank lines (import from `constants.ts`)

### Parser (`lib/parser.ts`)

The parser processes code line by line and returns a `ParseResult`. It must:
- Skip comment lines (`#...`) and blank lines
- Reject unknown opcodes with a clear message: `"Unknown opcode 'XYZ'. Supported: ADD, SUB, LW, SW"`
- Reject invalid register format: `"Invalid register 'RXX'. Use R0–R31"`
- Reject wrong operand count per opcode
- Reject invalid LW/SW syntax if `offset(base)` format is wrong
- Reject if instruction count exceeds `MAX_INSTRUCTIONS`: `"Max MAX_INSTRUCTIONS instructions allowed (excluding comments)"`
- Return all errors found (not just the first one)

---

## Simulation Logic (`lib/simulator.ts`)

All functions are **pure** — no side effects, no globals. Takes instructions + config, returns `SimulationResult`.

### Register Tracking

- `ADD Rd, Rs1, Rs2` → dest = `Rd`, sources = `[Rs1, Rs2]`
- `SUB Rd, Rs1, Rs2` → dest = `Rd`, sources = `[Rs1, Rs2]`
- `LW Rd, offset(Rb)` → dest = `Rd`, sources = `[Rb]`
- `SW Rs, offset(Rb)` → dest = `null`, sources = `[Rs, Rb]`

### RAW Hazard Detection

For each instruction `Ij` (j > 0), check all prior instructions `Ii` (i < j):
- A RAW hazard exists if `dest(Ii) !== null` AND `dest(Ii) ∈ sources(Ij)`
- Only the **most recent** producer matters for stall calculation (closest `i` to `j`)

### Stall Calculation — No Forwarding

The rule: the consumer's **ID stage** needs the value. The producer makes the value available **after WB**.

**5-stage pipeline** (IF=1, ID=2, EX=3, MEM=4, WB=5):
- Producer writes at end of its WB cycle.
- Consumer reads at its ID cycle.
- Stalls inserted = max(0, `producer_WB_cycle - consumer_ID_cycle_if_no_stall`)

For back-to-back instructions (j = i+1): **2 stalls**
For one instruction apart (j = i+2): **1 stall**
For two or more apart (j >= i+3): **0 stalls**

**4-stage pipeline** (IF=1, ID=2, EX=3, MEM/WB=4):
- Producer writes at end of its MEM/WB cycle.
- For back-to-back instructions: **1 stall**
- For one or more apart: **0 stalls**

### Stall Calculation — With Forwarding

**5-stage, ALU→ALU (ADD/SUB producing for ADD/SUB):**
- Forward EX→EX: value available end of producer's EX, used at start of consumer's EX.
- Back-to-back: **0 stalls**
- Any distance: **0 stalls**

**5-stage, LW→ALU (load-use hazard):**
- LW value only available after MEM stage. Consumer needs it at EX.
- Back-to-back (j = i+1): **1 stall** (unavoidable even with forwarding)
- One apart (j = i+2): **0 stalls**

**4-stage, ALU→ALU:**
- Forward EX→MEM/WB input: back-to-back: **0 stalls**

**4-stage, LW→ALU:**
- Back-to-back: **1 stall**
- One apart: **0 stalls**

### Scheduling Algorithm

```
current_cycle = 1
for each instruction Ij in order:
  earliest_start = current_cycle  // when IF can begin
  
  for each prior instruction Ii that has a RAW dependency on Ij:
    required_stalls = compute_stalls(Ii, Ij, config)
    earliest_start = max(earliest_start, Ii.start_cycle + required_stalls + 1)
  
  Ij.start_cycle = earliest_start
  current_cycle = earliest_start + 1  // next instruction enters pipeline one cycle later (in-order)
```

Then build `CycleEntry[]` for each instruction by walking from `start_cycle` through each stage sequentially, inserting STALL entries where the instruction is blocked.

### Hazard Record

For every RAW dependency found, record a `Hazard` object with producer index, consumer index, register name, stalls inserted, and whether forwarding resolved it (stalls = 0 due to forwarding).

---

## Pipeline Table Rendering (`components/Pipeline/PipelineTable.tsx`)

- Rows = instructions (labeled I1, I2, ... with raw text as tooltip)
- Columns = cycle numbers (1 through `totalCycles`)
- Each cell:
  - **Stage name** (IF, ID, EX, etc.) → neutral color (blue-ish)
  - **STALL** → red/amber background
  - **Stage with forwarding** → green tint + small arrow icon or "↓" indicator
  - **Empty** → visually distinct empty (dark bg), never ambiguous
- Table should scroll horizontally if cycles exceed viewport

---

## UI Layout (`app/page.tsx`)

```
┌─────────────────────────────────────────────────────────┐
│  Header: "Plaksha Orbital Pipeline Deck"                 │
├───────────────────────┬─────────────────────────────────┤
│  Assembly Editor      │  Pipeline Config                 │
│  (CodeMirror)         │  [4-stage / 5-stage toggle]      │
│                       │  [Forwarding on/off toggle]      │
│  Error panel          ├─────────────────────────────────┤
│  (below editor)       │  Controls: Step | Run | Reset    │
│                       ├─────────────────────────────────┤
│                       │  Pipeline Table (scrollable)     │
│                       ├─────────────────────────────────┤
│                       │  Hazard Panel                    │
└───────────────────────┴─────────────────────────────────┘
```

---

## CodeMirror Editor (`components/Editor/`)

Use **CodeMirror 6** (`@codemirror/view`, `@codemirror/state`, `@codemirror/language`, `@codemirror/lint`).

### Syntax Highlighting
- Opcodes (`ADD`, `SUB`, `LW`, `SW`) → keyword color (purple/cyan)
- Registers (`R0`–`R31`) → variable color (yellow/green)
- Numbers and offsets → number color
- Comments (`#...`) → dimmed/italic

### Real-time Linting
- Wire the `parser.ts` output into CodeMirror's linter extension
- Each `ParseError` becomes a CodeMirror `Diagnostic` with `severity: 'error'`
- Red underline on the offending line + gutter dot
- Linter runs on every editor change (debounced ~300ms)

### Editor Config
- Dark theme (matching space aesthetic)
- Line numbers on
- Placeholder text with a sample program:
```
# Example program
ADD R1, R2, R3
LW R4, 0(R1)
SUB R5, R4, R1
```

---

## Simulation Controls

- **Run** button: disabled if any parse errors exist. Runs full simulation and renders complete table.
- **Step** button: disabled if parse errors. Advances simulation one cycle at a time, highlighting the current cycle column.
- **Reset** button: always enabled. Clears simulation state, keeps editor content and config.

State machine: `idle → running (step or full) → complete → idle (on reset)`

---

## Hazard Panel (`components/Pipeline/HazardPanel.tsx`)

Lists all detected `Hazard` objects as readable sentences:

> **RAW Hazard**: I2 (`SUB R5, R4, R1`) depends on I1 (`LW R4, 0(R1)`) via **R4** — 1 stall inserted.

> **RAW Hazard (resolved by forwarding)**: I2 (`SUB R5, R1, R3`) depends on I1 (`ADD R1, R2, R3`) via **R1** — forwarded, no stalls.

If no hazards: show "No hazards detected — all instructions are independent."

---

## Explicit Exclusions

Do **not** implement any of the following:
- WAR (Write After Read) hazards
- WAW (Write After Write) hazards
- Branch or jump instructions
- Structural hazards
- Cache simulation
- Out-of-order execution
- Multi-cycle functional units
- Superscalar issue

---

## Self-Verification Test Cases

Before considering the simulator correct, verify these three cases manually:

### Test 1 — No Dependencies (5-stage, no forwarding)
```
ADD R1, R2, R3
ADD R4, R5, R6
ADD R7, R8, R9
```
Expected: All three start on consecutive cycles, no stalls, no hazards.

### Test 2 — Back-to-back RAW, ALU→ALU (5-stage, no forwarding)
```
ADD R1, R2, R3
SUB R4, R1, R5
```
Expected: I2 stalls for **2 cycles** before its EX stage. Hazard panel shows RAW on R1.

### Test 3 — Load-Use (5-stage, with forwarding)
```
LW R1, 0(R2)
ADD R3, R1, R4
```
Expected: Even with forwarding, I2 stalls for **1 cycle** (load-use penalty). Hazard panel notes it as forwarded but with 1 stall remaining.

### Test 4 — Back-to-back RAW, ALU→ALU (5-stage, with forwarding)
```
ADD R1, R2, R3
SUB R4, R1, R5
```
Expected: **0 stalls** — forwarding eliminates the hazard entirely.

### Test 5 — Back-to-back RAW (4-stage, no forwarding)
```
ADD R1, R2, R3
SUB R4, R1, R5
```
Expected: I2 stalls for **1 cycle**. (One fewer than 5-stage because MEM/WB is combined.)

---

## Development Notes

- Run dev server: `npm run dev`
- All simulation logic in `lib/simulator.ts` must be independently testable (pure functions, no React deps)
- Import `MAX_INSTRUCTIONS` and all other constants exclusively from `lib/constants.ts`
- Tailwind dark mode is `class` strategy; root layout sets `dark` class on `<html>`
- shadcn/ui components to use: `Button`, `Toggle`, `Card`, `Badge`, `Tooltip`, `ScrollArea`
