import { createWorld, step, metrics, snapshot, genomeKey, SEED_PROGRAM } from './engine.mjs';

export const NO_MUTATION = { substitutionPermille: 0, insertionPermille: 0, deletionPermille: 0 };
function validateBudget(ticks, instructionBudget) {
  for (const [name, value, max] of [['ticks', ticks, 100000], ['instructionBudget', instructionBudget, 100000000]]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${name}`);
  }
}
function summarize(world, termination) {
  return { ...metrics(world), termination: world.halted ?? termination, survived: world.organisms.length > 0,
    extinctionTick: world.halted === 'extinction' ? world.tick : null, costs: { ...world.stats.costs },
    mutations: world.stats.mutations, failedReproductions: world.stats.failedReproductions };
}
export function run({ configuration = {}, seed = 1, program = SEED_PROGRAM, ticks = 1000, instructionBudget = 1000000, sampleEvery = 25, snapshotEvery = 250 } = {}) {
  for (const [name, value, max] of [['ticks', ticks, 100000], ['instructionBudget', instructionBudget, 100000000], ['sampleEvery', sampleEvery, 100000], ['snapshotEvery', snapshotEvery, 100000]]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error(`Invalid ${name}`);
  }
  if (Math.ceil(ticks / snapshotEvery) + 1 > 64) throw new Error('Snapshot budget exceeded: choose snapshotEvery to retain at most 64 snapshots');
  if (Math.ceil(ticks / sampleEvery) + 1 > 10001) throw new Error('Trend sample budget exceeded');
  const world = createWorld(configuration, seed, program), trends = [metrics(world)], snapshots = [snapshot(world)];
  let termination = 'tick-budget';
  while (world.tick < ticks && !world.halted) {
    // Stop at a complete-tick boundary; reserve the worst-case cost of this tick.
    if (world.stats.instructions + world.organisms.length * world.config.instructionsPerTick > instructionBudget) { termination = 'instruction-budget'; break; }
    step(world);
    if (world.tick % sampleEvery === 0) trends.push(metrics(world));
    if (world.tick % snapshotEvery === 0) snapshots.push(snapshot(world));
  }
  termination = world.halted ?? termination;
  const summary = summarize(world, termination);
  if (trends.at(-1).tick !== world.tick) trends.push(metrics(world));
  if (snapshots.at(-1).tick !== world.tick) snapshots.push(snapshot(world));
  return { version: 1, configuration: world.config, seed, program: [...program],
    budget: { ticks, instructionBudget, sampleEvery, snapshotEvery }, summary, trends, lineage: world.lineage, snapshots };
}
export function compare({ seeds = [1, 2, 3, 4, 5], ...options } = {}) {
  if (!Array.isArray(seeds) || !seeds.length || seeds.length > 100) throw new Error('Expected 1..100 seeds');
  const pairs = seeds.map(seed => ({ seed,
    control: run({ ...options, seed, configuration: { ...options.configuration, ...NO_MUTATION } }),
    mutation: run({ ...options, seed }) }));
  return { version: 1, question: 'Do inherited strategies sustain viable populations under resource constraints?',
    interpretation: 'Diversity and visual complexity are observations, not evidence of adaptation. Survival is censored at compute limits.', pairs };
}
export function candidates(result, limit = 5) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid candidate limit');
  const last = result.snapshots.at(-1), alive = new Map(last.organisms.map(o => [o.id, o]));
  const counts = new Map();
  for (const o of last.organisms) counts.set(genomeKey(o.genome), (counts.get(genomeKey(o.genome)) ?? 0) + 1);
  const unique = new Set(), records = [];
  // This is a screening rule, not a fitness claim: living descendants, common genomes first.
  for (const o of [...alive.values()].sort((a, b) => counts.get(genomeKey(b.genome)) - counts.get(genomeKey(a.genome)) || a.id - b.id)) {
    const key = genomeKey(o.genome);
    if (unique.has(key) || key === genomeKey(result.program)) continue;
    unique.add(key);
    let record = result.lineage[o.id - 1]; const ancestry = [record.id];
    while (record.parentId !== null) { record = result.lineage[record.parentId - 1]; ancestry.push(record.id); }
    records.push({ id: o.id, discoverySeed: result.seed, abundance: counts.get(key), generation: o.generation,
      program: o.genome, ancestor: record.genome, ancestry, selection: 'Living distinct genome ranked by terminal abundance; exploratory candidate only' });
    if (records.length >= limit) break;
  }
  return records;
}
export function evaluate(candidate, { seeds = [101, 102, 103, 104, 105], ...options } = {}) {
  const configuration = { ...options.configuration, ...NO_MUTATION };
  const ticks = options.ticks ?? 1000, instructionBudget = options.instructionBudget ?? 1000000;
  validateBudget(ticks, instructionBudget);
  if (!Array.isArray(seeds) || !seeds.length || seeds.length > 100 || seeds.includes(candidate.discoverySeed)) throw new Error('Expected 1..100 held-out evaluation seeds');
  const pairs = seeds.map(seed => {
    const ancestor = createWorld(configuration, seed, candidate.ancestor);
    const descendant = createWorld(configuration, seed, candidate.program);
    let horizon = 0, termination = 'tick-budget';
    for (; horizon < ticks; horizon++) {
      const worlds = [ancestor, descendant];
      if (worlds.every(w => w.halted)) { termination = 'both-halted'; break; }
      if (worlds.some(w => !w.halted && w.stats.instructions + w.organisms.length * w.config.instructionsPerTick > instructionBudget)) { termination = 'paired-instruction-budget'; break; }
      for (const w of worlds) if (!w.halted) step(w);
    }
    const a = summarize(ancestor, termination), d = summarize(descendant, termination);
    return { seed, horizon, ancestor: a, descendant: d,
      difference: { population: d.population - a.population, births: d.births - a.births,
        energyExpenditure: d.energyExpenditure - a.energyExpenditure } };
  });
  return { candidate, seeds, configuration, budget: { ticks, instructionBudgetPerProgram: instructionBudget }, pairs,
    interpretation: 'Matched single-founder replay, mutation disabled. Both arms stop at the same horizon when either reaches its instruction budget. Extinct arms remain extinct. Differences describe these seeds and budgets, not open-ended invention or statistical proof.' };
}
