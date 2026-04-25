# CS2011: Foundations of Computer Systems — Assignment 2
**Plaksha University | Max Marks: 20**

## Project: Pipeline Hazard Simulation Applet

Build an interactive web-based (or desktop) applet that simulates a single-issue, in-order pipeline, visualizes cycle-by-cycle execution, and highlights hazards and their resolution.

---

## Core Requirements

### Pipeline Configurations
- **4-stage**: IF → ID → EX → MEM/WB (combined final stage)
- **5-stage**: IF → ID → EX → MEM → WB (standard textbook pipeline)
- Both configurations must produce distinct, correct schedules

### Instruction Support
- Minimum required: `ADD`, `SUB`, `LW`, `SW`
- Max 10 instructions per simulation
- User must be able to add, remove, and modify instructions before running
- Syntax examples:
  - `ADD R1, R2, R3`
  - `SUB R4, R1, R5`
  - `LW R1, 0(R2)`

### Hazard Handling
- **RAW (Read After Write)** — required baseline; detect and resolve via **stall insertion**
- **Data Forwarding** — required enhancement; must visibly change the schedule vs. stall-only
- WAR, WAW — optional (only if architectural assumptions are clearly justified)
- Control/structural hazards — out of scope; branch/jump instructions not required

---

## UI / Visualization Requirements

### Pipeline Execution Table
- Rows = instructions, Columns = cycles
- Each cell shows the stage label (IF, ID, EX, MEM, WB) or `STALL`/`BUBBLE`
- Empty cells must be unambiguous (not-yet-started vs. completed vs. stalled)

Example layout:
```
Cycle   1    2    3    4    5    6    7
I1      IF   ID   EX   MEM  WB
I2           IF   ID   STALL EX  MEM  WB
I3                IF   STALL ID  EX   MEM  WB
```

### Execution Controls
- **Step** — advance one cycle at a time
- **Run** — auto-run to completion
- **Reset** — restart simulation from beginning

### Hazard Visibility
- Highlight or annotate which instruction depends on which
- Show forwarding paths when forwarding is enabled

---

## Grading Rubric

| Criterion | Marks |
|---|---|
| Instruction input handling, editing, format correctness | 2.5 |
| Both 4-stage and 5-stage pipeline support | 2.5 |
| Pipeline visualization clarity (cycle-by-cycle table) | 8.0 |
| User interaction quality (step, auto-run, reset) | 3.0 |
| RAW hazard detection + stall-based resolution | 3.0 |
| Report quality, code organization, run instructions | 1.0 |
| **Total** | **20.0** |

---

## Submission Requirements

A `.zip`/`.rar` containing:
1. **Source code** — all files needed to run/build
2. **Runnable version** — web app, desktop app, or other executable
3. **PDF report** — design decisions, assumptions (e.g., when register value becomes available), instruction format, hazard logic, screenshots, and test cases

### Required Test Cases in Report
- One sequence with **no dependencies**
- One sequence with a **simple arithmetic RAW hazard**
- One sequence with a **load-use dependency**
- One test showing **forwarding vs. stalling** schedule difference (if forwarding implemented)

---

## Assumptions to Document

- At what stage does a register value become available? (e.g., end of WB, or earlier with forwarding)
- Forwarding rule: from which stage to which stage can values be forwarded?
- Any other pipeline-specific assumptions

---

## Deadline

**26 April 2026 at 11:59 PM**

Late penalties: −1 mark (first 12h), −2 marks (next 12h), −3 marks/day thereafter.

---

## Out of Scope

- Caches, branch prediction, out-of-order execution
- Superscalar issue, exceptions, interrupts, multi-cycle functional units
- Branch/jump instructions
- WAR/WAW hazards (unless explicitly justified)
