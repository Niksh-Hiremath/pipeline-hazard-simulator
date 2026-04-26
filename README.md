# Pipeline Hazard Simulator

An interactive, animated web-based simulator for teaching pipeline hazards in processor design. Built for CS2011 — Fundamentals of Computer Architecture at Plaksha University.

![Pipeline Stage](https://img.shields.io/badge/Pipeline-5--stage-cyan)
![Next.js](https://img.shields.io/badge/Next.js-16.2.4-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Vitest](https://img.shields.io/badge/Tests-Vitest-green)

---

## What Is This?

Modern CPUs execute instructions in **stages** — fetch, decode, execute, memory, write-back. A **pipeline** lets them overlap these stages across many instructions like an assembly line. When one instruction depends on another in a way that breaks this overlap, you get a **hazard**.

This simulator lets you:

- Write MIPS-style assembly (`ADD`, `SUB`, `LW`, `SW`)
- Choose a **4-stage** (`IF → ID → EX → MEM/WB`) or **5-stage** (`IF → ID → EX → MEM → WB`) pipeline
- Toggle **data forwarding** on/off
- Step through each clock cycle and watch instructions flow (or stall) through the pipeline
- See exactly which registers caused each stall, and how forwarding resolves them

---

## Supported Instructions

| Opcode | Syntax | Description |
|--------|--------|-------------|
| `ADD` | `ADD Rd, Rs1, Rs2` | Rd = Rs1 + Rs2 |
| `SUB` | `SUB Rd, Rs1, Rs2` | Rd = Rs1 - Rs2 |
| `LW` | `LW Rd, offset(Rb)` | Rd = memory[Rb + offset] |
| `SW` | `SW Rd, offset(Rb)` | memory[Rb + offset] = Rd |

Registers are `R0` through `R31`.

---

## Pipeline Stages

### 5-Stage Pipeline
```
IF → ID → EX → MEM → WB
```

### 4-Stage Pipeline
```
IF → ID → EX → MEM/WB
```

---

## Hazard Types Visualized

### Data Hazards (RAW — Read After Write)

The most common hazard. Instruction B wants to read a register that instruction A hasn't written yet.

**Without forwarding** — the pipeline must **stall** (insert bubble cycles) until the producer completes:

```
Cycle:  1   2   3   4   5   6   7   8
Inst A: IF  ID  EX  MEM WB  --  --  --
Inst B: --  IF  STALL STALL ID  EX  MEM WB
```

**With forwarding** — data is forwarded directly from EX/MEM stage to a consumer's EX stage, eliminating most stalls:

```
Cycle:  1   2   3   4   5   6   7
Inst A: IF  ID  EX  MEM WB  --  --
Inst B: --  IF  ID  STALL EX  MEM WB
```

### Load-Use Hazard

A special case: `LW` produces its value at the **end** of MEM, so even with forwarding the next instruction needs **1 stall cycle** if it immediately uses that register.

---

## Project Structure

```
pipeline-hazard-sim/
├── app/
│   └── page.tsx                  # Main application page
├── components/
│   ├── Background/
│   │   └── StarfieldBg.tsx       # Animated space background
│   ├── Controls/
│   │   └── SimulationControls.tsx # Run/Step/Reset buttons
│   ├── Editor/
│   │   ├── AssemblyEditor.tsx     # CodeMirror-based assembly editor
│   │   └── editorExtensions.ts   # Editor extensions (syntax highlighting)
│   ├── Pipeline/
│   │   ├── ForwardingCourier.tsx  # Animated forwarding data arrow
│   │   ├── HazardPanel.tsx       # Hazard detection report
│   │   ├── HazardZapper.tsx      # Stall/hazard visual effect
│   │   ├── InstructionSprite.tsx  # Instruction chip traveling through stages
│   │   ├── PipelineConfig.tsx    # 4/5-stage and forwarding toggle
│   │   ├── PipelineTable.tsx     # Cycle-by-cycle execution table
│   │   ├── PipelineTrack.tsx     # Main pipeline stage visualization
│   │   └── RegisterVault.tsx     # Register state display
│   └── ui/                        # shadcn/ui component library
├── lib/
│   ├── constants.ts              # Pipeline stage definitions, opcodes
│   ├── parser.ts                 # Assembly → Instruction AST parser
│   ├── simulator.ts              # Core pipeline simulation engine
│   ├── types.ts                  # TypeScript type definitions
│   └── utils.ts                  # Utility functions
└── pipeline/
    ├── __init__.py               # Python module entry point
    ├── pipeline.py               # Python pipeline simulator (reference impl)
    └── test_pipeline.py          # Python test cases
```

---

## Getting Started

### Web App

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Python Simulator

```bash
cd pipeline
python test_pipeline.py
```

---

## Usage Guide

### Writing Assembly

The editor on the left accepts MIPS-style assembly. Lines starting with `#` are comments.

```asm
# Compute R1 = R2 + R3, then load from memory
ADD R1, R2, R3
LW R4, 0(R1)
SUB R5, R4, R1
```

### Running the Simulation

| Control | Action |
|---------|--------|
| **Run** (or `Enter`) | Auto-step through all cycles |
| **Step** (or `Space`) | Advance one cycle |
| **Prev** (or `←`) | Go back one cycle |
| **Reset** (or `Esc`) | Clear the simulation |

### Configuration

| Setting | Description |
|---------|-------------|
| **Pipeline Type** | 4-stage (`IF ID EX MEM/WB`) or 5-stage (`IF ID EX MEM WB`) |
| **Forwarding** | Toggle data forwarding on/off |

---

## How the Simulator Works

### Stall Formula

**Without forwarding** — a consumer at distance `dist` from a producer needs:

```
stalls_needed = max(0, base − dist + 1)

where base = 3 (5-stage) or 2 (4-stage)
```

**With forwarding** — ALU operations forward in time (0 stalls). Load instructions need 1 stall when adjacent:

```
if producer is LW:  stalls_needed = max(0, 1 − dist + 1)
else:               stalls_needed = 0
```

### Issue Cycle Cascade

Each instruction's entry cycle is computed sequentially:

```
issue_cycle[i] = issue_cycle[i−1] + 1 + stalls_for_instruction[i−1]
```

This models in-order issue — each instruction enters IF only after the previous one has cleared its stalls.

### Forwarding Detection

When forwarding is enabled, the simulator tracks each instruction's destination register. If a later instruction reads that register and the producer is within 2 instructions ahead, a forwarding path is recorded (EX→EX for ALU ops, MEM→EX for loads).

---

## Test Cases

The Python reference implementation (`pipeline/pipeline.py`) is validated against hand-computed expected outputs for:

- 4-stage pipeline, no forwarding (4W)
- 4-stage pipeline, with forwarding (4F)
- 5-stage pipeline, no forwarding (5W)
- 5-stage pipeline, with forwarding (5F)

Test scenarios include:

| Scenario | What It Tests |
|----------|---------------|
| `ADD R0, R1, R2` then `SUB R3, R0, R4` | 2-instruction RAW hazard |
| `ADD R0, R1, R2` then `ADD R5, R6, R7` then `SUB R3, R0, R4` | 3-instruction with no hazard on 2nd |
| `LW R0, 0(R1)` then `ADD R2, R0, R3` | Load-use hazard |
| `ADD R0, R1, R2` then `ADD R0, R0, R3` then `SUB R4, R0, R5` | Self-dependent register |

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com)
- **Editor**: [CodeMirror 6](https://codemirror.net) with custom assembly highlighting
- **Icons**: [Lucide React](https://lucide.dev)
- **Animation**: CSS transitions + keyframe animations
- **Testing**: [Vitest](https://vitest.dev)
- **Python Backend**: `pipeline/pipeline.py` (reference simulator)

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Step forward one cycle |
| `←` | Step backward one cycle |
| `Enter` | Start auto-run |
| `Esc` | Reset simulation |
