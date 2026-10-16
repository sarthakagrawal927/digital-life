import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compare } from '../src/experiment.mjs';
import { PRESETS } from '../src/session.mjs';
import { assertAccounting, restore } from '../src/engine.mjs';
const output = resolve(process.argv[2] ?? 'results/world-1');
const seeds = [1,2,3,4,5], ticks = 1000, instructionBudget = 1000000;
await mkdir(output, { recursive:true });
const scenarios = [];
for (const [id,preset] of Object.entries(PRESETS)) {
  const report = compare({ seeds, configuration:preset.configuration, ticks, instructionBudget, sampleEvery:25, snapshotEvery:500 });
  const pairs = [];
  for (const pair of report.pairs) {
    const record = { seed:pair.seed };
    for (const arm of ['control','mutation']) {
      const result = pair[arm];
      for (const s of result.snapshots) assertAccounting(restore(s));
      const end=result.trends.at(-1), requestedStart=Math.max(0,end.tick-200);
      const start=result.trends.find(t=>t.tick>=requestedStart);
      record[arm]={...result.summary, initialPatchEnergy:result.trends[0].environmentalEnergy,
        terminalPatchEnergy:end.environmentalEnergy, lateWindow:{startTick:start.tick,endTick:end.tick,
          births:end.births-start.births,deaths:end.deaths-start.deaths,energyExpenditure:end.energyExpenditure-start.energyExpenditure}};
      await writeFile(resolve(output,`${id}-${pair.seed}-${arm}.json`),JSON.stringify(result));
    }
    pairs.push(record);
  }
  scenarios.push({id,title:preset.title,configuration:report.pairs[0].mutation.configuration,pairs});
}
const summary={version:1,seeds,budget:{ticks,instructionBudgetPerArm:instructionBudget},scenarios,
  interpretation:'One constraint changes per stress preset. Seeds and initial sources match. Late-window births/deaths are observations, not proof of sustainability; initial stocks can persist. Different compute-capped horizons are censored. Population safety limits are reported separately from ecological constraints.'};
await writeFile(resolve(output,'summary.json'),JSON.stringify(summary,null,2));
console.table(scenarios.flatMap(s=>s.pairs.map(p=>({world:s.id,seed:p.seed,control:p.control.population,mutation:p.mutation.population,
  births:p.mutation.births,lateBirths:p.mutation.lateWindow.births,tick:p.mutation.tick,stop:p.mutation.termination}))));
console.log(`Exported 30 full runs and validated every retained snapshot in ${output}`);
