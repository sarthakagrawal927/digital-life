import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, snapshot, assertAccounting } from '../src/engine.mjs';
import { LiveSession, PRESETS, SESSION_LIMITS } from '../src/session.mjs';

test('live accelerated batches match headless execution, including random streams and lineage', () => {
  const session = new LiveSession({ seed: 4 });
  const world = createWorld(PRESETS.baseline.configuration, 4);
  for (let i = 0; i < 300; i++) step(world);
  for (const count of [120, 120, 60]) session.advance(count);
  assert.deepEqual(session.export(), snapshot(world));
  assertAccounting(session.world);
});
test('checkpoint rewind resumes the exact same future and discards future branch samples', () => {
  const session = new LiveSession({ seed: 4 });
  session.advance(100); session.advance(100); const expected = session.export();
  session.rewind(100); assert.ok(session.trends.every(m => m.tick <= 100));
  session.advance(100); assert.deepEqual(session.export(), expected);
});
test('import resumes complete state and pauses correctly at a conservative compute boundary', () => {
  const session = new LiveSession({ instructionBudget: 13 });
  session.advance(120); assert.equal(session.termination, 'instruction-budget');
  assert.ok(session.world.stats.instructions <= 13);
  const imported = new LiveSession({ world: JSON.stringify(session.export()) });
  const headless = createWorld(PRESETS.baseline.configuration, 4);
  for (let i = 0; i < session.world.tick + 10; i++) step(headless);
  imported.advance(10); assert.deepEqual(imported.export(), snapshot(headless));
  assert.throws(() => session.advance(121));
});
test('checkpoints, trends, lifecycle events and selected ancestry remain bounded', () => {
  const session = new LiveSession({ configuration: { patchPermille: 1000, material: 100, maxPopulation: 1024 }, seed: 4 });
  for (let i = 0; i < 16; i++) session.advance(100);
  assert.ok(session.checkpoints.length <= SESSION_LIMITS.checkpoints);
  assert.ok(session.checkpointBytes <= SESSION_LIMITS.checkpointBytes);
  assert.ok(session.events.length <= 96);
  const view = session.view(session.world.organisms.at(-1)?.id);
  assert.ok(view.ancestry.length <= 12);
  assert.throws(() => session.rewind(-1));
});
test('stress presets alter only the intended world rule and keep the source map matched', () => {
  const a = new LiveSession({ configuration: PRESETS.baseline.configuration, seed: 42 });
  for (const name of ['energy', 'material']) {
    const b = new LiveSession({ configuration: PRESETS[name].configuration, seed: 42 });
    assert.deepEqual(a.world.cells, b.world.cells);
    const changes = Object.keys(a.world.config).filter(k => a.world.config[k] !== b.world.config[k]);
    assert.deepEqual(changes, [name === 'energy' ? 'regeneration' : 'material']);
  }
});

test('rewinding before a selected birth falls back to a real specimen; death remains inspectable', () => {
  const session = new LiveSession({ seed:4 }); session.advance(10);
  const descendantId=session.world.lineage[1].id;
  session.rewind(0);const earlier=session.view(descendantId,false);
  assert.equal(earlier.selectedRecord.id,1); assert.equal(earlier.selected.id,1);
  session.advance(10); const dead=session.view(1,false);
  assert.equal(dead.selected,null);assert.equal(dead.selectedRecord.died,7);
  const follow=session.view(1,true);assert.ok(follow.selected);assert.notEqual(follow.selected.id,1);
});
