const directions = ['north', 'east', 'south', 'west'];
const signed = a => a < 8 ? a : a - 16;
const n = value => Number(value).toLocaleString('en-US');
export function instructionLabel(byte, pc = null, length = null, memorySize = null) {
  const op = byte >> 4, a = byte & 15;
  const target = length ? ((pc + 1 + signed(a)) % length + length) % length : null;
  return [
    'Do nothing', 'Harvest local energy', ['Keep facing', 'Turn right', 'Turn around', 'Turn left'][a % 4],
    ['Move forward', 'Move right of facing', 'Move backward', 'Move left of facing'][a % 4],
    a === 0 ? 'Sense local energy' : a === 1 ? 'Sense own reserve' : a === 2 ? 'Sense free material' : 'Sense neighboring energy',
    `Set internal value to ${a}`, `Add ${a} to internal value`, memorySize ? `Read memory slot ${a % memorySize}` : `Read memory at index ${a} (wraps)`, memorySize ? `Write memory slot ${a % memorySize}` : `Write memory at index ${a} (wraps)`,
    'Try to reproduce', target === null ? `Branch ${signed(a)} if zero` : `Go to row ${target} if zero`, target === null ? `Branch ${signed(a)} if positive` : `Go to row ${target} if positive`, target === null ? `Jump ${signed(a)} rows` : `Jump to row ${target}`,
    `Subtract ${a} from internal value`, `Remainder by ${a || 1}`, 'End this tick’s actions',
  ][op];
}
export function explainAction(action) {
  const a = action, b = a.before, after = a.after, delta = after.energy - b.energy;
  const reserve = `${n(b.energy)} → ${n(after.energy)} energy (${delta > 0 ? '+' : ''}${n(delta)}).`;
  if (a.death) {
    const names = { upkeep: 'upkeep', instruction: 'the next instruction', harvest: 'harvesting', move: 'movement', sense: 'sensing' };
    return { symbol: '×', title: `Died: could not pay for ${names[a.death.category]}.`,
      body: `Needed ${n(a.death.required)} energy; had ${n(a.death.available)} at that payment. Its material was returned to the shared pool. Remaining energy dissipated.`, reserve };
  }
  if (a.opcode === 'UPKEEP') return { symbol: '−', title: 'Paid to stay alive.', body: `${n(a.cost)} energy paid for its program and working memory this tick.`, reserve };
  if (a.opcode === 'HARVEST') return { symbol: '↓', title: a.harvested ? `Harvested ${n(a.harvested)} energy.` : 'Harvested no energy.',
    body: `Cell ${b.x},${b.y}: ${n(a.patchBefore)} → ${n(a.patchAfter)} energy. The instruction and harvest costs are included in the reserve change.`, reserve };
  if (a.opcode === 'MOVE') return { symbol: '→', title: `Moved from ${b.x},${b.y} to ${after.x},${after.y}.`, body: `${instructionLabel(a.byte)}. Movement costs energy; world edges wrap.`, reserve };
  if (a.opcode === 'TURN') return { symbol: '↻', title: `Facing ${directions[after.direction]}.`, body: `Previously facing ${directions[b.direction]}. ${instructionLabel(a.byte)}.`, reserve };
  if (a.opcode === 'REPRODUCE') {
    const r = a.reproduction;
    if (r.childId) return { symbol: '⊕', title: `Made child #${r.childId}${r.changes.length ? ' with inherited changes' : ' as an exact copy'}.`,
      body: `${n(r.transferredEnergy)} energy transferred to the child; ${n(r.copyCost)} spent copying; ${n(r.material)} material allocated. ${r.changes.length} instruction change${r.changes.length === 1 ? '' : 's'} at birth.`, reserve };
    const failure = { energy: `Needs ${n(r.requiredEnergy)} energy for copying and the child’s reserve; has ${n(r.availableEnergy)} after instruction cost.`,
      material: `Needs ${n(r.requiredMaterial)} free material; only ${n(r.availableMaterial)} is available.`,
      'invalid-copy': 'The mutated copy was empty or too large.', 'population-limit': 'The configured population safeguard blocks another child.', 'history-limit': 'The configured lineage-history limit has been reached.' };
    return { symbol: '⊕', title: 'Tried to reproduce. No child was made.', body: failure[r.reason], reserve };
  }
  if (a.opcode === 'SENSE') return { symbol: '?', title: instructionLabel(a.byte) + '.', body: `Read ${n(after.accumulator)} into its internal value. Sensing and execution costs are included below.`, reserve };
  if (['JUMP', 'IF_ZERO', 'IF_POSITIVE'].includes(a.opcode)) {
    const taken = a.opcode === 'JUMP' || (a.opcode === 'IF_ZERO' ? b.accumulator === 0 : b.accumulator > 0);
    return { symbol: '↰', title: taken ? `Branched to instruction ${after.pc}.` : 'Branch condition was false.', body: `Internal value: ${n(b.accumulator)}. Next instruction: ${after.pc}.`, reserve };
  }
  return { symbol: a.opcode === 'YIELD' ? 'Ⅱ' : '·', title: instructionLabel(a.byte) + '.', body: `Internal value ${n(b.accumulator)} → ${n(after.accumulator)}. ${a.opcode === 'YIELD' ? 'This organism stops executing until the next tick.' : 'Execution still costs energy.'}`, reserve };
}
export function inheritedChanges(parent, record) {
  if (!parent) return { title: 'The supplied founder', lines: ['This initial routine was written by us; it did not evolve from scratch.'] };
  if (!record.mutations.length) return { title: `Exact copy of parent #${parent.id}`, lines: ['No inherited instruction changes at this birth. Working memory starts empty.'] };
  const lines = record.mutations.map(m => m.type === 'substitution'
    ? `Parent row ${m.index}: ${instructionLabel(m.from)} → ${instructionLabel(m.to)}.`
    : m.type === 'deletion' ? `Removed parent row ${m.index}: ${instructionLabel(m.from)}.` : `Inserted after parent row ${m.after}: ${instructionLabel(m.to)}.`);
  const ops = record.genome.map(b => b >> 4);
  if (!ops.includes(9)) lines.push('No reproduction instruction remains: this program cannot make children.');
  if (!ops.includes(1)) lines.push('No harvesting instruction remains: this program cannot refill its own reserve.');
  return { title: `Changed instructions from parent #${parent.id}`, lines };
}
