# Digital Life

A bounded experimental world of bytecode organisms. Replication is supplied; cumulative invention is an ambition, not a demonstrated result.

Node 24+ and pnpm are sufficient; there are no dependencies.

```sh
pnpm test
pnpm experiment
pnpm replay results/first/4-mutation.json 100 results/replay.json
pnpm dev
```

The default experiment runs five paired mutation-on/off seeds for up to 1,000 ticks and 1,000,000 executed instructions per run. It exports config, summaries, cost breakdowns, trends, lineage history and selected full snapshots to `results/first/`. Candidate programs are screened from terminal living genomes and replayed against their founding ancestor on five held-out seeds. Both evaluation arms stop at the same horizon if either exhausts its instruction budget. Extinction is an outcome; compute-capped survival is censored.

`pnpm replay` resumes a standalone snapshot or the last selected snapshot in an exported run, up to an additional million instructions. [First experiment results](experiments/RESULTS.md) record measured outcomes, including a persistent mutant that lost reproduction.

Change rules without rebuilding by editing a copy of `experiments/first.json`, then run `pnpm experiment path/to/config.json results/my-run`. Costs and probabilities must be integer values; mutation probabilities are per thousand. Full resource bounds and defaults live in `src/engine.mjs`.

Open http://127.0.0.1:4317 for the **live Observatory**, the owner-selected direction B. The simulation runs in a worker using the same engine as the headless runner. It supports pause, single-step, 1/6/24/96/480 ticks per second (one tick per second by default), cell selection by mouse or arrow keys/Enter, organism inspection, and a living-organism follow mode. P toggles playback; S pauses and steps outside form controls.

**Explain this tick** pauses and lets you traverse the selected program’s last observed tick: upkeep, each executed instruction, exact reserve changes, harvest/copy transfers and failure/death causes. The close-up shows recorded local state; the full field stays at the current tick. The readable instruction routine highlights the recorded row and compares inherited changes with the immediate parent. Changed children are marked in the picker, and recent activity can be inspected. Observation is external to VM state, bounded to at most 65 selected actions and 96 recent events, and cleared on rewind. Snapshot imports start a new action log.

World rules expose resource ecology, energy scarcity, and material scarcity presets; a full configuration JSON editor supports every engine rule without rebuilding. Rule changes start a new world. Snapshot save/open preserves the complete world and random state; a single headless run opens its last selected snapshot. Up to 12 exact replay checkpoints are retained within an 8 MiB memory allowance; older checkpoints are evicted. Saving a snapshot pauses the world so the export is concrete. Imported continuations receive a new additional compute allowance.

The live session stops at 10,000 additional ticks or 10,000,000 additional instructions, or the engine's extinction/history/world limits. Population safeguards are labeled separately from ecological stability. Rendering effects mark actual recorded births and deaths; motion can be disabled and follows reduced-motion preferences.

The browser can run five mutation-on/off pairs, export full configurations, summaries, trends, lineages, and initial/final snapshots, then test selected distinct living descendants against their ancestor on held-out seeds. Experiments run in a separate worker and can be cancelled without changing the live world. Browser comparisons use at most 1,000 ticks and 1,000,000 instructions per arm. Ancestral/descendant assessments compare equal elapsed horizons, with mutation disabled.

`pnpm stress` reproduces the three World 1 environments over five paired seeds and writes 30 full runs to `results/world-1/`. The retained summary is [experiments/world1-results.json](experiments/world1-results.json). Tracking: https://github.com/sarthakagrawal927/digital-life/issues/1. Earlier direction probes remain available at `/design/v2/index.html?direction=b`; their playback is recorded data, distinct from the live root page.

## World and accounting

- The grid wraps at its edges. Cells can contain multiple organisms, which compete for that cell's energy in seeded shuffled order. Population is capped globally.
- Source patches are independently sampled by `patchPermille`. The founder starts on the first source, or cell zero if none exists. This placement is identical between treatment arms. Sources start full and regenerate up to their capacity each tick.
- Every instruction byte and each fixed working-memory slot occupies one construction unit. Organisms have eight memory slots by default. Genome size and copy cost vary with mutations; memory size is a world rule in this MVP.
- A tick regenerates sources, shuffles organisms, charges size-proportional upkeep, then executes up to `instructionsPerTick` per scheduled organism. Newborns first execute next tick. Sources do not regenerate inside an instruction batch.
- Base instruction cost applies even to failed operations. Sensing, moving and harvesting pay their operation cost; successful reproduction pays its base and size-dependent copy cost. A failed reproduction spends its instruction cost only. Other unaffordable operations kill the organism and dissipate its remaining reserve.
- Reproduction copies the parent's genome with independent deletion, substitution and insertion attempts. Empty or oversized candidates fail. The parent funds all child starting energy; mutation does not manufacture resources. Children start at the parent's cell with zeroed memory, program counter and accumulator, and inherit its direction.
- Death returns occupied material to the global pool; residual energy dissipates. `assertAccounting` checks material and energy ledgers after every tick.
- All organisms descend from one founding lineage. `lineagePersistenceTicks` measures persistence of that founding family; parent links, birth/death ticks and generations allow branch-level analysis. It is not independent lineage diversity.

## VM reference

Each byte uses its high nibble as opcode and low nibble as argument. Branch offsets are signed four-bit relative offsets from the **next** instruction. Program counters wrap inside the current genome. Accumulator and memory values saturate to signed 16-bit range. Memory indices wrap within the fixed memory size.

| Opcode | Instruction | Behavior |
|---|---|---|
| 0 | NOP | No operation |
| 1 | HARVEST | Transfer local patch energy into reserve, up to harvest amount and reserve cap |
| 2 | TURN | Rotate clockwise by argument, modulo four |
| 3 | MOVE | Move one cell relative to facing direction plus argument modulo four |
| 4 | SENSE | 0: local energy; 1: reserve; 2: free material; 3–15: neighboring energy, relative direction `(arg−3) mod 4` |
| 5 | SET | Set accumulator to argument |
| 6 | ADD | Add argument to accumulator |
| 7 | LOAD | Read indexed working memory |
| 8 | STORE | Write accumulator to indexed memory |
| 9 | REPRODUCE | Attempt supplied replication primitive |
| A | IF_ZERO | Branch if accumulator is zero |
| B | IF_POSITIVE | Branch if accumulator is positive |
| C | JUMP | Unconditional relative branch |
| D | SUB | Subtract argument |
| E | MOD | Remainder by argument, or one when argument is zero |
| F | YIELD | End this organism's instruction batch |

The supplied founder `10 10 90 30 21 cb` starts with two harvests, attempts reproduction, moves, turns, then jumps to row 1 (the second harvest). Subsequent loops contain one harvest before reproduction. It contains no intelligence score or host capabilities. `createWorld`, `step`, `snapshot` and `restore` are the engine API. Snapshots include configuration, random streams, working state, history and accounting; restoring and stepping replays the same future. Rule changes start a new world rather than silently changing replay history.

## Limits and interpretation

Hard caps: 128 × 128 grid, 2,048 organisms, 256-byte genomes, 64 memory slots, 64 instructions per organism per tick, 100,000 birth-history records including the founder, and 100,000 ticks per world. The runner reserves a worst-case instruction allowance before each complete tick; unused budget may remain at termination. The default budgets are much smaller.

Each headless run retains at most 64 selected snapshots and 10,001 trend samples; live sessions retain 1,001 trend points and 96 recent observed events. Configuration that exceeds those output bounds is rejected. Replay imports are limited to 64 MiB.

Selected candidates are exploratory and biased by discovery and survival. Single-founder tests do not capture mixed-population ecological interactions. Larger terminal populations may include organisms that survive but cannot reproduce. This implementation has no damage/repair, communication, cooperation, structures, network or filesystem access from bytecode. The Node runner's file exports are host-controlled and separate from the VM.
