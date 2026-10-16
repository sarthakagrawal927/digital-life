import { readFile, writeFile } from 'node:fs/promises';
const data = {};
for (const seed of [1, 2, 3, 4, 5]) {
  data[seed] = {};
  for (const arm of ['control', 'mutation']) {
    const run = JSON.parse(await readFile(new URL(`../results/first/${seed}-${arm}.json`, import.meta.url), 'utf8'));
    const frames = run.snapshots.map(snapshot => ({
      ...Object.fromEntries(['tick', 'config', 'cells', 'organisms', 'freeMaterial', 'ledger', 'stats'].map(key => [key, snapshot[key]])),
      lineage: snapshot.lineage.map(record => Object.fromEntries(['id', 'parentId', 'generation', 'born', 'died', 'genome'].map(key => [key, record[key]]))),
    }));
    data[seed][arm] = { summary: run.summary, trends: run.trends, frames };
  }
}
await writeFile(new URL('../design/v2/data.json', import.meta.url), JSON.stringify(data));
console.log('Recorded design-probe data refreshed from the first experiment');
