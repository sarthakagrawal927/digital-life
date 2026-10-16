import { createWorld, step, metrics, snapshot, restore, assertAccounting, SEED_PROGRAM } from './engine.mjs';

export const SESSION_LIMITS = Object.freeze({ instructions: 10000000, ticks: 10000, checkpoints: 12, checkpointBytes: 8 * 1024 * 1024, importBytes: 64 * 1024 * 1024 });
export const PRESETS = Object.freeze({
  baseline: { title: 'Resource ecology', configuration: { maxPopulation: 1024 } },
  energy: { title: 'Energy scarcity', configuration: { maxPopulation: 1024, regeneration: 20 } },
  material: { title: 'Material scarcity', configuration: { maxPopulation: 1024, material: 280 } },
});
const bounded = (n, min, max, label) => {
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`Invalid ${label}: expected ${min}..${max}`);
};

// Shared by Node verification and the browser worker. Presentation never alters VM state.
export class LiveSession {
  constructor({ configuration = PRESETS.baseline.configuration, seed = 4, program = SEED_PROGRAM, world = null,
    instructionBudget = SESSION_LIMITS.instructions, tickBudget = SESSION_LIMITS.ticks } = {}) {
    bounded(instructionBudget, 1, SESSION_LIMITS.instructions, 'instruction budget');
    bounded(tickBudget, 1, SESSION_LIMITS.ticks, 'tick budget');
    this.world = world ? restore(world) : createWorld(configuration, seed, program);
    this.program = [...(world ? this.world.lineage[0].genome : program)];
    this.instructionBudget = instructionBudget; this.tickBudget = tickBudget;
    this.startInstructions = this.world.stats.instructions; this.startTick = this.world.tick;
    this.termination = null; this.trends = []; this.events = []; this.actions = []; this.observedId = null; this.checkpoints = []; this.checkpointBytes = 0;
    this.sample(); this.checkpoint();
  }
  sample() {
    const w = this.world, m = metrics(w);
    const previous = this.trends.at(-1);
    if (previous?.tick === m.tick) return;
    this.trends.push({ ...m, suppliedEnergy: w.ledger.supplied, harvested: w.stats.harvested });
    if (this.trends.length > 1001) this.trends.splice(1, 1); // retain the initial baseline
  }
  checkpoint() {
    const json = JSON.stringify(snapshot(this.world)), bytes = json.length * 2;
    if (bytes > SESSION_LIMITS.checkpointBytes) return;
    if (this.checkpoints.at(-1)?.tick === this.world.tick) return;
    this.checkpoints.push({ tick: this.world.tick, json, bytes }); this.checkpointBytes += bytes;
    while (this.checkpoints.length > SESSION_LIMITS.checkpoints || this.checkpointBytes > SESSION_LIMITS.checkpointBytes) {
      this.checkpointBytes -= this.checkpoints.shift().bytes;
    }
  }
  advance(count = 1, selectedId = null, followLiving = false) {
    bounded(count, 1, 120, 'tick batch');
    const w = this.world;
    for (let i = 0; i < count && !w.halted && !this.termination; i++) {
      if (w.tick - this.startTick >= this.tickBudget) { this.termination = 'tick-budget'; break; }
      if (w.stats.instructions - this.startInstructions + w.organisms.length * w.config.instructionsPerTick > this.instructionBudget) {
        this.termination = 'instruction-budget'; break;
      }
      const id = !w.lineage[selectedId - 1] || (followLiving && !w.organisms.some(o => o.id === selectedId)) ? w.organisms[0]?.id ?? null : selectedId;
      if (id !== this.observedId) { this.actions = []; this.observedId = id; }
      const observation = { selectedId: id, actions: [], events: [] };
      step(w, observation);
      if (observation.actions.length) this.actions = observation.actions; // last executed tick, retained after death
      this.events.push(...observation.events);
      if (this.events.length > 96) this.events.splice(0, this.events.length - 96);
      if (w.tick % 10 === 0) this.sample();
      if (w.tick % 100 === 0) this.checkpoint();
    }
    this.sample();
    return this.view();
  }
  rewind(tick) {
    const checkpoint = this.checkpoints.find(c => c.tick === tick);
    if (!checkpoint) throw new Error('Checkpoint is no longer retained; import a saved snapshot instead.');
    const w = restore(checkpoint.json);
    this.world = w; this.termination = null; this.events = []; this.actions = []; this.observedId = null;
    this.trends = this.trends.filter(m => m.tick <= tick);
    this.checkpoints = this.checkpoints.filter(c => c.tick <= tick);
    this.checkpointBytes = this.checkpoints.reduce((n, c) => n + c.bytes, 0);
    // A rewind is the same experiment, with the same original compute allowance.
    this.sample(); return this.view();
  }
  view(selectedId = null, followLiving = false) {
    const w = this.world;
    const id = !w.lineage[selectedId - 1] || (followLiving && !w.organisms.some(o => o.id === selectedId)) ? w.organisms[0]?.id ?? (w.lineage[selectedId - 1] ? selectedId : this.observedId) : selectedId;
    const organism = w.organisms.find(o => o.id === id) ?? null;
    let record = id ? w.lineage[id - 1] : null;
    const selectedRecord = record ?? null, ancestry = [];
    while (record && ancestry.length < 12) { ancestry.unshift(record); record = record.parentId ? w.lineage[record.parentId - 1] : null; }
    return { version: 1, seed: w.seed, tick: w.tick, founderProgram: this.program, config: w.config, cells: w.cells, organisms: w.organisms,
      stats: w.stats, ledger: w.ledger, freeMaterial: w.freeMaterial, summary: metrics(w), accounting: assertAccounting(w),
      termination: w.halted ?? this.termination, populationLimited: w.organisms.length >= w.config.maxPopulation,
      selected: organism, selectedRecord, selectedParent: selectedRecord?.parentId ? w.lineage[selectedRecord.parentId - 1] : null,
      actions: this.observedId === id ? this.actions : [], changedAtBirth: w.organisms.filter(o => w.lineage[o.id - 1].mutations.length).map(o => o.id), ancestry, ancestryTruncated: Boolean(record),
      trends: this.trends, events: this.events, checkpoints: this.checkpoints.map(c => c.tick),
      budget: { instructions: this.instructionBudget, ticks: this.tickBudget, startTick: this.startTick, startInstructions: this.startInstructions },
    };
  }
  export() { return snapshot(this.world); }
}
