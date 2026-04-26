stages4 = ["IF", "ID", "EX", "MEM/WB"]
stages5 = ["IF", "ID", "EX", "MEM", "WB"]


def check_hazard(
    instructions: list[list[str]],
    i: int,
    with_forwarding: bool,
    stages: list[str],
    pipeline_output: list[list[str | None]],
) -> bool:
    if i == 1:
        return False  # No hazard for the first instruction

    elif i == 2:
        inst = instructions[1]  # current instruction in ID stage
        prev_inst = instructions[0]  # previous instruction in EX stage
        if inst[2] == prev_inst[1] or inst[3] == prev_inst[1]:
            prev_inst_stage = pipeline_output[-1][0]
            if prev_inst_stage in (stages[-1], None):
                return False
            if with_forwarding:
                if prev_inst_stage == "STALL":
                    return True
                prev_inst_stage_idx = stages.index(prev_inst_stage)
                limit = 3 if prev_inst[0] == "LW" else 2
                if prev_inst_stage_idx < limit:
                    return True
                return False
            return True

    else:
        inst = instructions[i - 1]
        prev_inst1 = instructions[i - 2]
        prev1_depends = inst[2] == prev_inst1[1] or inst[3] == prev_inst1[1]
        prev_inst2 = instructions[i - 3]
        prev2_depends = inst[2] == prev_inst2[1] or inst[3] == prev_inst2[1]

        if not prev1_depends and not prev2_depends:
            return False
        elif prev1_depends and not prev2_depends:
            prev_inst_stage = pipeline_output[-1][i - 2]
            if prev_inst_stage in (stages[-1], None):
                return False
            if with_forwarding:
                if prev_inst_stage == "STALL":
                    return True
                prev_inst_stage_idx = stages.index(prev_inst_stage)
                limit = 3 if prev_inst1[0] == "LW" else 2
                if prev_inst_stage_idx < limit:
                    return True
                return False
            return True
        elif not prev1_depends and prev2_depends:
            prev_inst_stage = pipeline_output[-1][i - 3]
            if prev_inst_stage in (stages[-1], None):
                return False
            if with_forwarding:
                if prev_inst_stage == "STALL":
                    return True
                prev_inst_stage_idx = stages.index(prev_inst_stage)
                limit = 3 if prev_inst2[0] == "LW" else 2
                if prev_inst_stage_idx < limit:
                    return True
                return False
            return True
        else:
            prev1_inst_stage = pipeline_output[-1][i - 2]
            prev2_inst_stage = pipeline_output[-1][i - 3]
            if prev1_inst_stage in (stages[-1], None) and (
                prev2_inst_stage in (stages[-1], None)
            ):
                return False
            if with_forwarding:
                prev1_stall = prev1_inst_stage == "STALL"
                prev2_stall = prev2_inst_stage == "STALL"
                if prev1_stall and prev2_stall:
                    return True
                elif (prev1_stall and not prev2_stall) or (
                    not prev1_stall and prev2_stall
                ):
                    return True
                else:
                    if prev1_inst_stage is None:
                        prev1_inst_stage_idx = len(stages)
                    else:
                        prev1_inst_stage_idx = stages.index(prev1_inst_stage)
                    if prev2_inst_stage is None:
                        prev2_inst_stage_idx = len(stages)
                    else:
                        prev2_inst_stage_idx = stages.index(prev2_inst_stage)
                    prev1_limit = 3 if prev_inst1[0] == "LW" else 2
                    prev2_limit = 3 if prev_inst2[0] == "LW" else 2
                    if (
                        prev1_inst_stage_idx < prev1_limit
                        or prev2_inst_stage_idx < prev2_limit
                    ):
                        return True
                    return False
            return True

    return False


def simulate_pipeline(
    instructions: list[list[str]],
    stages: list[str],
    with_forwarding: bool,
) -> list[list[str | None]]:
    pipeline_output = []
    cycle = 0

    while True:
        cycle += 1
        cycle_output = []

        for i in range(1, len(instructions) + 1):
            if i == cycle:
                cycle_output.append(stages[0])  # IF
                continue

            if i > cycle:
                cycle_output.append(None)  # Not started
                continue

            if with_forwarding:
                prev_stage = pipeline_output[-1][i - 1]
                if prev_stage == stages[0]:
                    cycle_output.append(stages[1])  # ID
                elif prev_stage in (stages[1], "STALL"):
                    if check_hazard(
                        instructions,
                        i,
                        with_forwarding,
                        stages,
                        pipeline_output,
                    ):
                        cycle_output.append("STALL")
                    else:
                        cycle_output.append(stages[2])  # EX
                else:  # in EX/MEM/WB stages
                    if prev_stage == stages[-1] or prev_stage == None:
                        cycle_output.append(None)  # Completed
                    else:
                        if prev_stage == "STALL":
                            prev_stage_idx = 1
                        else:
                            prev_stage_idx = stages.index(prev_stage)
                        cycle_output.append(stages[prev_stage_idx + 1])

            else:
                prev_stage = pipeline_output[-1][i - 1]
                if prev_stage in (stages[0], "STALL"):
                    if check_hazard(
                        instructions,
                        i,
                        with_forwarding,
                        stages,
                        pipeline_output,
                    ):
                        cycle_output.append("STALL")
                    else:
                        cycle_output.append(stages[1])  # ID
                else:  # in EX/MEM/WB stages
                    if prev_stage == stages[-1] or prev_stage == None:
                        cycle_output.append(None)  # Completed
                    else:
                        if prev_stage == "STALL":
                            prev_stage_idx = 0
                        else:
                            prev_stage_idx = stages.index(prev_stage)
                        cycle_output.append(stages[prev_stage_idx + 1])

        if all(stage is None for stage in cycle_output):
            break  # All instructions have completed
        pipeline_output.append(cycle_output)

    return pipeline_output


if __name__ == "__main__":
    instructions = [
        ["LW", "R1", "R2", "0"],
        ["ADD", "R3", "R1", "R4"],
        ["SUB", "R5", "R1", "R3"],
    ]

    expected_output = {
        "4W": [  # 4 stage pipeline without forwarding
            ["IF", "ID", "EX", "MEM/WB", None, None, None, None, None, None],
            [None, "IF", "STALL", "STALL", "ID", "EX", "MEM/WB", None, None, None],
            [
                None,
                None,
                "IF",
                "STALL",
                "STALL",
                "STALL",
                "STALL",
                "ID",
                "EX",
                "MEM/WB",
            ],
        ],
        "4F": [  # 4 stage pipeline with forwarding
            ["IF", "ID", "EX", "MEM/WB", None, None, None],
            [None, "IF", "ID", "STALL", "EX", "MEM/WB", None],
            [None, None, "IF", "ID", "STALL", "EX", "MEM/WB"],
        ],
        "5W": [  # 5 stage pipeline without forwarding
            [
                "IF",
                "ID",
                "EX",
                "MEM",
                "WB",
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
            ],
            [
                None,
                "IF",
                "STALL",
                "STALL",
                "STALL",
                "ID",
                "EX",
                "MEM",
                "WB",
                None,
                None,
                None,
                None,
            ],
            [
                None,
                None,
                "IF",
                "STALL",
                "STALL",
                "STALL",
                "STALL",
                "STALL",
                "STALL",
                "ID",
                "EX",
                "MEM",
                "WB",
            ],
        ],
        "5F": [  # 5 stage pipeline with forwarding
            ["IF", "ID", "EX", "MEM", "WB", None, None, None],
            [None, "IF", "ID", "STALL", "EX", "MEM", "WB", None],
            [None, None, "IF", "ID", "STALL", "EX", "MEM", "WB"],
        ],
    }

    stages = stages5
    with_forwarding = True

    output = simulate_pipeline(instructions, stages, with_forwarding)
    output_T = list(map(list, zip(*output)))
    expected = expected_output[f"{len(stages)}{'F' if with_forwarding else 'W'}"]

    def print_output(output: list[list[str | None]]):
        # Header
        for i in range(1, len(output[0]) + 1):
            print(f"|{'C'+str(i):^8}", end="")
        print("|")
        print("|" + "--------|" * len(output[0]))

        for row in output:
            for col in row:
                print(f"|{(col or ''):^8}", end="")
            print("|")

    print("Instructions:")
    for inst in instructions:
        print(" ".join(inst))

    print(f"\nStages ({len(stages)}):", ", ".join(stages))
    print("Forwarding:", with_forwarding)

    print("\nExpected Output:")
    print_output(expected)

    print("\nActual Output:")
    print_output(output_T)

    print("\nTest Passed:", output_T == expected)
