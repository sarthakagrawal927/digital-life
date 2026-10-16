import { LiveSession, SESSION_LIMITS } from './session.mjs';
import { run, NO_MUTATION, candidates, evaluate } from './experiment.mjs';
import { SEED_PROGRAM } from './engine.mjs';
let session, comparison;
const reply = (id, result) => postMessage({ id, result });
self.onmessage = async ({ data: { id, action, payload = {} } }) => {
  try {
    if (action === 'init') { session = new LiveSession(payload); reply(id, session.view()); }
    else if (action === 'advance') { session.advance(payload.count, payload.selectedId, payload.followLiving); reply(id, session.view(payload.selectedId, payload.followLiving)); }
    else if (action === 'inspect') reply(id, session.view(payload.selectedId, payload.followLiving));
    else if (action === 'rewind') { session.rewind(payload.tick); reply(id, session.view(payload.selectedId, payload.followLiving)); }
    else if (action === 'snapshot') reply(id, session.export());
    else if (action === 'restore') {
      if (typeof payload.json !== 'string' || payload.json.length * 2 > SESSION_LIMITS.importBytes) throw new Error('Snapshot exceeds the 64 MiB import limit.');
      const parsed=JSON.parse(payload.json),world=Array.isArray(parsed.snapshots)?parsed.snapshots.at(-1):parsed;
      session = new LiveSession({ world }); reply(id, session.view());
    } else if (action === 'compare') {
      if (!Array.isArray(payload.seeds) || payload.seeds.length < 1 || payload.seeds.length > 5) throw new Error('Choose 1..5 seeds.');
      const ticks = payload.ticks ?? 1000;
      if (!Number.isSafeInteger(ticks) || ticks < 1 || ticks > 1000) throw new Error('Browser experiment limit is 1,000 ticks per arm.');
      comparison = null; const pairs = [];
      for (const seed of payload.seeds) {
        const pair = { seed };
        for (const arm of ['control', 'mutation']) {
          pair[arm] = run({ configuration: { ...payload.configuration, ...(arm === 'control' ? NO_MUTATION : {}) },
            seed, program: payload.program ?? SEED_PROGRAM, ticks, instructionBudget: 1000000,
            sampleEvery: Math.max(1, Math.ceil(ticks / 100)), snapshotEvery: ticks });
          postMessage({ progress: `${pairs.length * 2 + (arm === 'control' ? 1 : 2)} / ${payload.seeds.length * 2} worlds complete` });
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        pairs.push(pair);
      }
      comparison = { version: 1, configuration: pairs[0].mutation.configuration, seeds: payload.seeds,
        program: payload.program ?? SEED_PROGRAM, budget: { ticks, instructionBudgetPerArm: 1000000 }, pairs,
        interpretation: 'Matched initial worlds, mutation on/off. Compute-capped survival is censored; discovery diversity is not evidence of adaptation.' };
      reply(id, { ...comparison, pairs: pairs.map(p => ({ seed: p.seed, control: p.control.summary, mutation: p.mutation.summary })),
        candidates: pairs.flatMap(p => candidates(p.mutation, 2)) });
    } else if (action === 'comparison-export') {
      if (!comparison) throw new Error('Run a comparison first.'); reply(id, comparison);
    } else if (action === 'evaluate') {
      if (!comparison || !Number.isSafeInteger(payload.index)) throw new Error('Select a candidate from this comparison.');
      const candidate = comparison.pairs.flatMap(p => candidates(p.mutation, 2))[payload.index];
      if (!candidate) throw new Error('Candidate is unavailable.');
      const seeds = [100001,100002,100003,100004,100005].filter(s => !comparison.seeds.includes(s));
      reply(id, evaluate(candidate, { configuration: comparison.configuration, seeds, ticks: 1000, instructionBudget: 1000000 }));
    } else throw new Error('Unknown worker command.');
  } catch (error) { postMessage({ id, error: error.message, errorName: error.name }); }
};
