import { DEFAULT_CONFIG, config, disassemble, SEED_PROGRAM } from './engine.mjs';
import { PRESETS, SESSION_LIMITS } from './session.mjs';
import { NO_MUTATION } from './experiment.mjs';
import { FieldRenderer, drawTrend, drawAction } from './render.mjs';
import { explainAction, inheritedChanges, instructionLabel } from './explain.mjs';
const $ = id => document.getElementById(id), fmt = n => Number(n).toLocaleString('en-US');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const OP_HELP = ['No operation; execution still costs energy.','Pay to transfer energy from the current patch into the reserve.','Rotate clockwise by the argument, modulo four.','Move one cell relative to facing plus the argument; edges wrap.','Read local energy (0), reserve (1), free material (2), or neighboring energy (3–15).','Set the accumulator to the argument.','Add the argument to the accumulator.','Read a working-memory slot into the accumulator.','Store the accumulator in a working-memory slot.','Attempt to copy the program, allocate material, and transfer parent energy to a child.','Branch by the signed offset if the accumulator is zero.','Branch by the signed offset if the accumulator is positive.','Jump by the signed offset from the next instruction; program counters wrap.','Subtract the argument from the accumulator.','Take the remainder by the argument; zero uses one.','End this organism’s instruction batch; upkeep still applies.'];
const hex = n => Number(n).toString(16).padStart(2,'0');
class RPC {
  constructor(progress = () => {}) {
    this.worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' }); this.next = 1; this.pending = new Map();
    this.worker.onmessage = ({ data }) => { if (data.progress) { progress(data.progress); return; } const pending = this.pending.get(data.id); if (!pending) return; this.pending.delete(data.id); if (data.error) pending.reject(Object.assign(new Error(data.error),{name:data.errorName??'Error'})); else pending.resolve(data.result); };
    this.worker.onerror = event => { for (const p of this.pending.values()) p.reject(new Error(event.message || 'The simulation worker stopped. Restart the world to recover.')); this.pending.clear(); };
  }
  call(action, payload = {}) { return new Promise((resolve,reject) => { const id=this.next++;this.pending.set(id,{resolve,reject});this.worker.postMessage({id,action,payload}); }); }
  close() { this.worker.terminate(); for (const p of this.pending.values()) p.reject(Object.assign(new Error('Cancelled'), { cancelled:true })); this.pending.clear(); }
}
let live = new RPC(), experiment = null, view = null, running = false, busy = false, selectedId = null, speed = 1, debt = 0, lastClock = performance.now(), epoch = 0, comparison = null, assessment = null, experimentBusy = false;
let configuration = config(PRESETS.baseline.configuration), seed = 4, program = [...SEED_PROGRAM], title = PRESETS.baseline.title, inspectorSignature = '', pickerSignature = '', checkpointSignature = '';
let actionIndex = null, actionSignature = '';
const renderer = new FieldRenderer($('world'));
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
$('motion').checked = !reduced.matches; renderer.motion = !reduced.matches;
reduced.addEventListener('change', e => { $('motion').checked=!e.matches;renderer.motion=!e.matches;renderer.draw(); });
function notice(message, error = false) { $('notice').textContent = message; $('notice').hidden = !message; $('notice').classList.toggle('error', error); }
function inlineError(id,error){const message=(error instanceof SyntaxError||error.name==='SyntaxError')?'This file or configuration is not valid JSON. Check commas, quotes, and brackets, then try again.':error.message;$(id).textContent=message;$(id).hidden=false;notice(message,true);}
function report(error) { if (!error.cancelled) { setRunning(false); notice(error.message,true); } }
function setRunning(value) { running=Boolean(value && !view?.termination);debt=0;lastClock=performance.now();$('play').textContent=running?'Pause':'Play';$('play').setAttribute('aria-label',running?'Pause simulation':'Play simulation');$('live-dot').classList.toggle('paused',!running);$('step').disabled=running||busy||Boolean(view?.termination);$('play').disabled=Boolean(view?.termination);if(view)renderExplanation(view); }
function fillConfiguration(c=configuration) {
  $('configuration').value=JSON.stringify(c,null,2);$('seed').value=seed;$('regeneration').value=c.regeneration;$('material').value=c.material;$('upkeep').value=c.upkeepPerUnit;
  $('mutation').value=c.substitutionPermille||c.insertionPermille||c.deletionPermille?'on':'off';
}
function editedConfiguration() {
  const raw=JSON.parse($('configuration').value);
  const c={...raw,regeneration:Number($('regeneration').value),material:Number($('material').value),upkeepPerUnit:Number($('upkeep').value)};
  if($('mutation').value==='off')Object.assign(c,NO_MUTATION);
  else if(!c.substitutionPermille&&!c.insertionPermille&&!c.deletionPermille)Object.assign(c,{substitutionPermille:DEFAULT_CONFIG.substitutionPermille,insertionPermille:DEFAULT_CONFIG.insertionPermille,deletionPermille:DEFAULT_CONFIG.deletionPermille});
  return config(c);
}
async function start(c=configuration,s=seed,genome=program,autoplay=true,name=title) {
  const generation=++epoch;setRunning(false);live.close();live=new RPC();busy=true;selectedId=null;inspectorSignature='';pickerSignature='';checkpointSignature='';renderer.cell=null;$('follow').checked=true;
  try{const result=await live.call('init',{configuration:c,seed:s,program:genome});if(generation!==epoch)return;
    configuration=result.config;seed=result.seed;program=[...genome];title=name;view=null;render(result);fillConfiguration();$('config-error').hidden=true;notice('');busy=false;setRunning(autoplay);
  }catch(error){if(generation===epoch){busy=false;report(error);}}
}
function describe(o) {
  const ops=o.genome.map(b=>b>>4);
  if(!ops.includes(9))return 'No reproduction instruction. Persistence alone does not sustain a reproducing population.';
  if(!ops.includes(1))return 'No harvesting instruction. This program cannot replenish its own reserve.';
  return 'Harvesting and replication are present. Whether this behavior improves on its ancestor requires a matched replay.';
}
function renderInspector(v) {
  const o=v.selected,r=v.selectedRecord;
  if($('specimen').contains(document.activeElement))return;
  const signature=JSON.stringify([o,r,v.ancestry]);if(signature===inspectorSignature)return;inspectorSignature=signature;
  if(!r){$('organism-name').textContent='No living organisms';$('organism-detail').textContent='Extinction is an experimental outcome.';$('specimen').innerHTML='<p class="behavior">Restart with the same seed to replay, or change a world rule to test another circumstance.</p>';return;}
  $('organism-name').textContent=`${r.parentId===null?'Founder':'Organism'} #${r.id}`;
  $('organism-detail').textContent=`Generation ${r.generation} · ${o?`age ${o.age} ticks · ${o.x},${o.y}`:`died at tick ${r.died}`}`;
  const genome=o?.genome??r.genome,material=genome.length+v.config.memorySize, helpOpen=$('opcode-help')?.open;
  const next=o?disassemble(genome)[o.pc]:null;
  $('specimen').innerHTML=`<div class="reserves"><div><span>Energy reserve</span><strong>${o?fmt(o.energy):'—'}</strong><small>${o?'available to act':'dissipated at death'}</small></div><div><span>Material</span><strong>${material}</strong><small>${genome.length} bytes + ${v.config.memorySize} slots</small></div></div><div class="program-heading">Executable program<span>${genome.length} bytes</span></div><ol class="program-list" aria-label="Bytecode program">${disassemble(genome).map(row=>`<li class="${o?.pc===row.pc?'current':''}" ${o?.pc===row.pc?'aria-current="step"':''}><span class="pc">${row.pc.toString().padStart(2,'0')}</span><span class="byte">${hex(row.byte)}</span><span>${row.opcode}</span><span class="argument">${row.argument}</span></li>`).join('')}</ol><p class="next-instruction">${next?`Next: ${next.opcode} ${next.argument}. ${OP_HELP[next.byte>>4]}`:`This organism died at tick ${r.died}; its material was recycled.`}</p><details id="opcode-help" class="opcode-help" ${helpOpen?'open':''}><summary>How this program executes</summary><p>Each row is one byte. The left number is its position; the highlighted row is the next instruction. Every instruction costs energy. Branch offsets start from the following row. Newborn working memory starts empty.</p>${[...new Set(genome.map(b=>b>>4))].map(op=>`<p><b>${disassemble([op<<4])[0].opcode}</b> ${OP_HELP[op]}</p>`).join('')}</details><p class="behavior">${describe({genome})}</p><div class="ancestry"><span class="tiny-label">Parent chain · ${v.ancestryTruncated?'last 12 ancestors':'founder to selected'}</span><div class="ancestry-chain">${v.ancestryTruncated?'<i>…</i>':''}${v.ancestry.map((a,i)=>`${i?'<i>→</i>':''}<span title="Born at tick ${a.born}">#${a.id}</span>`).join('')}</div></div>${o?`<div class="memory"><span class="tiny-label">Working memory · accumulator ${o.accumulator}</span><div class="memory-values">${o.memory.map((n,i)=>`<span title="Memory slot ${i}">${n}</span>`).join('')}</div></div>`:''}<div class="mutation-events"><span>${r.mutations.length?'Inherited mutations':'Exact copy at birth'}</span>${r.mutations.length?`<ul>${r.mutations.map(m=>`<li>${escape(m.type)} ${escape(m.index??m.after)}${m.from!==undefined?` · ${escape(hex(m.from))}`:''}${m.to!==undefined?` → ${escape(hex(m.to))}`:''}</li>`).join('')}</ul>`:'<p>Working memory is not inherited.</p>'}</div>`;
  const inheritance=inheritedChanges(v.selectedParent,r);
  $('specimen').insertAdjacentHTML('afterbegin',`<section class="routine-explanation"><h3>Its instruction routine</h3><ol>${genome.map((byte,i)=>`<li><span>${i}</span>${escape(instructionLabel(byte,i,genome.length,v.config.memorySize))}</li>`).join('')}</ol><p class="fine">Instructions can branch or end a tick early; this list describes the code, not an observed movement pattern.</p><h3>${escape(inheritance.title)}</h3><ul>${inheritance.lines.map(line=>`<li>${escape(line)}</li>`).join('')}</ul>${r.mutations.length?'<p class="fine">An inherited change is not proof of improvement. Test it against the ancestor below.</p>':''}</section>`);
}
function renderExplanation(v) {
  const actions=v.actions??[], signature=`${v.selectedRecord?.id}:${actions[0]?.tick}:${actions.length}`;
  if(signature!==actionSignature){actionSignature=signature;actionIndex=null;}
  let preferred=actions.findLastIndex(a=>a.death||a.reproduction?.childId);
  if(preferred<0)preferred=actions.findLastIndex(a=>['HARVEST','MOVE','REPRODUCE'].includes(a.opcode));
  const index=Math.max(0,Math.min(actions.length-1,actionIndex??(preferred<0?actions.length-1:preferred))),action=actions[index];
  $('explain-tick').disabled=!actions.length;
  $('action-playback').hidden=running||!actions.length;
  $('action-range').max=Math.max(0,actions.length-1);$('action-range').value=index;
  $('action-number').textContent=actions.length?`${index+1} of ${actions.length}`:'';
  $('action-range').setAttribute('aria-valuetext',action?`Action ${index+1} of ${actions.length}: ${explainAction(action).title}`:'No recorded actions');
  $('previous-action').disabled=index===0;$('next-action').disabled=index>=actions.length-1;
  for(const row of $('specimen').querySelectorAll('.routine-explanation ol li')){row.classList.remove('recorded');row.removeAttribute('aria-current');}
  if(action&&action.opcode!=='UPKEEP'){
    const row=$('specimen').querySelector(`.routine-explanation ol li:nth-child(${action.before.pc+1})`);
    if(row){row.classList.add('recorded');row.setAttribute('aria-current','step');}
  }
  if(action){const explanation=explainAction(action);$('action-context').textContent=`#${action.id} · recorded tick ${action.tick} · ${action.opcode}`;$('action-title').textContent=`${explanation.symbol} ${explanation.title}`;$('action-body').textContent=explanation.body;$('action-reserve').textContent=explanation.reserve;
    $('action-note').textContent=`Close-up: immediately after this recorded action, including source reserves. Full field: current tick ${v.tick}. ${running?'Pause with Explain this tick to walk through every action.':'Scrubbing explains the selected program; it does not rewind the world.'}`;
  }else{$('action-context').textContent=v.selectedRecord?`#${v.selectedRecord.id} · current tick ${v.tick}`:'No living programs';$('action-title').textContent=v.selected?'Waiting for an observed action.':v.selectedRecord?'This program died.':'The population went extinct.';$('action-body').textContent=v.selected?'Step once to record this program’s actions. Its readable routine is in the inspector.':'Death recycles material. You can restart or replay a saved tick.';$('action-reserve').textContent=v.selected?`${fmt(v.selected.energy)} energy available.`:'';$('action-note').textContent='The action log begins when this program is observed; imported snapshots contain world state, not past action recordings.';}
  drawAction($('action-world'),v,action);
}
function render(v) {
  view=v;selectedId=v.selectedRecord?.id??null;
  $('population').textContent=fmt(v.summary.population);$('diversity').textContent=fmt(v.summary.genomeDiversity);$('generation').textContent=fmt(v.summary.maxGeneration);
  $('world-name').textContent=title.toUpperCase();$('world-coordinate').textContent=`SEED ${seed} / ${v.config.width} × ${v.config.height}`;$('tick').textContent=`Tick ${fmt(v.tick)}`;
  $('world').setAttribute('aria-label',`${v.summary.population} organisms at tick ${v.tick}. ${v.summary.genomeDiversity} genomes. Arrow keys navigate cells; Enter inspects an organism.`);
  renderer.update(v);renderInspector(v);renderExplanation(v);
  const specimen=v.selectedRecord;$('selected-cue').textContent=specimen?`#${specimen.id} · ${v.selected?`${fmt(v.selected.energy)} energy · generation ${specimen.generation}`:'died'}`:'No organisms remain';$('inspect-jump').textContent=specimen?`Inspect #${specimen.id} ↗`:'Inspect outcome ↗';
  const picker=v.organisms.map(o=>o.id).join(',')+':'+selectedId;
  if(picker!==pickerSignature&&document.activeElement!==$('organism')){pickerSignature=picker;$('organism').innerHTML=`${v.selectedRecord&&!v.selected?`<option value="${v.selectedRecord.id}">#${v.selectedRecord.id} · died</option>`:''}${v.organisms.map(o=>`<option value="${o.id}">#${o.id} · generation ${o.generation}${v.changedAtBirth.includes(o.id)?' · changed at birth':''}</option>`).join('')}`;$('organism').value=selectedId??'';$('organism').disabled=!v.organisms.length;}
  const cp=v.checkpoints.join(',');if(cp!==checkpointSignature){checkpointSignature=cp;$('checkpoint').innerHTML='<option value="">Saved tick…</option>'+v.checkpoints.map(t=>`<option value="${t}">Tick ${fmt(t)}</option>`).join('');}
  const latest=v.events.filter(e=>e.type==='birth'||e.type==='death').slice(-4).reverse();$('activity').innerHTML=latest.length?latest.map(e=>`<li><button data-inspect-id="${e.id}" aria-label="Inspect ${e.type==='birth'?'child':'organism'} ${e.id}">${e.type==='birth'?`#${e.parentId} made child #${e.id}`:`#${e.id} died`}</button><br>${e.type==='birth'?`${e.mutations?`${e.mutations} inherited change${e.mutations===1?'':'s'}`:'exact copy'} · ${fmt(e.transferredEnergy)} energy transferred`:`could not pay ${escape(e.reason?.category??'an operation')}`}<br>tick ${fmt(e.tick)}</li>`).join(''):'<li>Founder established.<br>Watch its first descendants.</li>';
  const a=v.accounting;$('material-account').textContent=`${fmt(a.material.occupied)} occupied + ${fmt(a.material.free)} free = ${fmt(a.material.total)} total. Balanced.`;
  $('material-bar').style.width=`${a.material.total?a.material.occupied/a.material.total*100:0}%`;
  $('energy-account').textContent=`${fmt(a.energy.present)} present + ${fmt(a.energy.spent)} spent + ${fmt(a.energy.dissipated)} dissipated = ${fmt(a.energy.supplied)} supplied. Balanced.`;
  $('patch-energy').textContent=fmt(v.summary.environmentalEnergy);$('organism-energy').textContent=fmt(v.summary.organismEnergy);
  $('budget-note').textContent=`${fmt(v.stats.births)} births · ${fmt(v.stats.deaths)} deaths · ${fmt(v.stats.instructions-v.budget.startInstructions)} / ${fmt(v.budget.instructions)} instructions.`;
  if(v.termination){setRunning(false);$('stage-status').hidden=false;const extinct=v.termination==='extinction';$('stage-status').innerHTML=`<strong>${extinct?'This population went extinct.':'This run reached a limit.'}</strong>${extinct?'Its material returned to the world. Change the circumstances or replay an earlier tick.':`${escape(v.termination)}. This is not evidence of ecological equilibrium.`}`;}
  else if(v.populationLimited){$('stage-status').hidden=false;$('stage-status').innerHTML='<strong>Population safeguard reached.</strong>Reproduction is capped. Increase the limit in a new run before interpreting stability.';}
  else $('stage-status').hidden=true;
  renderTrend();$('step').disabled=running||Boolean(v.termination);$('play').disabled=Boolean(v.termination);
}
function renderTrend(){if(!view)return;const key=$('trend-metric').value;drawTrend($('trend'),view.trends,key);const last=view.trends.at(-1);$('trend').setAttribute('aria-label',`${$('trend-metric').selectedOptions[0].textContent}: initial ${fmt(view.trends[0][key])}, current ${fmt(last[key])}, at tick ${last.tick}.`);$('trend-start').textContent=`tick ${view.trends[0].tick}`;$('trend-end').textContent=`${fmt(last.tick)} ticks`;$('trend-value').textContent=`${fmt(last[key])} now`;}
function updateCell(){if(!view||!renderer.cell)return;const {x,y}=renderer.cell,c=view.cells[y*view.config.width+x],organisms=view.organisms.filter(o=>o.x===x&&o.y===y);$('cell-readout').textContent=`${x},${y} · ${fmt(c.energy)} energy · ${organisms.length} organisms`;}
async function inspect(id){$('follow').checked=false;selectedId=id;const generation=epoch;try{const v=await live.call('inspect',{selectedId:id});if(generation===epoch)render(v);}catch(error){report(error);}}
function selectCell(cell){if(!cell)return;renderer.cell=cell;updateCell();const group=view.organisms.filter(o=>o.x===cell.x&&o.y===cell.y);if(group.length){const index=group.findIndex(o=>o.id===selectedId);inspect(group[(index+1)%group.length].id);}else renderer.draw();}
$('world').addEventListener('click',e=>selectCell(renderer.hit(e.clientX,e.clientY)));
$('world').addEventListener('keydown',e=>{if(!view)return;const cell=renderer.cell??{x:view.selected?.x??0,y:view.selected?.y??0};let{x,y}=cell;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();x=(x+(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)+view.config.width)%view.config.width;y=(y+(e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0)+view.config.height)%view.config.height;renderer.cell={x,y};updateCell();renderer.draw();}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();selectCell(cell);}
});
$('specimen').addEventListener('focusout',()=>queueMicrotask(()=>{if(view)renderInspector(view);}));
$('organism').addEventListener('change',()=>inspect(Number($('organism').value)));
$('follow').addEventListener('change',async()=>{if($('follow').checked){try{render(await live.call('inspect',{selectedId,followLiving:true}));}catch(error){report(error);}}});
$('play').addEventListener('click',()=>setRunning(!running));
function announceAction(){const actions=view?.actions??[],index=Number($('action-range').value);$('action-announcement').textContent=actions[index]?`Action ${index+1} of ${actions.length}. ${explainAction(actions[index]).title} ${explainAction(actions[index]).reserve}`:'';}
$('activity').addEventListener('click',e=>{const button=e.target.closest('[data-inspect-id]');if(button){setRunning(false);inspect(Number(button.dataset.inspectId));}});
$('explain-tick').addEventListener('click',()=>{setRunning(false);actionIndex=0;renderExplanation(view);announceAction();$('action-range').focus({preventScroll:true});});
$('action-range').addEventListener('input',()=>{actionIndex=Number($('action-range').value);renderExplanation(view);announceAction();});
for(const [id,offset]of [['previous-action',-1],['next-action',1]])$(id).addEventListener('click',()=>{actionIndex=Number($('action-range').value)+offset;renderExplanation(view);announceAction();});
$('step').addEventListener('click',async()=>{if(busy)return;busy=true;$('step').disabled=true;const generation=epoch;try{const v=await live.call('advance',{count:1,selectedId,followLiving:$('follow').checked});if(generation===epoch)render(v);}catch(error){report(error);}finally{if(generation===epoch){busy=false;$('step').disabled=Boolean(view?.termination);}}});
$('speed').addEventListener('change',()=>{speed=Number($('speed').value);debt=0;});
$('motion').addEventListener('change',()=>{renderer.motion=$('motion').checked;renderer.draw();});
$('trend-metric').addEventListener('change',renderTrend);
$('restart').addEventListener('click',()=>start(configuration,seed,program,true,title));
$('checkpoint').addEventListener('change',async()=>{if($('checkpoint').value==='')return;setRunning(false);const tick=Number($('checkpoint').value);try{const v=await live.call('rewind',{tick,selectedId,followLiving:$('follow').checked});render(v);$('checkpoint').value='';notice(`Replayed to tick ${tick}. Future checkpoints were discarded; Play continues the same seeded history.`);}catch(error){report(error);}});
$('world-settings').addEventListener('click',()=>{$('rules').open=true;$('rules').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'});$('preset').focus({preventScroll:true});});
$('preset').addEventListener('change',()=>{fillConfiguration(config(PRESETS[$('preset').value].configuration));});
$('config-form').addEventListener('submit',e=>{e.preventDefault();try{const c=editedConfiguration(),s=Number($('seed').value);start(c,s,SEED_PROGRAM,true,PRESETS[$('preset').value].title);}catch(error){inlineError('config-error',error);}});
function download(value,name){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-config').addEventListener('click',()=>{try{download({configuration:editedConfiguration(),seed:Number($('seed').value)},`digital-life-config-${$('seed').value}.json`);}catch(error){report(error);}});
$('export-snapshot').addEventListener('click',async()=>{setRunning(false);try{const s=await live.call('snapshot');download(s,`digital-life-${s.seed}-tick-${s.tick}.json`);notice(`Saved tick ${s.tick}: full state, rules, ancestry, and random streams.`);}catch(error){report(error);}});
$('import-config').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>65536)throw new Error('Configuration exceeds 64 KiB.');const data=JSON.parse(await file.text()),c=config(data.configuration??data);const s=data.seed??seed;if(!Number.isSafeInteger(s)||s<0||s>4294967295)throw new Error('Seed must be an integer from 0 to 4,294,967,295.');fillConfiguration(c);$('seed').value=s;notice('Configuration loaded into the form. Start this world applies it.');}catch(error){inlineError('config-error',error);}e.target.value='';});
$('import-snapshot').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;setRunning(false);try{if(file.size>SESSION_LIMITS.importBytes)throw new Error('Snapshot exceeds the 64 MiB import limit.');const json=await file.text(),v=await live.call('restore',{json});++epoch;busy=false;configuration=v.config;seed=v.seed;program=[...v.founderProgram];title='Restored world';selectedId=null;renderer.cell=null;view=null;render(v);fillConfiguration();setRunning(false);$('snapshot-error').hidden=true;notice(`Opened seed ${seed} at tick ${v.tick}. Step or Play continues its exact state.`);}catch(error){inlineError('snapshot-error',error);}e.target.value='';});
function setExperimentBusy(value){experimentBusy=value;$('compare').disabled=value;$('cancel-experiment').hidden=!value;$('evaluate').disabled=value||!comparison?.candidates.length;$('export-experiment').disabled=value||!comparison;}
$('compare').addEventListener('click',async()=>{
  if(experimentBusy)return;const first=Number($('experiment-seed').value),ticks=Number($('experiment-ticks').value);
  if(!Number.isSafeInteger(first)||first<0||first>4294967291||!Number.isSafeInteger(ticks)||ticks<1||ticks>1000){notice('Choose a starting seed from 0 to 4,294,967,291 and 1..1,000 ticks.',true);return;}
  experiment?.close();experiment=new RPC(progress=>{$('experiment-status').textContent=progress;});comparison=null;assessment=null;$('evaluation-results').innerHTML='';$('experiment-results').innerHTML='<p class="empty-result">Running new matched worlds…</p>'; $('candidate').innerHTML='<option>Comparison in progress</option>'; setExperimentBusy(true);$('candidate').disabled=true;$('experiment-status').textContent='Running matched worlds in a separate worker…';
  const worker=experiment;
  try{const result=await worker.call('compare',{configuration:{...configuration,...(configuration.substitutionPermille||configuration.insertionPermille||configuration.deletionPermille?{}:{substitutionPermille:10,insertionPermille:2,deletionPermille:2})},seeds:Array.from({length:5},(_,i)=>first+i),ticks,program});if(worker!==experiment)return;comparison=result;renderComparison();$('experiment-status').textContent='Five pairs complete. Each stop reason is shown below.';}
  catch(error){if(!error.cancelled){$('experiment-status').textContent=error.message;notice(error.message,true);}}
  finally{if(worker===experiment)setExperimentBusy(false);}
});
function stopLabel(s){return s.termination==='extinction'?`Extinct at ${s.tick}`:s.termination==='tick-budget'?`${s.tick} ticks complete`:`${s.tick} ticks · ${s.termination}`;}
function renderComparison(){const rows=comparison.pairs;
  $('experiment-results').innerHTML=`<div class="table-wrap"><table><caption class="sr-only">Mutation disabled versus enabled across five matched starting worlds</caption><thead><tr><th>Seed</th><th>Population<br>Control → mutation</th><th>Births<br>Control → mutation</th><th>Control outcome</th><th>Mutation outcome</th><th>Inspect</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${p.seed}</td><td>${fmt(p.control.population)} → <strong>${fmt(p.mutation.population)}</strong></td><td>${fmt(p.control.births)} → <strong>${fmt(p.mutation.births)}</strong></td><td>${escape(stopLabel(p.control))}</td><td>${escape(stopLabel(p.mutation))}</td><td><button data-watch="${p.seed}">Watch seed ${p.seed}</button></td></tr>`).join('')}</tbody></table></div><p class="result-note">Matched initial terrain and resources; mutation is the treatment. Terminal populations may span different elapsed horizons when compute limits bind. This comparison uses a population safeguard of ${comparison.configuration.maxPopulation}. Diversity and survival do not establish adaptation.</p>`;
  $('candidate').innerHTML=comparison.candidates.length?comparison.candidates.map((c,i)=>`<option value="${i}">Seed ${c.discoverySeed} · #${c.id} · ${c.program.length} bytes</option>`).join(''):'<option>No distinct living descendants</option>';$('candidate').disabled=!comparison.candidates.length;
}
$('experiment-results').addEventListener('click',e=>{const button=e.target.closest('[data-watch]');if(button && comparison && !experimentBusy){$('preset').value='baseline';start(comparison.configuration,Number(button.dataset.watch),comparison.program,true,'Comparison replay');$('world').scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'center'});}});
$('cancel-experiment').addEventListener('click',()=>{experiment?.close();experiment=null;setExperimentBusy(false);$('experiment-status').textContent='Experiment cancelled. The live world is unchanged.';});
$('export-experiment').addEventListener('click',async()=>{if(!experiment)return;try{const full=await experiment.call('comparison-export');download({...full,assessment},`digital-life-experiment-${full.seeds[0]}.json`);}catch(error){report(error);}});
$('evaluate').addEventListener('click',async()=>{if(!comparison||experimentBusy)return;setExperimentBusy(true);$('experiment-status').textContent='Testing ancestor and descendant on five held-out seeds…';const worker=experiment;
  try{const result=await worker.call('evaluate',{index:Number($('candidate').value)});if(worker!==experiment)return;assessment=result;
    $('evaluation-results').innerHTML=`<h3>Ancestor versus descendant</h3><p class="evaluation-code">Ancestor: ${result.candidate.ancestor.map(hex).join(' ')}<br>Descendant: ${result.candidate.program.map(hex).join(' ')}</p><div class="table-wrap"><table><caption class="sr-only">Matched held-out replay with mutation disabled</caption><thead><tr><th>Held-out seed</th><th>Equal horizon</th><th>Births<br>Ancestor → descendant</th><th>Population<br>Ancestor → descendant</th><th>Descendant outcome</th></tr></thead><tbody>${result.pairs.map(p=>`<tr><td>${p.seed}</td><td>${p.horizon} ticks</td><td>${fmt(p.ancestor.births)} → <strong>${fmt(p.descendant.births)}</strong></td><td>${fmt(p.ancestor.population)} → <strong>${fmt(p.descendant.population)}</strong></td><td>${escape(stopLabel(p.descendant))}</td></tr>`).join('')}</tbody></table></div><p class="result-note">${escape(result.interpretation)} Candidate screening favors terminal survivors; this is an exploratory test.</p>`;$('experiment-status').textContent='Matched replay complete. Export includes this assessment.';
  }catch(error){if(!error.cancelled){$('experiment-status').textContent=error.message;notice(error.message,true);}}finally{if(worker===experiment)setExperimentBusy(false);}
});
setInterval(async()=>{
  const now=performance.now(),elapsed=Math.min(.2,(now-lastClock)/1000);lastClock=now;if(!running||busy||document.hidden)return;debt=Math.min(120,debt+elapsed*speed);const count=Math.floor(debt);if(count<1)return;debt-=count;busy=true;const generation=epoch;
  try{const v=await live.call('advance',{count,selectedId,followLiving:$('follow').checked});if(generation===epoch)render(v);}catch(error){report(error);}finally{if(generation===epoch)busy=false;}
},50);
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,button,a,summary'))return;if(e.key.toLowerCase()==='p'){e.preventDefault();setRunning(!running);}else if(e.key.toLowerCase()==='s'){e.preventDefault();setRunning(false);$('step').click();}});
function animate(now){if(renderer.motion&&(renderer.effects.length||now-renderer.changedAt<100))renderer.draw(now);requestAnimationFrame(animate);}requestAnimationFrame(animate);
new ResizeObserver(()=>{renderer.draw();renderTrend();if(view)renderExplanation(view);}).observe($('world'));
document.addEventListener('visibilitychange',()=>{debt=0;lastClock=performance.now();});
fillConfiguration();start();
