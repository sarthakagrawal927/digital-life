import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, snapshot, restore, assertAccounting, SEED_PROGRAM } from '../src/engine.mjs';
import { run, compare, NO_MUTATION, candidates, evaluate } from '../src/experiment.mjs';

test('identical inputs give identical complete histories and snapshots', () => {
  const options = { seed: 42, ticks: 150, instructionBudget: 50000 };
  assert.deepEqual(run(options), run(options));
});
test('snapshot restart preserves scheduling and mutation random streams', () => {
  const original = createWorld({}, 2);
  for (let i = 0; i < 40; i++) step(original);
  const resumed = restore(JSON.stringify(snapshot(original)));
  for (let i = 0; i < 100; i++) { step(original); step(resumed); }
  assert.deepEqual(resumed, original);
});
test('supplied founder completes repeated generations without mutation', () => {
  const result = run({ configuration: { ...NO_MUTATION, patchPermille: 1000 }, ticks: 300 });
  assert.ok(result.summary.births > 20);
  assert.ok(result.summary.maxGeneration >= 3);
  assert.equal(result.summary.genomeDiversity, 1);
  assert.ok(result.summary.population > 0);
});
test('conservation holds under extreme mutation, death, population and material pressure', () => {
  for (const seed of [0, 1, 4294967295]) {
    const w = createWorld({ substitutionPermille: 900, insertionPermille: 500, deletionPermille: 300, material: 100, maxPopulation: 4 }, seed);
    for (let i = 0; i < 200; i++) { step(w); assertAccounting(w); }
    assert.ok(w.organisms.length <= 4);
    for (const o of w.organisms) assert.ok(o.genome.length <= w.config.maxGenome);
  }
});
test('reproduction transfers parent energy and cannot allocate unavailable material', () => {
  const w = createWorld({ ...NO_MUTATION, instructionsPerTick: 1, regeneration: 0, upkeepPerUnit: 0, instructionCost: 0,
    initialEnergy: 1000, childEnergy: 200, material: 18, reproductionCost: 20, copyCostPerUnit: 2 }, 1, [0x90]);
  const before = w.ledger.supplied;
  step(w);
  assert.equal(w.organisms.length, 2);
  assert.equal(w.organisms[0].energy, 762);
  assert.equal(w.organisms[1].energy, 200);
  assert.equal(w.ledger.spent, 38);
  step(w);
  assert.equal(w.organisms.length, 2);
  assert.equal(w.freeMaterial, 0);
  assert.equal(w.ledger.supplied, before);
  assertAccounting(w);
});
test('death recycles material and dissipates unpaid reserves', () => {
  const w = createWorld({ patchPermille: 0, initialEnergy: 2, upkeepPerUnit: 1 }, 1);
  step(w);
  assert.equal(w.halted, 'extinction'); assert.equal(w.freeMaterial, w.config.material);
  assert.equal(w.ledger.dissipated, 2); assertAccounting(w);
});
test('mutation events remain traceable to inherited descendant bytes', () => {
  const w = createWorld({ substitutionPermille: 1000, insertionPermille: 0, deletionPermille: 0, instructionsPerTick: 1 }, 1, [0x90]);
  step(w);
  const child = w.lineage[1];
  assert.equal(child.parentId, 1); assert.equal(child.mutations.length, 1);
  assert.equal(child.mutations[0].from, 0x90); assert.equal(child.mutations[0].to, child.genome[0]);
  assert.notEqual(child.genome[0], 0x90);
});
test('empty/oversized mutant genomes fail instead of gaining free repairs', () => {
  const w = createWorld({ deletionPermille: 1000, instructionsPerTick: 1 }, 1, [0x90]);
  step(w); assert.equal(w.stats.births, 0); assert.equal(w.stats.failedReproductions, 1); assertAccounting(w);
});
test('arbitrary bytes and infinite jumps are bounded and have no host capabilities', () => {
  for (let byte = 0; byte < 256; byte++) {
    const w = createWorld({ instructionsPerTick: 4 }, byte, [byte]);
    step(w); assert.ok(w.stats.instructions <= 4); assertAccounting(w);
  }
});
test('configuration and imported snapshot bounds are validated', () => {
  for (const c of [{ width: 0 }, { maxGenome: 257 }, { insertionPermille: 1001 }, { shell: 'anything' }, { moveCost: -1 }]) assert.throws(() => createWorld(c));
  const w = snapshot(createWorld()); w.organisms[0].x = 999;
  assert.throws(() => restore(w));
  assert.throws(() => createWorld({}, 1, []));
  const invalid = snapshot(createWorld()); invalid.organisms[0].lineageId = 999;
  assert.throws(() => restore(invalid));
  assert.throws(() => run({ ticks: 100000, snapshotEvery: 1 }));
});
test('paired experiments match initial conditions and respect compute budgets', () => {
  const report = compare({ seeds: [1, 2], ticks: 20, instructionBudget: 1000 });
  for (const p of report.pairs) {
    assert.deepEqual(p.control.snapshots[0].cells, p.mutation.snapshots[0].cells);
    assert.equal(p.control.summary.mutations, 0);
    assert.ok(p.mutation.summary.instructions <= 1000);
  }
  const stopped = run({ instructionBudget: 1 });
  assert.equal(stopped.summary.termination, 'instruction-budget');
  assert.equal(stopped.summary.tick, 0);
});
test('matched replay has no mutation and reports failures as outcomes', () => {
  const candidate = { ancestor: SEED_PROGRAM, program: [0xff], discoverySeed: 1 };
  const result = evaluate(candidate, { seeds: [101, 102], ticks: 300 });
  assert.equal(result.pairs.length, 2);
  assert.equal(result.pairs[0].descendant.termination, 'extinction');
  assert.equal(result.pairs[0].descendant.mutations, 0);
  assert.deepEqual(candidates(run({ configuration: NO_MUTATION, ticks: 10 })), []);
});
test('matched replay compares equal horizons even when one arm consumes compute sooner', () => {
  const result = evaluate({ ancestor: [0xf0], program: SEED_PROGRAM, discoverySeed: 1 }, {
    seeds: [101], ticks: 500, instructionBudget: 1000, configuration: { patchPermille: 1000 } });
  const pair = result.pairs[0];
  assert.equal(pair.ancestor.tick, pair.horizon);
  assert.equal(pair.descendant.tick, pair.horizon);
  assert.equal(pair.descendant.termination, 'paired-instruction-budget');
  assert.ok(pair.ancestor.instructions <= 1000 && pair.descendant.instructions <= 1000);
  assert.throws(() => evaluate({ ancestor: SEED_PROGRAM, program: SEED_PROGRAM, discoverySeed: 1 }, { seeds: [1] }));
});
