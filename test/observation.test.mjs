import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, snapshot, assertAccounting } from '../src/engine.mjs';
import { LiveSession } from '../src/session.mjs';
import { NO_MUTATION } from '../src/experiment.mjs';
import { explainAction, inheritedChanges, instructionLabel } from '../src/explain.mjs';

test('observing arbitrary selected programs leaves complete simulation histories identical', () => {
  for (const seed of [1, 4, 17]) {
    const a = createWorld({ substitutionPermille: 500, insertionPermille: 100, deletionPermille: 100 }, seed);
    const b = createWorld(a.config, seed);
    for (let i = 0; i < 150 && !a.halted; i++) {
      const trace = { selectedId: a.organisms.at(-1)?.id, actions: [], events: [] };
      step(a, trace); step(b);
      assert.deepEqual(snapshot(a), snapshot(b));
      assert.ok(trace.actions.length <= 96 && trace.events.length <= 96);
      for (const action of trace.actions) assert.equal(action.cells.length, 9);
    }
  }
});

test('recorded harvesting and copying explain exact energy transfers, costs and positions', () => {
  const session = new LiveSession({ configuration: { ...NO_MUTATION, patchPermille: 1000 } });
  session.advance(1, 1);
  const { actions, events } = session.view(1);
  assert.equal(actions[0].opcode, 'UPKEEP');
  const harvest = actions.find(a => a.opcode === 'HARVEST');
  assert.equal(harvest.harvested, 500);
  assert.equal(harvest.patchBefore - harvest.patchAfter, harvest.harvested);
  assert.equal(harvest.after.energy - harvest.before.energy, 500 - session.world.config.instructionCost - session.world.config.harvestCost);
  assert.equal(harvest.cells.find(c => c.dx === 0 && c.dy === 0).energy, harvest.patchAfter);
  assert.match(explainAction(harvest).reserve, /\+496/);
  const copy = actions.find(a => a.reproduction?.childId);
  assert.equal(copy.before.energy - copy.after.energy, session.world.config.instructionCost + copy.reproduction.copyCost + copy.reproduction.transferredEnergy);
  const child = session.world.organisms.find(o => o.id === copy.reproduction.childId);
  assert.equal(child.energy, copy.reproduction.transferredEnergy);
  assert.deepEqual([child.x, child.y], [copy.before.x, copy.before.y]);
  const birth = events.find(e => e.id === child.id && e.type === 'birth');
  assert.deepEqual([birth.x, birth.y], [child.x, child.y]);
  assertAccounting(session.world);
});

test('failed copy reasons distinguish energy, material, invalid mutations and guardrails', () => {
  const cases = [
    [{ material: 100, initialEnergy: 100 }, 'energy'],
    [{ material: 9, initialEnergy: 1000 }, 'material'],
    [{ material: 100, maxPopulation: 1 }, 'population-limit'],
    [{ material: 100, deletionPermille: 1000 }, 'invalid-copy'],
  ];
  for (const [config, reason] of cases) {
    const w = createWorld({ ...NO_MUTATION, upkeepPerUnit: 0, instructionCost: 0, instructionsPerTick: 1, ...config }, 4, [0x90]);
    const trace = { selectedId: 1, actions: [], events: [] }; step(w, trace);
    const a = trace.actions.find(a => a.opcode === 'REPRODUCE');
    assert.equal(a.reproduction.reason, reason); assert.equal(w.stats.births, 0);
    assert.match(explainAction(a).title, /No child was made/);
    assert.equal(a.before.energy, a.after.energy);
  }
});

test('death explanations identify the exact unaffordable payment and recycle material', () => {
  for (const [program, configuration, category, available, required] of [
    [[0x00], { initialEnergy: 1 }, 'upkeep', 1, 9],
    [[0x00], { initialEnergy: 0, upkeepPerUnit: 0 }, 'instruction', 0, 1],
    [[0x30], { initialEnergy: 2, upkeepPerUnit: 0 }, 'move', 1, 4],
    [[0x10], { initialEnergy: 2, upkeepPerUnit: 0 }, 'harvest', 1, 3],
    [[0x40], { initialEnergy: 2, upkeepPerUnit: 0 }, 'sense', 1, 2],
  ]) {
    const w = createWorld(configuration, 4, program), trace = { selectedId: 1, actions: [], events: [] };
    step(w, trace); const a = trace.actions.at(-1);
    assert.deepEqual(a.death, { category, available, required });
    assert.match(explainAction(a).title, /Died: could not pay/);
    assert.equal(w.freeMaterial, w.config.material);
    assert.equal(trace.events.find(e => e.type === 'death').reason.category, category);
    assertAccounting(w);
    const session = new LiveSession({ seed:4, configuration, program }); session.advance(1,1,true);
    assert.equal(session.view(1,true).selectedRecord.id,1);
    assert.ok(session.view(1,true).actions.at(-1).death);
  }
});

test('action playback stays selected and bounded, clears on rewind, and retains observed death', () => {
  const s = new LiveSession({ seed: 4 }); s.advance(10, 1);
  assert.ok(s.view(1).actions.at(-1).death);
  assert.equal(s.view(2).actions.length, 0);
  s.advance(1, 2); assert.ok(s.view(2).actions.every(a => a.id === 2));
  assert.equal(s.view(1).actions.length, 0);
  s.rewind(0); assert.equal(s.view(1).actions.length, 0);
  const extreme = new LiveSession({ configuration: { instructionsPerTick: 64, patchPermille: 1000, maxPopulation: 1024 } });
  extreme.advance(120, 1, true);
  assert.ok(extreme.actions.length <= 65); assert.ok(extreme.events.length <= 96);
});

test('inheritance explanation uses immediate-parent mutations and reports missing reproduction literally', () => {
  const parent = { id: 2, genome: [0x90, 0x10, 0x21] };
  const child = { id: 3, genome: [0x10, 0x22], mutations: [{ type: 'deletion', index: 0, from: 0x90 }, { type: 'substitution', index: 2, from: 0x21, to: 0x22 }] };
  const explanation = inheritedChanges(parent, child);
  assert.match(explanation.title, /parent #2/);
  assert.match(explanation.lines[0], /Removed parent row 0: Try to reproduce/);
  assert.match(explanation.lines[1], /Turn right → Turn around/);
  assert.ok(explanation.lines.some(line => line.includes('cannot make children')));
  assert.match(inheritedChanges(null, parent).lines[0], /written by us/);
  assert.equal(instructionLabel(0xcb, 5, 6), 'Jump to row 1');
});
