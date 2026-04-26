from pipeline import simulate_pipeline, stages4, stages5


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


def test_pipeline(instructions, stages):
    print("Instructions:")
    for inst in instructions:
        print(" ".join(inst))

    print(f"\nStages ({len(stages)}):", ", ".join(stages))

    for with_forwarding in [False, True]:
        output = simulate_pipeline(instructions, stages, with_forwarding)
        output_T = list(map(list, zip(*output)))

        print(f"\nPipeline Output (with{'' if with_forwarding else 'out'} Forwarding):")
        print_output(output_T)


# instructions = [
#     ["ADD", "R0", "R1", "R2"],
#     ["SUB", "R3", "R0", "R4"],
# ]

# instructions = [
#     ["ADD", "R0", "R1", "R2"],
#     ["ADD", "R5", "R6", "R7"],
#     ["SUB", "R3", "R0", "R4"],
# ]

# instructions = [
#     ["LW", "R0", "R1", "0"],
#     ["ADD", "R2", "R0", "R3"],
# ]

# instructions = [
#     ["ADD", "R0", "R1", "R2"],
#     ["ADD", "R0", "R0", "R3"],
#     ["SUB", "R4", "R0", "R5"],
# ]

# instructions = [
#     ["ADD", "R0", "R1", "R2"],
#     ["SW", "R3", "R0", "0"],
# ]


# instructions = [
#     ["ADD", "R1", "R2", "R3"],
#     ["SUB", "R4", "R1", "R5"],
#     ["ADD", "R6", "R4", "R7"],
#     ["SUB", "R8", "R6", "R9"],
#     ["ADD", "R10", "R8", "R11"],
#     ["SUB", "R12", "R10", "R13"],
#     ["ADD", "R14", "R12", "R15"],
#     ["SUB", "R16", "R14", "R17"],
# ]


instructions = [
    ["ADD", "R1", "R2", "R3"],
    ["ADD", "R4", "R5", "R6"],
    ["SW", "R7", "R1", "0"],
]
stages = stages5
test_pipeline(instructions, stages)
