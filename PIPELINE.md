# PIPELINE.md — General Rules for Pipeline Simulation

This document defines the general rules the simulator must follow. No specific examples — just the canonical logic. Use this alongside `TEST_CASES.md` to implement and verify the simulator.

---

## 1. Pipeline Configurations

### 5-Stage Pipeline
Stages in order: **IF → ID → EX → MEM → WB**

- A register value written by an instruction becomes available **at the end of WB**.
- Without forwarding, the consuming instruction can only read the value **at its ID stage**, which must come **after** the producer's WB completes.
- With forwarding, the value can be available earlier (see Section 4).

### 4-Stage Pipeline
Stages in order: **IF → ID → EX → MEM/WB**

- MEM and WB are **combined into one stage**.
- A register value becomes available **at the end of MEM/WB**.
- This makes the pipeline one stage shorter, which reduces the stall count in most hazard cases by 1 compared to 5-stage.

---

## 2. General Scheduling Rules

- The pipeline is **single-issue and in-order**: at most one instruction enters (IF) per cycle.
- Instructions enter in program order; I(j) cannot enter IF before I(j-1) does.
- A stall freezes the stalled instruction and all instructions behind it for one cycle. The pipeline ahead of the stall continues normally.
- Stalls are inserted **between the IF of the dependent instruction and its ID stage**. The instruction sits in IF (or re-fetches if needed) until it can safely proceed to ID.

### Computing start cycle for each instruction

```
For instruction Ij:
  earliest_start = start_cycle(I(j-1)) + 1    // in-order constraint

  For every prior instruction Ii where RAW(Ii → Ij):
    stalls = compute_stalls(Ii, Ij, pipeline, forwarding)
    earliest_start = max(earliest_start, start_cycle(Ii) + stalls + 1)

  start_cycle(Ij) = earliest_start
```

Where `start_cycle` means the cycle in which the instruction begins IF.

---

## 3. RAW Hazard Detection

A **Read After Write (RAW)** hazard exists between instruction `Ii` and instruction `Ij` (j > i) when:

- `dest(Ii)` is not null, AND
- `dest(Ii)` appears in `sources(Ij)`

### Register roles per instruction type

| Instruction | Destination (writes) | Sources (reads) |
|---|---|---|
| ADD Rd, Rs1, Rs2 | Rd | Rs1, Rs2 |
| SUB Rd, Rs1, Rs2 | Rd | Rs1, Rs2 |
| LW Rd, offset(Rb) | Rd | Rb |
| SW Rs, offset(Rb) | none | Rs, Rb |

**SW has no destination register.** It cannot be a producer in a RAW hazard, but it can be a consumer (it reads two registers).

### Which producer matters

When multiple prior instructions write the same register (e.g., I1 and I3 both write R1, and I5 reads R1), only the **most recent producer** (I3) determines the stall count for Ij. Earlier writes are overwritten and irrelevant.

---

## 4. Stall Calculation — Without Forwarding

The rule: the consumer's **ID stage** needs the value. The producer makes it available **after WB** (or MEM/WB in 4-stage). Stalls are inserted to delay the consumer's ID until the value is ready.

### 5-Stage, No Forwarding

Define:
- `producer_WB_cycle` = `start_cycle(Ii)` + 4  (IF=+0, ID=+1, EX=+2, MEM=+3, WB=+4)
- `consumer_ID_cycle_no_stall` = `start_cycle(Ij)` + 1

Stalls needed = `max(0, producer_WB_cycle - consumer_ID_cycle_no_stall)`

Simplified by distance `d = j - i` (ignoring prior stalls on Ii itself):

| Distance (d = j − i) | Stalls |
|---|---|
| 1 (back-to-back) | 3 |
| 2 (one apart) | 2 |
| 3 (two apart) | 1 |
| ≥ 4 | 0 |

> Important: always use the actual cycle positions, not just distance, because prior stalls on Ii push its WB later.

### 4-Stage, No Forwarding

- `producer_MEMWB_cycle` = `start_cycle(Ii)` + 3
- `consumer_ID_cycle_no_stall` = `start_cycle(Ij)` + 1

Stalls needed = `max(0, producer_MEMWB_cycle - consumer_ID_cycle_no_stall)`

Simplified by distance:

| Distance (d = j − i) | Stalls |
|---|---|
| 1 (back-to-back) | 2 |
| 2 (one apart) | 1 |
| ≥ 3 | 0 |

---

## 5. Stall Calculation — With Forwarding

Forwarding allows a value to be read from an intermediate pipeline register rather than waiting for WB. The forwarding path available depends on both the producer type and the pipeline configuration.

### 5-Stage, With Forwarding

#### ALU → ALU (ADD/SUB producing for ADD/SUB consumer)

- Forward path: **EX output → EX input** (EX→EX forwarding)
- Value available: end of producer's EX stage
- Consumer needs it: start of consumer's EX stage
- Result: **0 stalls** at any distance (as long as the consumer's EX is not earlier than the producer's EX)

#### LW → Any consumer (load-use hazard)

- LW value is only available after **MEM** (it is read from memory during MEM).
- Forward path: **MEM output → EX input**
- The consumer's EX stage must come **after** the producer's MEM stage.
- Back-to-back (d=1): consumer's EX would be at the same time as producer's MEM → **1 stall** required (unavoidable)
- d ≥ 2: **0 stalls**

This 1-stall load-use penalty **cannot be eliminated by forwarding** and must always be inserted when d=1.

### 4-Stage, With Forwarding

#### ALU → ALU

- Forward path: **EX output → EX input**
- Result: **0 stalls** at any distance

#### LW → Any consumer (load-use hazard)

In 4-stage, MEM and WB are combined. The loaded value is available at the end of the MEM/WB stage.

- Forward path: **MEM/WB output → EX input**
- The stall in 4-stage with forwarding manifests **at the EX stage** of the consumer (not at IF/ID like no-forwarding cases). The consumer proceeds through IF and ID normally, then stalls at EX for 1 cycle waiting for the load to complete.
- Back-to-back (d=1): **1 stall** (appears at consumer's EX)
- d ≥ 2: **0 stalls**

> The difference from no-forwarding: without forwarding, the stall happens before ID (consumer waits to enter ID). With forwarding in 4-stage, the consumer can enter ID normally but must stall before EX.

---

## 6. Stall Placement in the Pipeline Table

### Without Forwarding (both pipeline types)

Stalls are inserted **between IF and ID** of the consumer instruction. The instruction completes IF, then waits in stall slots before proceeding to ID.

```
Consumer row: IF | ST | ST | ... | ID | EX | MEM | WB
```

### With Forwarding, Load-Use (5-stage)

Same as no-forwarding placement — 1 stall between IF and ID:

```
Consumer row: IF | ST | ID | EX | MEM | WB
```

### With Forwarding, Load-Use (4-stage)

The stall appears **at the EX stage** — the consumer completes IF, ID normally, then stalls before EX:

```
Consumer row: IF | ID | ST | EX | MEM/WB
```

---

## 7. Total Cycle Count

```
total_cycles = max over all instructions of (start_cycle(Ii) + num_stages - 1)
```

Where `num_stages` = 5 for 5-stage, 4 for 4-stage.

---

## 8. Forwarding Does Not Apply To

- **WAR hazards** — not modelled
- **WAW hazards** — not modelled
- **Structural hazards** — not modelled
- **Branch/control hazards** — not modelled

---

## 9. Summary Table — Stall Counts by Configuration

| Config | Hazard Type | Distance | Forwarding Off | Forwarding On |
|---|---|---|---|---|
| 5-stage | ALU→ALU | d=1 | 3 stalls | 0 stalls |
| 5-stage | ALU→ALU | d=2 | 2 stalls | 0 stalls |
| 5-stage | ALU→ALU | d=3 | 1 stall | 0 stalls |
| 5-stage | ALU→ALU | d≥4 | 0 stalls | 0 stalls |
| 5-stage | LW→any | d=1 | 3 stalls | 1 stall (before ID) |
| 5-stage | LW→any | d=2 | 2 stalls | 0 stalls |
| 5-stage | LW→any | d≥3 | 0 stalls | 0 stalls |
| 4-stage | ALU→ALU | d=1 | 2 stalls | 0 stalls |
| 4-stage | ALU→ALU | d=2 | 1 stall | 0 stalls |
| 4-stage | ALU→ALU | d≥3 | 0 stalls | 0 stalls |
| 4-stage | LW→any | d=1 | 2 stalls (before ID) | 1 stall (before EX) |
| 4-stage | LW→any | d=2 | 1 stall | 0 stalls |
| 4-stage | LW→any | d≥3 | 0 stalls | 0 stalls |

> "Distance" d = (consumer index) − (producer index), ignoring intermediate stalls. Always recompute using actual cycle positions when chaining multiple hazards.
