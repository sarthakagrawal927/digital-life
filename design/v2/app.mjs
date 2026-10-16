// Read-only design probes. No simulated playback: controls traverse saved frames.
import { OPS, disassemble } from '/src/engine.mjs';
const app = document.querySelector('#app');
const direction = ['a','b','c'].includes(new URLSearchParams(location.search).get('direction')) ? new URLSearchParams(location.search).get('direction') : 'a';
document.body.dataset.direction = direction;
document.querySelectorAll('.review-bar a').forEach(a => { if (a.dataset.direction === direction) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
const fmt = n => Number(n).toLocaleString('en-US');
const padded = n => String(n).padStart(2,'0');
let data, state = { seed: '4', arm: 'mutation', index: -1, selected: null }, timer = null;
const currentRun = () => data[state.seed][state.arm];
const frame = () => currentRun().frames[state.index];
function normalize() {
  const run = currentRun();
  state.index = state.index < 0 ? run.frames.length - 1 : Math.min(state.index, run.frames.length - 1);
  if (!frame().organisms.some(o => o.id === state.selected)) state.selected = frame().organisms[0]?.id ?? null;
}
function selected() { return frame().organisms.find(o => o.id === state.selected); }
function mark() { return '<span class="brand-mark" aria-hidden="true"></span>'; }
function seedControl() { return `<label class="control"><span class="control-label">Seed</span><select id="seed" aria-label="Experiment seed">${Object.keys(data).map(s=>`<option ${s===state.seed?'selected':''}>${s}</option>`).join('')}</select></label>`; }
function armControl() { return `<label class="control"><span class="control-label">Arm</span><select id="arm" aria-label="Treatment arm"><option value="mutation" ${state.arm==='mutation'?'selected':''}>Mutation</option><option value="control" ${state.arm==='control'?'selected':''}>Control</option></select></label>`; }
function header(extra='') { return `<header class="product-header"><div class="brand">${mark()}Digital Life<span class="screen-reader"> — executable evolution sandbox</span></div>${extra}<div class="header-controls">${seedControl()}${armControl()}</div></header>`; }
function world() {
  const w = frame(), size = 552, left = 34, unit = size / w.config.width;
  const theme = direction === 'b' ? {line:'#698770',field:'#172e20',source:'#92c77e',organism:'#dbf2b3',text:'#8fac91',select:'#f0c58c'} : direction === 'c' ? {line:'#c3ccb9',field:'#e8ecde',source:'#6e935d',organism:'#b34825',text:'#748168',select:'#b34825'} : {line:'#c1cbb4',field:'#e8ebde',source:'#89a865',organism:'#355d46',text:'#798269',select:'#bd512c'};
  let svg=`<svg class="world-svg" viewBox="0 0 620 620" aria-label="${w.organisms.length} organisms in a ${w.config.width} by ${w.config.height} world at tick ${w.tick}" xmlns="http://www.w3.org/2000/svg"><rect x="${left}" y="${left}" width="${size}" height="${size}" fill="${theme.field}"/>`;
  for (let i=0;i<=w.config.width;i++) svg+=`<path d="M${left+i*unit} ${left}v${size}" stroke="${theme.line}" stroke-opacity=".35" stroke-width=".65"/>`;
  for (let i=0;i<=w.config.height;i++) svg+=`<path d="M${left} ${left+i*unit}h${size}" stroke="${theme.line}" stroke-opacity=".35" stroke-width=".65"/>`;
  for(let i=0;i<w.config.width;i+=3) svg+=`<text x="${left+(i+.5)*unit}" y="20" font-size="8" text-anchor="middle" fill="${theme.text}">${padded(i)}</text><text x="17" y="${left+(i+.7)*unit}" font-size="8" text-anchor="middle" fill="${theme.text}">${padded(i)}</text>`;
  w.cells.forEach((c,i)=>{
    if(!c.source) return;
    const x=left+(i%w.config.width)*unit, y=left+Math.floor(i/w.config.width)*unit, amount=c.energy/w.config.patchCapacity;
    svg+=`<rect class="source" x="${x+1.7}" y="${y+1.7}" width="${unit-3.4}" height="${unit-3.4}" rx="${direction==='b'?5:2}" fill="${theme.source}" fill-opacity="${.07+amount*.48}" stroke="${theme.source}" stroke-opacity=".25" stroke-width=".65"/>`;
  });
  const groups=new Map();
  for(const o of w.organisms){ const key=o.y*w.config.width+o.x;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o); }
  for(const group of groups.values()){
    const o=group.find(o=>o.id===state.selected)??group[0], x=left+(o.x+.5)*unit,y=left+(o.y+.5)*unit,r=unit*(.16+Math.sqrt(o.energy/w.config.maxEnergy)*.1), active=o.id===state.selected;
    if(active) svg+=`<rect x="${x-unit/2}" y="${y-unit/2}" width="${unit}" height="${unit}" fill="${theme.select}" fill-opacity=".1"/><circle cx="${x}" cy="${y}" r="${unit*.47}" fill="none" stroke="${theme.select}" stroke-width="1.25"/>`;
    const dx=[0,1,0,-1][o.direction],dy=[-1,0,1,0][o.direction];
    svg+=`<g class="organism-mark" data-organism="${o.id}" tabindex="0" role="button" aria-label="Inspect organism ${o.id}, ${fmt(o.energy)} energy, generation ${o.generation}"><title>Organism #${o.id} · ${fmt(o.energy)} energy · ${group.length} in cell</title><circle cx="${x}" cy="${y}" r="${Math.max(unit*.41,9)}" fill="transparent"/><path d="M${x+dx*r} ${y+dy*r}l${dx*unit*.12} ${dy*unit*.12}" stroke="${theme.organism}" stroke-width="1.2"/><circle class="body" cx="${x}" cy="${y}" r="${r}" fill="${theme.field}" stroke="${active?theme.select:theme.organism}" stroke-width="1.1"/><circle cx="${x}" cy="${y}" r="${r*.33}" fill="${active?theme.select:theme.organism}"/>${group.length>1?`<circle cx="${x+r*.8}" cy="${y-r*.8}" r="${unit*.1}" fill="${theme.organism}"/>`:''}</g>`;
  }
  const o=selected();
  svg+=`<path d="M${left-8} ${left}h-5v12 M${left+size+8} ${left}h5v12 M${left-8} ${left+size}h-5v-12 M${left+size+8} ${left+size}h5v-12" fill="none" stroke="${theme.text}" stroke-width="1"/><text x="${left}" y="607" fill="${theme.text}" font-size="8">FINITE WORLD / WRAPPING EDGES</text><text x="${left+size}" y="607" fill="${theme.text}" font-size="8" text-anchor="end">${o?`SELECTED ${padded(o.x)},${padded(o.y)}`:'NO LIVING ORGANISMS'}</text></svg>`;
  return svg;
}
function legend() {return '<div class="legend"><span><i></i>Energy patches</span><span><i class="org"></i>Organisms</span></div>';}
function ancestry(o) {
  if(!o) return '';
  const chain=[],history=frame().lineage;let rec=history[o.id-1];
  while(rec&&chain.length<4){chain.unshift(rec);rec=rec.parentId?history[rec.parentId-1]:null;}
  return `<div class="ancestry"><span class="eyebrow">Ancestry · generation ${o.generation}</span><div class="ancestry-chain">${rec?'<i>…</i>':''}${chain.map((r,i)=>`${i?'<i>→</i>':''}<span title="Born at tick ${r.born}">#${r.id}</span>`).join('')}</div></div>`;
}
function behavior(o) {
  const ops = o.genome.map(b=>b>>4);
  if(!ops.includes(9)) return 'This program has no reproduction instruction. An organism can persist without sustaining a lineage.';
  if(!ops.includes(1)) return 'Replication is present; harvesting is absent. Its energy reserve cannot replenish through this program.';
  return 'Harvesting and replication are present. Their order, branches and resource access determine whether reproduction succeeds.';
}
function picker(o) {return `<label class="organism-picker">Inspect<select id="organism" aria-label="Select an organism">${frame().organisms.map(x=>`<option value="${x.id}" ${x.id===o.id?'selected':''}>#${x.id} · gen ${x.generation}</option>`).join('')}</select><span class="muted">or click the world</span></label>`;}
function inspector() {
  const o=selected(),w=frame();
  if(!o) return `<aside class="inspector"><span class="eyebrow">Organism inspector</span><h2 class="empty-inspector">Population extinct</h2><p class="note">Scrub to an earlier recorded frame to inspect the lineage that preceded extinction.</p></aside>`;
  return `<aside class="inspector"><div class="inspector-head"><div><span class="eyebrow">Selected organism</span><h2>Specimen ${padded(o.id)}</h2><div class="specimen-detail"><span class="status-dot"></span>Living <span>·</span> cell ${padded(o.x)},${padded(o.y)}</div></div><div class="specimen-glyph" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="11" stroke="currentColor" fill="none" stroke-width="1.5"/><circle cx="20" cy="20" r="4" fill="currentColor"/><path d="M20 9v-7" stroke="currentColor"/></svg></div></div>${picker(o)}<div class="reserves"><div><span class="eyebrow">Energy</span><strong>${fmt(o.energy)}</strong><small>of ${fmt(w.config.maxEnergy)} units</small></div><div><span class="eyebrow">Age</span><strong>${fmt(o.age)}</strong><small>ticks since birth</small></div></div><div class="program-title"><h3>Executable program</h3><span class="eyebrow">${o.genome.length} bytes</span></div><ol class="program-list">${disassemble(o.genome).map(b=>`<li class="${b.pc===o.pc?'current':''}"><span class="pc">${padded(b.pc)}</span><span class="op-byte">${b.byte.toString(16).padStart(2,'0').toUpperCase()}</span><span>${b.opcode.toLowerCase()}</span><span class="argument">${b.argument}</span></li>`).join('')}</ol><p class="behavior">${behavior(o)}</p>${ancestry(o)}<div class="memory-row" aria-label="Working memory">${o.memory.map((v,i)=>`<span title="Memory slot ${i}: ${v}">${v}</span>`).join('')}</div><div class="accounting"><div class="mini-label"><span>CONSTRUCTION MATERIAL</span><span>${o.genome.length+o.memory.length} units</span></div><p>${o.genome.length} instruction bytes + ${o.memory.length} memory slots.<br>Recycled to the world on death.</p></div></aside>`;
}
function playback() {
  const run=currentRun(),w=frame();
  return `<div class="playback"><button class="play" id="play" aria-label="${timer?'Pause recorded playback':'Play recorded frames'}">${timer?'Ⅱ':'▶'}</button><button id="previous" aria-label="Previous recorded snapshot" ${state.index===0?'disabled':''}>←</button><div class="timeline"><label class="screen-reader" for="timeline">Recorded snapshot</label><input id="timeline" type="range" min="0" max="${run.frames.length-1}" value="${state.index}" aria-valuetext="Tick ${w.tick}"><div class="tick-labels"><span>0</span><span>${fmt(run.frames.at(-1).tick)} ticks</span></div></div><button id="next" aria-label="Next recorded snapshot" ${state.index===run.frames.length-1?'disabled':''}>→</button><span class="tick">t ${fmt(w.tick)}</span></div>`;
}
function graph(kind='population',large=false) {
  const vw=document.documentElement.clientWidth;
  const width=large?Math.max(320,vw-(vw<=580?34:vw<=1100?60:104)):direction==='b'?Math.max(250,vw-(vw<=580?34:vw<=1100?317:581)):Math.max(250,vw<=580?vw-34:(vw-(vw<=780?66:120))/2);
  const arms=data[state.seed],height=large?180:110,padding=34;
  const datasets=kind==='population' ? [[arms.control.trends,'population','var(--muted)',false],[arms.mutation.trends,'population','var(--organism)',true]] : [[currentRun().trends,'environmentalEnergy','var(--energy)',true],[currentRun().trends,'organismEnergy','var(--organism)',false]];
  const raw=Math.max(1,...datasets.flatMap(([rows,key])=>rows.map(r=>r[key]))),max=kind==='population'?Math.ceil(raw/50)*50:Math.ceil(raw/100000)*100000;
  const end=Math.max(...arms.control.trends.map(r=>r.tick),...arms.mutation.trends.map(r=>r.tick));
  let s=`<svg class="trend-graph" viewBox="0 0 ${width} ${height+24}" preserveAspectRatio="none" role="img" aria-label="${kind==='population'?'Mutation and control population':'Environmental and organism energy'} over time for seed ${state.seed}">`;
  for(let i=0;i<3;i++){const y=8+i*(height-10)/2, value=max*(1-i/2);s+=`<path d="M${padding} ${y}h${width-padding-2}" stroke="var(--line)" stroke-width=".6"/><text x="${padding-8}" y="${y+3}" font-family="var(--mono)" font-size="8" fill="var(--muted)" text-anchor="end">${value>=1000?`${Math.round(value/1000)}k`:value}</text>`;}
  for(const [rows,key,color,fill] of datasets){const points=rows.map(r=>[padding+r.tick/end*(width-padding-2),8+(height-10)*(1-r[key]/max)]);const path=points.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');if(fill)s+=`<path d="${path}L${points.at(-1)[0]} ${height-2}L${padding} ${height-2}Z" fill="${color}" opacity=".06"/>`;s+=`<path d="${path}" stroke="${color}" stroke-width="1.65" fill="none"/>`;}
  const x=padding+frame().tick/end*(width-padding-2);s+=`<path d="M${x} 8V${height-2}" stroke="var(--ink)" stroke-opacity=".35" stroke-dasharray="2 3"/><text x="${padding}" y="${height+16}" fill="var(--muted)" font-family="var(--mono)" font-size="8">0</text><text x="${width-2}" y="${height+16}" fill="var(--muted)" font-family="var(--mono)" font-size="8" text-anchor="end">${fmt(end)} ticks</text></svg>`;
  return s;
}
function chartKey() {return '<div class="chart-key"><span><i></i>Mutation</span><span><i class="control-key"></i>Control</span></div>';}
function foot(thesis) {return `<footer class="direction-foot"><span><strong>Direction ${direction.toUpperCase()}.</strong> ${thesis}</span><span>Design study only. Inspection and recorded playback work.<br>New experiments and live simulation await implementation.</span></footer>`;}
function bench() {
  const w=frame(), occupied=w.config.material-w.freeMaterial;
  return `<div class="bench">${header()}<div class="bench-intro"><div><span class="eyebrow">An executable evolution sandbox</span><h1 style="margin-top:12px">Small programs.<br>A finite world.</h1><p>Observe what persists. Inspect how it works.</p></div><div class="experiment-id">EXPERIMENT 01 / INHERITED STRATEGIES<br>24 × 24 CELLS · ${fmt(w.config.material)} MATERIAL UNITS<br>RECORDED RUN · NO LIVE EXECUTION</div></div><div class="bench-grid"><section class="world-area" aria-label="Recorded world"><div class="world-heading"><h2>The world <span class="muted mono" style="font-size:11px;margin-left:9px">${padded(Number(state.seed))}</span></h2>${legend()}<span class="world-kind"><span class="status-dot"></span>${w.organisms.length} living</span></div><div class="stage">${world()}</div><div class="world-footer"><span>Patch intensity = available energy</span><span>Ring size = organism reserve</span></div>${playback()}</section><div class="bench-inspector">${inspector()}</div></div><section class="lower" aria-label="World trends"><div><div class="mini-label"><h3>Population over time</h3>${chartKey()}</div>${graph()}<p class="note">The saved frame is marked on the trace. ${fmt(currentRun().summary.births)} births recorded in this ${state.arm} run.</p></div><div><div class="mini-label"><h3>Resource accounting</h3><span>${fmt(w.freeMaterial)} FREE</span></div><div class="stat-inline"><strong>${fmt(occupied)}</strong><span>occupied + ${fmt(w.freeMaterial)} free = ${fmt(w.config.material)} total</span></div><div class="balance"><span style="width:${occupied/w.config.material*100}%"></span></div><p class="note">Material is conserved. Energy enters through configured patches and leaves through execution, upkeep and death.</p></div></section><div class="endnote"><span>REPLICATION IS A SUPPLIED PRIMITIVE</span><span>DIVERSITY IS AN OBSERVATION, NOT PROOF OF ADAPTATION</span></div>${foot('A specimen bench: spatial evidence and code in one reading order.')}</div>`;
}
function observatory() {
  const w=frame(),g=new Set(w.organisms.map(o=>o.genome.join(','))).size;
  return `<div class="observatory">${header('<div class="obs-header-center"><span>EXPERIMENT<strong>01 / Inherited strategies</strong></span><span>WORLD<strong>24 × 24 · finite resources</strong></span></div>')}<div class="main-field"><section class="obs-title"><div><span class="eyebrow">Field observation / ${padded(Number(state.seed))}</span><h1>A little world,<br>under pressure.</h1><p class="subtitle">Every mark is an executable organism. Every action has a cost.</p></div><div class="obs-readings"><div class="obs-reading"><span class="eyebrow">Population</span><strong>${fmt(w.organisms.length)}</strong><small>living organisms</small></div><div class="obs-reading"><span class="eyebrow">Genomes</span><strong>${fmt(g)}</strong><small>distinct programs</small></div><div class="obs-reading"><span class="eyebrow">Generations</span><strong>${fmt(Math.max(0,...w.organisms.map(o=>o.generation)))}</strong><small>deepest living branch</small></div></div></section><section class="obs-view"><div class="world-heading"><h2>SEED ${padded(Number(state.seed))} / ${state.arm.toUpperCase()}</h2><span>SNAPSHOT ${state.index+1} OF ${currentRun().frames.length}</span></div><div class="stage">${world()}</div><div class="obs-world-caption"><span>LIGHTER PATCH → MORE ENERGY</span><span>SELECT A RING TO INSPECT</span></div>${playback()}<div class="obs-trend"><div class="mini-label"><h3>Population / recorded history</h3>${chartKey()}</div>${graph()}</div></section>${inspector()}</div><section class="obs-bottom"><div><h3>READING THE FIELD</h3><p>Rings encode energy reserve.<br>The stem indicates orientation.<br>A second dot marks a shared cell.</p></div><div><h3>WHAT THIS RUN TELLS US</h3><p class="obs-quote">Survival can be observed.<br>Improvement has to be tested.</p><p style="margin-top:10px">Replay ancestral and descendant programs on held-out seeds before drawing conclusions.</p></div><div><h3>MATERIAL / CLOSED SYSTEM</h3><p>${fmt(w.config.material-w.freeMaterial)} occupied + ${fmt(w.freeMaterial)} free<br>${fmt(w.config.material)} units total · balance verified</p><div class="balance"><span style="width:${(w.config.material-w.freeMaterial)/w.config.material*100}%"></span></div></div></section>${foot('An observatory: a large field framed by readings and organism evidence.')}</div>`;
}
function stopLabel(summary) {return summary.termination==='extinction'?'<span class="termination extinct">Extinct</span>':summary.termination==='instruction-budget'?'<span class="termination">Compute cap</span>':'<span class="termination">Tick horizon</span>';}
function ledger() {
  const w=frame(),o=selected();
  return `<div class="ledger">${header()}<section class="ledger-intro"><div><span class="eyebrow">Experiment 01 / Digital life evolution sandbox</span><h1>Does inherited behavior<br>keep a population alive?</h1></div><div class="ledger-meta"><div><span>Discovery</span><strong>5 paired seeds</strong></div><div><span>Tick horizon</span><strong>1,000 ticks</strong></div><div><span>Compute cap</span><strong>1M instructions / arm</strong></div><div><span>Evaluation</span><strong>5 held-out seeds</strong></div></div></section><section class="result-strip"><div><span class="eyebrow">Without mutation</span><strong>5 / 5</strong><p>populations alive at the tick horizon</p></div><div><span class="eyebrow">With mutation</span><strong>3 + 1</strong><p>3 at the horizon; 1 at the compute cap</p></div><div><span class="eyebrow">Failure is a result</span><strong>1 extinction</strong><p>mutation run 03 lost its population</p></div></section><section class="ledger-chart"><div class="chart-heading"><div><span class="eyebrow">A closer look / Seed ${padded(Number(state.seed))}</span><h2>Two worlds. One starting condition.</h2></div>${chartKey()}</div>${graph('population',true)}<div class="chart-caption"><span>LIVING ORGANISMS · SHARED SCALE</span><span>${state.seed==='2'?'MUTATION TRACE ENDS AT COMPUTE CAP':'COMPARE THE TRAJECTORY, NOT ONLY THE LAST FRAME'}</span></div></section><div class="ledger-grid"><section><div class="section-title"><h2>The five runs</h2><span class="eyebrow">Control → mutation</span></div><table class="run-table"><caption class="screen-reader">Terminal experiment outcomes for each seed. Ends may have different compute-limited horizons.</caption><thead><tr><th>SEED</th><th>POPULATION</th><th>BIRTHS</th><th>GENOMES</th><th>MUTATION STOP</th></tr></thead><tbody>${Object.entries(data).map(([s,p])=>`<tr class="${s===state.seed?'active':''}"><td><button data-seed="${s}" aria-label="Inspect seed ${s}">${padded(Number(s))}</button></td><td><div class="pair-cell">${fmt(p.control.summary.population)} <small>→</small> <span class="treatment">${fmt(p.mutation.summary.population)}</span></div></td><td><div class="pair-cell">${fmt(p.control.summary.births)} <small>→</small> <span class="treatment">${fmt(p.mutation.summary.births)}</span></div></td><td class="treatment">${p.mutation.summary.genomeDiversity}</td><td>${stopLabel(p.mutation.summary)}</td></tr>`).join('')}</tbody></table><p class="run-note">Each row shows its terminal outcome. Run 02 exhausted its instruction allowance before the tick horizon; terminal populations in that row are not an equal-time comparison.</p><p class="run-note"><strong>Candidate replay:</strong> two descendants produced more offspring on all five held-out seeds. A different survivor produced none. Persistence alone does not establish adaptation.</p></section><section class="ledger-world"><div class="world-heading"><h2>Inside run ${padded(Number(state.seed))}</h2>${legend()}</div><div class="stage">${world()}</div>${playback()}<div class="compact-inspector">${o?`<div><span class="eyebrow">Selected organism</span><h3 style="margin-top:7px">Specimen ${o.id}</h3><p class="note" style="margin-top:7px">${fmt(o.energy)} energy<br>${fmt(o.age)} ticks old · generation ${o.generation}</p></div><div>${picker(o)}<div class="program-inline" aria-label="Executable bytecode">${o.genome.map((b,i)=>`<span class="${i===o.pc?'active':''}" title="${OPS[b>>4]}">${b.toString(16).padStart(2,'0').toUpperCase()}</span>`).join('')}</div><p class="note" style="margin-top:10px">${behavior(o)}</p></div>`:'<p class="note">This frame has no living organisms. Scrub backward to inspect an earlier snapshot.</p>'}</div></section></div><div class="endnote"><p><b>Replication is supplied. Resources are accounted for.</b><br>These experiments test inherited strategies within a bounded world.</p><p>Diversity and visual complexity are observations.<br>Neither establishes cumulative invention.</p></div>${foot('An experiment ledger: paired evidence first, the world available for inspection.')}</div>`;
}
function render() { normalize(); app.innerHTML = direction==='b'?observatory():direction==='c'?ledger():bench(); app.setAttribute('aria-busy','false'); }
function pause() { if(timer){clearInterval(timer);timer=null;} }
function move(index) { state.index=index;render(); }
function inspect(id) {state.selected=Number(id);render();}
app.addEventListener('click', event=>{
  const target=event.target.closest('[data-organism],[data-seed],button'); if(!target)return;
  if(target.dataset.organism){inspect(target.dataset.organism);return;}
  if(target.dataset.seed){pause();state.seed=target.dataset.seed;state.index=-1;render();return;}
  if(target.id==='previous'){pause();move(Math.max(0,state.index-1));}
  if(target.id==='next'){pause();move(Math.min(currentRun().frames.length-1,state.index+1));}
  if(target.id==='play'){
    if(timer){pause();render();return;}
    if(state.index===currentRun().frames.length-1)state.index=0;
    timer=setInterval(()=>{if(state.index<currentRun().frames.length-1)state.index++;else pause();render();},950);render();
  }
});
app.addEventListener('keydown',event=>{const o=event.target.closest('[data-organism]');if(o&&(event.key==='Enter'||event.key===' ')){event.preventDefault();inspect(o.dataset.organism);}});
app.addEventListener('change',event=>{
  if(event.target.id==='seed'){pause();state.seed=event.target.value;state.index=-1;render();}
  if(event.target.id==='arm'){pause();state.arm=event.target.value;state.index=-1;render();}
  if(event.target.id==='organism')inspect(event.target.value);
});
app.addEventListener('input',event=>{if(event.target.id==='timeline'){pause();state.index=Number(event.target.value);render();document.querySelector('#timeline').focus();}});
try { const response=await fetch('/design/v2/data.json');if(!response.ok)throw new Error('Recorded data unavailable');data=await response.json();render(); }
catch(error){app.textContent=error.message;app.setAttribute('aria-busy','false');}
