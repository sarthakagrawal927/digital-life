import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compare, candidates, evaluate } from '../src/experiment.mjs';
const args = process.argv.slice(2);
if (args.length > 2) throw new Error('Usage: pnpm experiment [experiment.json] [output-directory]');
const options = JSON.parse(await readFile(resolve(args[0] ?? 'experiments/first.json'), 'utf8'));
const { evaluationSeeds, ...runOptions } = options;
if (evaluationSeeds?.some(seed => runOptions.seeds.includes(seed))) throw new Error('Evaluation seeds must be held out');
const output = resolve(args[1] ?? 'results/first');
await mkdir(output, { recursive: true });
const report = compare(runOptions);
const assessments = [];
for (const pair of report.pairs) {
  for (const arm of ['control', 'mutation']) {
    await writeFile(resolve(output, `${pair.seed}-${arm}.json`), JSON.stringify(pair[arm]));
  }
  for (const candidate of candidates(pair.mutation, 2)) {
    assessments.push(evaluate(candidate, { ...runOptions, seeds: evaluationSeeds ?? [101, 102, 103], snapshotEvery: runOptions.ticks }));
  }
}
const summary = { version: 1, options, interpretation: report.interpretation,
  pairs: report.pairs.map(p => ({ seed: p.seed, control: p.control.summary, mutation: p.mutation.summary })), assessments };
await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2));
console.table(summary.pairs.map(p => ({ seed: p.seed, controlPopulation: p.control.population,
  mutationPopulation: p.mutation.population, controlBirths: p.control.births, mutationBirths: p.mutation.births,
  diversity: p.mutation.genomeDiversity, controlStop: p.control.termination, mutationStop: p.mutation.termination })));
console.log(`Exported ${summary.pairs.length} pairs and ${assessments.length} candidate assessments to ${output}`);
