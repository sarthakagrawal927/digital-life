// Static direction evidence, never a substitute for a working viewer.
import { readFile, writeFile } from 'node:fs/promises';
const run = JSON.parse(await readFile(new URL('../results/first/4-mutation.json', import.meta.url), 'utf8'));
const control = JSON.parse(await readFile(new URL('../results/first/4-control.json', import.meta.url), 'utf8'));
const world = run.snapshots.at(-1), selected = world.organisms[0];
const rect = (x,y,w,h,fill,rx=0,stroke='none') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
const text = (x,y,s,size=14,fill='#b2bac3',family='system-ui',weight=400) => `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}">${s}</text>`;
const line = (x,y,x2,y2,color) => `<path d="M${x} ${y} L${x2} ${y2}" stroke="${color}"/>`;
function grid(x,y,size,bg,source,organism) {
  const unit = size/world.config.width;
  let s = rect(x,y,size,size,bg,4);
  world.cells.forEach((c,i) => { if(c.source) s += rect(x+(i%24)*unit+1,y+Math.floor(i/24)*unit+1,unit-2,unit-2,source,2); });
  world.organisms.forEach(o => { s+= `<circle cx="${x+(o.x+.5)*unit}" cy="${y+(o.y+.5)*unit}" r="${Math.max(2,unit*.16)}" fill="${organism}"/>`; });
  s+= `<circle cx="${x+(selected.x+.5)*unit}" cy="${y+(selected.y+.5)*unit}" r="${unit*.47}" fill="none" stroke="${organism}" stroke-width="2"/>`;
  return s;
}
function chart(x,y,width,height,treatment='#72e0d3',baseline='#6b7888') {
  const max = Math.max(...run.trends.map(m=>m.population),...control.trends.map(m=>m.population),1);
  let s=''; for(let i=0;i<4;i++) s+=line(x,y+i*height/3,x+width,y+i*height/3,'#7c889333');
  for(const [data,color] of [[control,baseline],[run,treatment]]) s+=`<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${data.trends.map(m=>`${x+m.tick/1000*width},${y+height-m.population/max*height}`).join(' ')}"/>`;
  return s;
}
function shell(label,body,bg) { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" role="img" aria-label="${label}">${rect(0,0,1200,800,bg)}${body}</svg>`; }
let a = text(32,43,'◉  DIGITAL LIFE',18,'#f0f3f5','system-ui',700)+text(235,43,'World / Seed 04',14)+text(933,43,'RESEARCH BENCH  /  A',12,'#87949f');
a+=line(0,68,1200,68,'#2c333b')+text(32,113,'An executable ecosystem.',30,'#f0f3f5','system-ui',600)+text(32,141,'Mutation enabled · 24 × 24 world · complete-tick replay',14);
[['TICK','1,000'],['POPULATION','142'],['BIRTHS','6,328'],['GENOMES','85']].forEach(([k,v],i)=>{a+=text(690+i*123,106,k,10,'#8996a3')+text(690+i*123,140,v,27,'#eef4f5','monospace');});
a+=grid(32,174,472,'#10171c','#634c26','#72e0d3');
a+=rect(524,174,334,472,'#1c242c',8)+text(548,207,`ORGANISM #${selected.id}`,12,'#72e0d3','monospace')+text(548,242,'Inherited instructions',22,'#eef4f5');
[['Energy',selected.energy],['Age',selected.age+' ticks'],['Generation',selected.generation],['Parent',selected.parentId],['Memory',selected.memory.length+' units']].forEach(([k,v],i)=>{a+=text(548,278+i*29,k)+text(728,278+i*29,v,14,'#eef4f5','monospace');});
selected.genome.slice(0,8).forEach((b,i)=>{a+=text(548,458+i*21,`${String(i).padStart(2,'0')}   ${b.toString(16).padStart(2,'0')}   ${['NOP','HARVEST','TURN','MOVE','SENSE','SET','ADD','LOAD','STORE','REPRODUCE','IF_ZERO','IF_POSITIVE','JUMP','SUB','MOD','YIELD'][b>>4]}`,12,i===selected.pc?'#72e0d3':'#a7b6c4','monospace');});
a+=text(884,199,'RUN CONDITIONS',11)+text(884,241,'Resources are finite.',19,'#edf3f5')+text(884,276,'Amber patches supply energy.')+text(884,300,'Material is recycled on death.')+line(884,331,1168,331,'#34414d')+text(884,361,'Observation ≠ adaptation',17,'#f2c078')+text(884,391,'This seed survived the horizon.')+text(884,415,'Compare inherited programs')+text(884,439,'under matched conditions.')+text(884,504,'MATERIAL BALANCE',11)+text(884,536,`${world.freeMaterial} free / 6,000 total`,17,'#edf3f5','monospace');
a+=rect(32,668,1136,98,'#1c242c',8)+text(48,693,'POPULATION / 0–1,000 TICKS',10)+chart(285,686,570,60)+text(895,699,'● Mutation   ● Control',12)+text(895,734,'Paused    Step →    ×10',14,'#eef3f5');
let b=text(58,56,'DIGITAL LIFE / FIELD NOTEBOOK',12,'#676c5e','monospace')+text(1011,56,'RECORD 004',12,'#676c5e','monospace');
b+=line(58,78,1142,78,'#bfc0af')+text(58,144,'A world that can fail.',52,'#232c25','Georgia')+text(58,182,'Experiment 01 · Inherited strategies under finite resources',17,'#59604f');
b+=text(58,243,'01  OBSERVATION',11,'#767c69','monospace')+text(58,283,'Mutation sustained a larger',27,'#283428','Georgia')+text(58,319,'population in this run.',27,'#283428','Georgia')+text(58,359,'At tick 1,000: 142 organisms, 85 distinct genomes.',15,'#59604f')+text(58,386,'This is an observation. It does not establish adaptation.',15,'#59604f');
b+=grid(718,220,340,'#e3e6d7','#bac79f','#293e30')+text(718,592,'Seed 04 · Selected organism circled',13,'#59604f')+text(1082,286,'N',14,'#283428','monospace');
b+=text(58,448,'02  MATCHED EXPERIMENT',11,'#767c69','monospace');
[['','Control','Mutation'],['Population','2','142'],['Reproductive output','1,945','6,328'],['Distinct living genomes','1','85'],['Termination','Tick budget','Tick budget']].forEach((row,i)=>{b+=line(58,476+i*37,651,476+i*37,'#c8cbba'); row.forEach((v,j)=>b+=text([58,367,510][j],501+i*37,v,14,i===0?'#747a68':'#29362b',j?'monospace':'system-ui'));});
b+=line(58,688,1142,688,'#bfc0af')+text(58,724,'NEXT: replay descendants against their ancestor on held-out seeds.',17,'#283428','Georgia')+text(58,755,'Open world ↗      Inspect ancestry ↗      Export experiment ↗',13,'#59604f');
let d=rect(0,0,205,800,'#131525')+text(24,48,'DIGITAL',21,'#e9eaff','monospace',700)+text(24,73,'LIFE / CONSOLE',12,'#a4a7c0','monospace')+text(24,139,'01  Experiment',14,'#ded4ff')+text(24,185,'02  World',14)+text(24,231,'03  Programs',14)+text(24,277,'04  Lineage',14)+text(24,720,'5 discovery seeds',12)+text(24,745,'5 held-out seeds',12);
d+=text(239,48,'EXPERIMENT 01',12,'#a4a7c0','monospace')+text(239,92,'What changed with mutation?',32,'#eeeaff','system-ui',600)+text(239,126,'Paired worlds. Equal caps. Inspect every failure.',15,'#a4a7c0');
d+=rect(239,157,923,120,'#24243b',8)+text(262,185,'SEED 04',11,'#b9b6d0','monospace')+text(405,185,'POPULATION',11)+text(622,185,'BIRTHS',11)+text(823,185,'GENOMES',11)+text(1006,185,'STOP',11);
[['CONTROL','2','1,945','1','Tick cap'],['MUTATION','142','6,328','85','Tick cap']].forEach((row,i)=>row.forEach((v,j)=>d+=text([262,405,622,823,1006][j],221+i*33,v,j===0?12:17,i?'#c6b1ff':'#99a2b8','monospace')));
d+=text(239,320,'POPULATION OVER TIME',11,'#a4a7c0','monospace')+chart(239,345,923,140,'#be9aff','#69778b')+text(239,508,'0',11)+text(1110,508,'1,000',11);
d+=grid(239,548,208,'#191d31','#595338','#c8b1ff')+text(467,571,'LIVE PROGRAM',11,'#a4a7c0','monospace')+text(467,607,`#${selected.id} · generation ${selected.generation}`,18,'#eeeaff','monospace')+text(467,642,selected.genome.map(b=>b.toString(16).padStart(2,'0')).join(' '),13,'#c6b1ff','monospace')+text(467,677,`${selected.energy} energy · ${selected.age} ticks old`,14,'#a4a7c0');
d+=rect(845,548,317,208,'#24243b',8)+text(865,580,'EVIDENCE CHECK',11,'#e3bc79','monospace')+text(865,617,'One of five mutation runs')+text(865,643,'went extinct. Another hit')+text(865,669,'its instruction budget.')+text(865,710,'No invention claim.',16,'#eeeaff');
for(const [id,body,bg,title] of [['a',a,'#151c23','A — Research bench'],['b',b,'#f4f2e8','B — Field notebook'],['c',d,'#191b2e','C — Evolution console']]) {
  await writeFile(new URL(`../design/${id}.svg`,import.meta.url),shell(title,body,bg));
}
await writeFile(new URL('../design/round-1.html',import.meta.url),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Digital Life — direction selection</title><style>body{margin:0;background:#eceef0;color:#20252b;font:16px system-ui}header,section{max-width:1200px;margin:38px auto;padding:0 24px}h1{font-size:32px;margin:0 0 12px}p{line-height:1.6;max-width:900px}img{width:100%;display:block;box-shadow:0 12px 35px #17263420;border-radius:10px}h2{margin-top:50px}small{display:block;margin:10px 0;color:#57616c}</style><header><h1>Digital Life: choose the viewer system</h1><p>Three static design previews using real seed-4 mutation-run data at tick 1,000. These controls are illustrative. The engine and experiment runner work; the viewer awaits your selection.</p><p><strong>Recommended: A</strong> for inspecting a living world. B prioritizes an experiment record; C prioritizes comparisons across runs.</p></header>${[['a','A — Research bench','World first. Persistent bytecode inspector and compact resource trends.'],['b','B — Field notebook','Results first. Annotated experiment record with spatial evidence.'],['c','C — Evolution console','Comparison first. Paired treatment data, timeline and program drill-down.']].map(([id,t,description])=>`<section><h2>${t}</h2><small>${description}</small><img id="${id}" src="/design/${id}.svg" alt="${description}"></section>`).join('')}</html>`);
