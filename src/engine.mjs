// No I/O, eval, callbacks supplied by organisms, or dynamic allocations from bytecode.
export const VERSION = 1;
export const OPS = ['NOP', 'HARVEST', 'TURN', 'MOVE', 'SENSE', 'SET', 'ADD', 'LOAD', 'STORE', 'REPRODUCE', 'IF_ZERO', 'IF_POSITIVE', 'JUMP', 'SUB', 'MOD', 'YIELD'];
export const SEED_PROGRAM = [0x10, 0x10, 0x90, 0x30, 0x21, 0xcb];
export const DEFAULT_CONFIG = Object.freeze({
  width: 24, height: 24, patchPermille: 250, patchCapacity: 4000,
  regeneration: 80, material: 6000, memorySize: 8,
  initialEnergy: 1000, childEnergy: 500, maxEnergy: 20000,
  instructionsPerTick: 12, upkeepPerUnit: 1, instructionCost: 1,
  senseCost: 2, moveCost: 4, harvestCost: 3, harvestAmount: 500,
  reproductionCost: 20, copyCostPerUnit: 2,
  substitutionPermille: 10, insertionPermille: 2, deletionPermille: 2,
  maxGenome: 128, maxPopulation: 256, maxBirths: 100000,
});
const integer = (v, low, high, key) => {
  if (!Number.isSafeInteger(v) || v < low || v > high) throw new Error(`Invalid ${key}: expected integer ${low}..${high}`);
};
export function config(overrides = {}) {
  if (!overrides || Array.isArray(overrides) || typeof overrides !== 'object') throw new Error('Configuration must be an object');
  for (const key of Object.keys(overrides)) if (!(key in DEFAULT_CONFIG)) throw new Error(`Unknown configuration key ${key}`);
  const c = { ...DEFAULT_CONFIG, ...overrides };
  for (const [key, value] of Object.entries(c)) integer(value, 0, 1000000, key);
  for (const key of ['width', 'height']) integer(c[key], 1, 128, key);
  integer(c.memorySize, 1, 64, 'memorySize');
  integer(c.maxGenome, 1, 256, 'maxGenome');
  integer(c.maxPopulation, 1, 2048, 'maxPopulation');
  integer(c.maxBirths, 1, 100000, 'maxBirths');
  integer(c.instructionsPerTick, 1, 64, 'instructionsPerTick');
  for (const key of ['patchPermille', 'substitutionPermille', 'insertionPermille', 'deletionPermille']) integer(c[key], 0, 1000, key);
  if (c.initialEnergy > c.maxEnergy || c.childEnergy > c.maxEnergy) throw new Error('Starting energy exceeds reserve cap');
  return c;
}
function random(w, stream) {
  let x = w.random[stream] >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  w.random[stream] = x >>> 0;
  return (x >>> 0) / 4294967296;
}
const roll = (w, stream, n) => Math.floor(random(w, stream) * n);
const signed = a => a < 8 ? a : a - 16;
const wrap = (n, length) => ((n % length) + length) % length;
const unitSize = (w, genome) => genome.length + w.config.memorySize;
export const genomeKey = genome => genome.map(b => b.toString(16).padStart(2, '0')).join('');
export function disassemble(genome) {
  return genome.map((b, pc) => ({ pc, byte: b, opcode: OPS[b >> 4], argument: (b >> 4) >= 10 && (b >> 4) <= 12 ? signed(b & 15) : b & 15 }));
}
export function validateProgram(genome, max = 256) {
  if (!Array.isArray(genome) || !genome.length || genome.length > max) throw new Error('Invalid genome length');
  genome.forEach(b => integer(b, 0, 255, 'byte'));
}
function birth(w, genome, energy, x, y, parent = null, mutations = []) {
  const id = w.nextId++;
  const o = { id, parentId: parent?.id ?? null, lineageId: parent?.lineageId ?? id,
    generation: parent ? parent.generation + 1 : 0, genome: [...genome],
    memory: Array(w.config.memorySize).fill(0), energy, x, y, direction: parent?.direction ?? 0,
    pc: 0, accumulator: 0, age: 0, born: w.tick };
  w.freeMaterial -= unitSize(w, genome);
  w.organisms.push(o);
  w.lineage.push({ id, parentId: o.parentId, lineageId: o.lineageId, generation: o.generation,
    born: w.tick, died: null, genome: [...genome], mutations });
  return o;
}
export function createWorld(overrides = {}, seed = 1, genome = SEED_PROGRAM) {
  const c = config(overrides);
  integer(seed, 0, 4294967295, 'seed'); validateProgram(genome, c.maxGenome);
  if (c.material < genome.length + c.memorySize) throw new Error('Insufficient material for founder');
  const nonzero = n => (n >>> 0) || 0x6d2b79f5;
  const w = { version: VERSION, config: c, seed, tick: 0, nextId: 1,
    random: { environment: nonzero(seed ^ 0xa341316c), schedule: nonzero(seed ^ 0xc8013ea4), mutation: nonzero(seed ^ 0xad90777d) },
    cells: [], organisms: [], lineage: [], freeMaterial: c.material,
    ledger: { supplied: c.initialEnergy, spent: 0, dissipated: 0 },
    stats: { births: 0, deaths: 0, instructions: 0, harvested: 0, failedReproductions: 0, mutations: 0,
      costs: { upkeep: 0, instruction: 0, sense: 0, move: 0, harvest: 0, reproduction: 0 } }, halted: null };
  for (let i = 0; i < c.width * c.height; i++) {
    const source = roll(w, 'environment', 1000) < c.patchPermille;
    const energy = source ? c.patchCapacity : 0;
    w.cells.push({ source, energy }); w.ledger.supplied += energy;
  }
  const sourceIndex = w.cells.findIndex(cell => cell.source);
  const start = sourceIndex < 0 ? 0 : sourceIndex;
  birth(w, genome, c.initialEnergy, start % c.width, Math.floor(start / c.width));
  return w;
}
// Observer data never enters the world, snapshots, RNG streams, or organism memory.
function observe(observation, channel, event) {
  if (observation?.[channel]?.length < 96) observation[channel].push({ ...event, sequence: observation[channel].length });
}
function kill(w, o, reason = null, observation = null) {
  if (o.dead) return;
  observe(observation, 'events', { type: 'death', id: o.id, tick: w.tick, x: o.x, y: o.y,
    reason, remainingEnergy: o.energy, material: unitSize(w, o.genome) });
  o.dead = true; w.freeMaterial += unitSize(w, o.genome);
  w.ledger.dissipated += o.energy; o.energy = 0; w.stats.deaths++;
  w.lineage[o.id - 1].died = w.tick;
}
function pay(w, o, amount, category, observation = null) {
  if (o.energy < amount) { kill(w, o, { category, required: amount, available: o.energy }, observation); return false; }
  o.energy -= amount; w.ledger.spent += amount; w.stats.costs[category] += amount;
  return true;
}
function mutate(w, genome) {
  const c = w.config, result = [], changes = [];
  for (let i = 0; i < genome.length; i++) {
    if (roll(w, 'mutation', 1000) < c.deletionPermille) { changes.push({ type: 'deletion', index: i, from: genome[i] }); continue; }
    let byte = genome[i];
    if (roll(w, 'mutation', 1000) < c.substitutionPermille) {
      byte = (byte + 1 + roll(w, 'mutation', 255)) % 256;
      changes.push({ type: 'substitution', index: i, from: genome[i], to: byte });
    }
    result.push(byte);
    if (result.length < c.maxGenome && roll(w, 'mutation', 1000) < c.insertionPermille) {
      const inserted = roll(w, 'mutation', 256); result.push(inserted);
      changes.push({ type: 'insertion', after: i, to: inserted });
    }
  }
  // Invalid empty/oversize genomes are rejected, never repaired into viable code.
  return { genome: result, changes };
}
function reproduce(w, o, observation = null) {
  const c = w.config;
  if (w.lineage.length >= c.maxBirths) { w.halted = 'birth-history-budget'; return { reason: 'history-limit' }; }
  if (w.organisms.filter(x => !x.dead).length >= c.maxPopulation) { w.stats.failedReproductions++; return { reason: 'population-limit' }; }
  const child = mutate(w, o.genome), size = unitSize(w, child.genome);
  const cost = c.reproductionCost + c.copyCostPerUnit * size;
  if (!child.genome.length || child.genome.length > c.maxGenome || size > w.freeMaterial || o.energy < c.childEnergy + cost) {
    w.stats.failedReproductions++;
    return { reason: !child.genome.length || child.genome.length > c.maxGenome ? 'invalid-copy' : size > w.freeMaterial ? 'material' : 'energy',
      requiredEnergy: c.childEnergy + cost, availableEnergy: o.energy, requiredMaterial: size, availableMaterial: w.freeMaterial };
  }
  pay(w, o, cost, 'reproduction'); o.energy -= c.childEnergy;
  const offspring = birth(w, child.genome, c.childEnergy, o.x, o.y, o, child.changes);
  w.stats.births++; w.stats.mutations += child.changes.length;
  const result = { childId: offspring.id, transferredEnergy: c.childEnergy, copyCost: cost, material: size, changes: child.changes };
  observe(observation, 'events', { type: 'birth', id: offspring.id, parentId: o.id, tick: w.tick, x: o.x, y: o.y, mutations: child.changes.length,
    transferredEnergy: c.childEnergy, copyCost: cost, material: size });
  return result;
}
const cellAt = (w, x, y) => w.cells[y * w.config.width + x];
function neighbor(w, o, relative = 0) {
  const direction = (o.direction + relative) % 4;
  return { x: wrap(o.x + [0, 1, 0, -1][direction], w.config.width), y: wrap(o.y + [-1, 0, 1, 0][direction], w.config.height) };
}
const observedState = o => ({ x: o.x, y: o.y, direction: o.direction, energy: o.energy, pc: o.pc, accumulator: o.accumulator, dead: Boolean(o.dead) });
function localCells(w, position) {
  const cells = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = wrap(position.x + dx, w.config.width), y = wrap(position.y + dy, w.config.height);
    cells.push({ dx, dy, x, y, ...cellAt(w, x, y) });
  }
  return cells;
}
function instruction(w, o, observation = null) {
  const c = w.config;
  const tracked = observation?.selectedId === o.id && observation.actions.length < 96;
  const before = tracked ? observedState(o) : null, patchBefore = tracked ? cellAt(w, o.x, o.y).energy : 0;
  const finish = (detail = {}) => {
    if (tracked) observe(observation, 'actions', { id: o.id, tick: w.tick, opcode: OPS[byte >> 4], byte, argument: byte & 15,
      before, after: observedState(o), cells: localCells(w, before), ...detail });
  };
  const byte = o.genome[o.pc], op = byte >> 4, a = byte & 15;
  if (!pay(w, o, c.instructionCost, 'instruction', observation)) { finish({ death: { category: 'instruction', required: c.instructionCost, available: before?.energy } }); return false; }
  w.stats.instructions++;
  let detail = {};
  o.pc = (o.pc + 1) % o.genome.length;
  if (op === 1 && pay(w, o, c.harvestCost, 'harvest', observation)) {
    const cell = cellAt(w, o.x, o.y), amount = Math.min(c.harvestAmount, cell.energy, c.maxEnergy - o.energy);
    cell.energy -= amount; o.energy += amount; w.stats.harvested += amount;
    detail = { harvested: amount, patchBefore, patchAfter: cell.energy };
    if (tracked && amount) observe(observation, 'events', { type: 'harvest', id: o.id, tick: w.tick, x: o.x, y: o.y, amount });
  } else if (op === 2) o.direction = (o.direction + a) % 4;
  else if (op === 3 && pay(w, o, c.moveCost, 'move', observation)) {
    const from = tracked ? { x: o.x, y: o.y } : null;
    Object.assign(o, neighbor(w, o, a % 4));
    if (tracked) observe(observation, 'events', { type: 'move', id: o.id, tick: w.tick, x: o.x, y: o.y, from });
  } else if (op === 4 && pay(w, o, c.senseCost, 'sense', observation)) {
    if (a === 0) o.accumulator = cellAt(w, o.x, o.y).energy;
    else if (a === 1) o.accumulator = o.energy;
    else if (a === 2) o.accumulator = w.freeMaterial;
    else { const p = neighbor(w, o, (a - 3) % 4); o.accumulator = cellAt(w, p.x, p.y).energy; }
  } else if (op === 5) o.accumulator = a;
  else if (op === 6) o.accumulator += a;
  else if (op === 7) o.accumulator = o.memory[a % c.memorySize];
  else if (op === 8) o.memory[a % c.memorySize] = o.accumulator;
  else if (op === 9) detail = { reproduction: reproduce(w, o, observation) };
  else if (op === 12 || (op === 10 && o.accumulator === 0) || (op === 11 && o.accumulator > 0)) o.pc = wrap(o.pc + signed(a), o.genome.length);
  else if (op === 13) o.accumulator -= a;
  else if (op === 14) o.accumulator %= a || 1;
  o.accumulator = Math.max(-32768, Math.min(32767, o.accumulator));
  if (tracked && o.dead) {
    const category = op === 1 ? 'harvest' : op === 3 ? 'move' : 'sense';
    detail.death = { category, required: c[`${category}Cost`], available: before.energy - c.instructionCost };
  }
  finish(detail);
  return op !== 15 && !o.dead && !w.halted;
}
export function step(w, observation = null) {
  if (w.halted) return metrics(w);
  if (w.tick >= 100000) { w.halted = 'world-tick-limit'; return metrics(w); }
  if (!w.organisms.length) { w.halted = 'extinction'; return metrics(w); }
  w.tick++;
  for (const cell of w.cells) if (cell.source) {
    const added = Math.min(w.config.regeneration, w.config.patchCapacity - cell.energy);
    cell.energy += added; w.ledger.supplied += added;
  }
  const scheduled = [...w.organisms];
  for (let i = scheduled.length - 1; i > 0; i--) {
    const j = roll(w, 'schedule', i + 1); [scheduled[i], scheduled[j]] = [scheduled[j], scheduled[i]];
  }
  for (const o of scheduled) {
    o.age++;
    const upkeep = unitSize(w, o.genome) * w.config.upkeepPerUnit;
    const before = observation?.selectedId === o.id ? observedState(o) : null;
    const paid = pay(w, o, upkeep, 'upkeep', observation);
    if (before) observe(observation, 'actions', { id: o.id, tick: w.tick, opcode: 'UPKEEP', before, after: observedState(o), cells: localCells(w, before),
      cost: upkeep, ...(!paid ? { death: { category: 'upkeep', required: upkeep, available: before.energy } } : {}) });
    if (!paid) continue;
    for (let i = 0; i < w.config.instructionsPerTick; i++) if (!instruction(w, o, observation)) break;
    if (w.halted) break;
  }
  w.organisms = w.organisms.filter(o => !o.dead);
  if (!w.organisms.length) w.halted = 'extinction';
  assertAccounting(w);
  return metrics(w);
}
export function assertAccounting(w) {
  const occupied = w.organisms.reduce((n, o) => n + unitSize(w, o.genome), 0);
  const energy = w.cells.reduce((n, c) => n + c.energy, 0) + w.organisms.reduce((n, o) => n + o.energy, 0);
  if (occupied + w.freeMaterial !== w.config.material || w.freeMaterial < 0) throw new Error('Material conservation violated');
  if (energy + w.ledger.spent + w.ledger.dissipated !== w.ledger.supplied) throw new Error('Energy conservation violated');
  return { material: { total: w.config.material, occupied, free: w.freeMaterial }, energy: { supplied: w.ledger.supplied, present: energy, spent: w.ledger.spent, dissipated: w.ledger.dissipated } };
}
export function metrics(w) {
  return { tick: w.tick, population: w.organisms.length, births: w.stats.births, deaths: w.stats.deaths,
    instructions: w.stats.instructions, energyExpenditure: w.ledger.spent,
    environmentalEnergy: w.cells.reduce((n, c) => n + c.energy, 0), organismEnergy: w.organisms.reduce((n, o) => n + o.energy, 0),
    freeMaterial: w.freeMaterial, genomeDiversity: new Set(w.organisms.map(o => genomeKey(o.genome))).size,
    survivingLineages: new Set(w.organisms.map(o => o.lineageId)).size,
    lineagePersistenceTicks: w.organisms.length ? Math.max(...w.organisms.map(o => w.tick - w.lineage[o.lineageId - 1].born)) : 0,
    oldestLivingGeneration: w.organisms.length ? Math.min(...w.organisms.map(o => o.generation)) : null,
    maxGeneration: Math.max(0, ...w.organisms.map(o => o.generation)), halted: w.halted };
}
export function snapshot(w) { return JSON.parse(JSON.stringify(w)); }
export function restore(input) {
  const w = typeof input === 'string' ? JSON.parse(input) : snapshot(input);
  if (w.version !== VERSION) throw new Error('Unsupported snapshot version');
  w.config = config(w.config);
  integer(w.tick, 0, 100000, 'tick'); integer(w.seed, 0, 4294967295, 'seed');
  const c = w.config;
  integer(w.freeMaterial, 0, c.material, 'free material');
  if (![null, 'extinction', 'birth-history-budget', 'world-tick-limit'].includes(w.halted)) throw new Error('Invalid halt reason');
  if (!Array.isArray(w.cells) || w.cells.length !== c.width * c.height || !Array.isArray(w.organisms) || w.organisms.length > c.maxPopulation || !Array.isArray(w.lineage) || w.lineage.length > c.maxBirths) throw new Error('Snapshot bounds invalid');
  if (w.nextId !== w.lineage.length + 1 || !['environment', 'schedule', 'mutation'].every(k => Number.isInteger(w.random?.[k]) && w.random[k] > 0 && w.random[k] <= 4294967295)) throw new Error('Snapshot identity/random state invalid');
  for (const cell of w.cells) {
    if (typeof cell.source !== 'boolean') throw new Error('Invalid source');
    integer(cell.energy, 0, cell.source ? c.patchCapacity : 0, 'cell energy');
  }
  const ids = new Set();
  for (const [index, record] of w.lineage.entries()) {
    if (record.id !== index + 1 || (record.parentId !== null && (!Number.isInteger(record.parentId) || record.parentId < 1 || record.parentId >= record.id))) throw new Error('Invalid ancestry');
    validateProgram(record.genome, c.maxGenome);
    const parent = record.parentId === null ? null : w.lineage[record.parentId - 1];
    if (record.generation !== (parent ? parent.generation + 1 : 0) || record.lineageId !== (parent?.lineageId ?? record.id)) throw new Error('Invalid lineage metadata');
    integer(record.born, 0, w.tick, 'birth tick');
    if (record.died !== null) integer(record.died, record.born, w.tick, 'death tick');
    if (!Array.isArray(record.mutations) || record.mutations.length > c.maxGenome * 2) throw new Error('Invalid mutation records');
  }
  for (const o of w.organisms) {
    validateProgram(o.genome, c.maxGenome);
    integer(o.id, 1, w.lineage.length, 'organism id');
    if (ids.has(o.id) || o.dead || !Array.isArray(o.memory) || o.memory.length !== c.memorySize || genomeKey(w.lineage[o.id - 1].genome) !== genomeKey(o.genome)) throw new Error('Invalid organism');
    ids.add(o.id); o.memory.forEach(v => integer(v, -32768, 32767, 'memory'));
    const record = w.lineage[o.id - 1];
    if (record.died !== null || ['parentId', 'lineageId', 'generation', 'born'].some(k => o[k] !== record[k])) throw new Error('Organism ancestry differs from history');
    integer(o.energy, 0, c.maxEnergy, 'reserve'); integer(o.x, 0, c.width - 1, 'x'); integer(o.y, 0, c.height - 1, 'y');
    integer(o.pc, 0, o.genome.length - 1, 'pc'); integer(o.direction, 0, 3, 'direction'); integer(o.accumulator, -32768, 32767, 'accumulator');
    integer(o.age, 0, w.tick, 'age');
  }
  for (const key of ['supplied', 'spent', 'dissipated']) integer(w.ledger?.[key], 0, Number.MAX_SAFE_INTEGER, key);
  for (const key of ['births', 'deaths', 'instructions', 'harvested', 'failedReproductions', 'mutations']) integer(w.stats?.[key], 0, Number.MAX_SAFE_INTEGER, key);
  for (const key of ['upkeep', 'instruction', 'sense', 'move', 'harvest', 'reproduction']) integer(w.stats.costs?.[key], 0, Number.MAX_SAFE_INTEGER, key);
  if (w.stats.births !== w.lineage.length - 1 || w.stats.deaths !== w.lineage.length - w.organisms.length) throw new Error('History counters inconsistent');
  assertAccounting(w); return w;
}
