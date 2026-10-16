# First experiment — 2026-10-01

Configuration: `first.json`. Machine-readable summary, selected candidate programs, ancestry chains and all matched assessment outcomes: `first-results.json`. Re-run with `pnpm experiment`; complete history and snapshots are generated in `results/first/`.

| Seed | Control population | Mutation population | Control births | Mutation births | Mutation termination |
|---|---:|---:|---:|---:|---|
| 1 | 1 | 1 | 980 | 30 | 1,000-tick budget |
| 2 | 2 | 222 | 1,777 | 4,878 | Instruction budget |
| 3 | 1 | 0 | 986 | 56 | Extinction |
| 4 | 2 | 142 | 1,945 | 6,328 | 1,000-tick budget |
| 5 | 1 | 2 | 975 | 109 | 1,000-tick budget |

All controls survived the horizon and reproduced repeatedly. Mutation had mixed outcomes. Terminal rows describe each discovery arm's own compute-limited horizon, so the seed-2 terminal populations are not an equal-time comparison.

Six living distinct genomes were screened (at most two per seed, ranked by terminal abundance) and replayed against the founding genome on held-out seeds 101–105, with mutation disabled. Evaluation pairs stop at the same elapsed horizon when either program hits its instruction budget.

Candidates 4422 and 4545 from seed 2 produced more offspring than their ancestor in all five matched replays. Some comparisons were censored by compute limits. Candidate 31 from seed 1 persisted for 1,000 ticks but produced **zero offspring** in all five replays. This distinguishes persistence of an individual from sustained reproduction.

These are exploratory results from a small selected sample. They support further experiments, not a claim of statistical significance, generalized adaptation or cumulative invention. No selection threshold or success claim is inferred from genome diversity.


## World 1 resource stress (live-world rules)

Run `pnpm stress`. Retained summary: `experiments/world1-results.json`; 30 full runs with configuration, metrics, lineage and selected snapshots: `results/world-1/`. All selected snapshots were restored and their resource ledgers checked. Seeds 1–5, up to 1,000 ticks and 1,000,000 instructions per arm. This configuration sets the population safeguard to 1,024, above the maximum possible population of 666 at 6,000 material and the minimum one-byte/eight-slot body. Earlier 256-cap results remain separate evidence.

| World | One changed constraint | Observed mutation outcomes |
|---|---|---|
| Resource ecology | Baseline | Three completed 1,000 ticks alive; seed 3 extinct at tick 86; seed 2 stopped at instruction budget at tick 588 with 238 organisms |
| Energy scarcity | Replenishment 80 → 20 | All five mutation and all five control populations extinct; mutation extinction ticks 16–22 |
| Material scarcity | Material 6,000 → 280 | Four mutation populations alive at tick 1,000, one extinct; every surviving mutation arm had zero births in the final 200 ticks |

Baseline seed 4 produced 1,413 births in its final 200 ticks. Baseline seeds 1 and 5 produced zero in that window despite remaining alive. A terminal population is therefore insufficient evidence of continued reproduction. Initial source stocks remain substantial in many worlds: this short experiment does not establish long-term ecological equilibrium. Compute-capped arms have different horizons; terminal-population differences must not be treated as a matched fitness comparison.
