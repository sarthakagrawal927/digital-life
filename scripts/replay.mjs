import { readFile, stat, writeFile } from 'node:fs/promises';
import { restore, step, snapshot, metrics } from '../src/engine.mjs';
const [input, count = '100', output = 'results/replay.json', ...extra] = process.argv.slice(2);
const ticks = Number(count);
if (!input || extra.length || !Number.isSafeInteger(ticks) || ticks < 1 || ticks > 100000) throw new Error('Usage: pnpm replay snapshot-or-run.json [1..100000 ticks] [output.json]');
if ((await stat(input)).size > 64 * 1024 * 1024) throw new Error('Replay input exceeds 64 MiB import limit');
const data = JSON.parse(await readFile(input, 'utf8'));
const world = restore(data.snapshots ? data.snapshots.at(-1) : data.snapshot ?? data);
const initialInstructions = world.stats.instructions;
let termination = 'tick-budget';
for (let tick = 0; tick < ticks && !world.halted; tick++) {
  if (world.stats.instructions - initialInstructions + world.organisms.length * world.config.instructionsPerTick > 1000000) { termination = 'instruction-budget'; break; }
  step(world);
}
await writeFile(output, JSON.stringify({ termination: world.halted ?? termination, summary: metrics(world), snapshot: snapshot(world) }));
console.log(`Replay saved to ${output}; tick ${world.tick}; ${world.halted ?? termination}`);
