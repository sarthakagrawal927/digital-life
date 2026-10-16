const styles=getComputedStyle(document.documentElement);
const color=name=>styles.getPropertyValue(name).trim();
const ink=color('--organism'),accent=color('--accent'),muted=color('--muted'),field=color('--field'),source=color('--source'),grid=color('--grid'),line=color('--line'),death=color('--death');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function context(canvas) {
  const rect = canvas.getBoundingClientRect(), scale = Math.min(2, devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * scale)), height = Math.max(1, Math.round(rect.height * scale));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d'); ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}
export class FieldRenderer {
  constructor(canvas) { this.canvas = canvas; this.state = null; this.previous = new Map(); this.effects = []; this.seenEvents = new Set(); this.changedAt = 0; this.motion = true; this.cell = null; }
  update(state) {
    const old = this.state, now = performance.now();
    this.previous = new Map((old?.organisms ?? []).map(o => [o.id, o]));
    if (!old || state.tick < old.tick || state.seed !== old.seed) { this.effects = []; this.seenEvents.clear(); this.previous.clear(); }
    for (const event of state.events) {
      const key = `${event.type}:${event.id}:${event.tick}:${event.sequence}`;
      if (!this.seenEvents.has(key)) { this.seenEvents.add(key); this.effects.push({ ...event, time: now }); }
    }
    if (this.seenEvents.size > 500) this.seenEvents = new Set(state.events.map(e => `${e.type}:${e.id}:${e.tick}:${e.sequence}`));
    this.effects = this.effects.slice(-96); this.state = state; this.changedAt = now;
    this.draw(now);
  }
  geometry() {
    const rect = this.canvas.getBoundingClientRect(), c = this.state.config;
    const unit = Math.min(rect.width / c.width, rect.height / c.height);
    return { unit, left: (rect.width - c.width * unit) / 2, top: (rect.height - c.height * unit) / 2 };
  }
  hit(clientX, clientY) {
    if (!this.state) return null;
    const rect = this.canvas.getBoundingClientRect(), { unit, left, top } = this.geometry();
    const x = Math.floor((clientX - rect.left - left) / unit), y = Math.floor((clientY - rect.top - top) / unit);
    return x >= 0 && y >= 0 && x < this.state.config.width && y < this.state.config.height ? { x, y } : null;
  }
  draw(now = performance.now()) {
    if (!this.state) return false;
    const { ctx, width, height } = context(this.canvas), { unit, left, top } = this.geometry(), w = this.state;
    const fieldWidth = unit * w.config.width, fieldHeight = unit * w.config.height;
    ctx.clearRect(0, 0, width, height); ctx.fillStyle = field; ctx.fillRect(left, top, fieldWidth, fieldHeight);
    ctx.globalAlpha=.4;ctx.lineWidth = .5; ctx.strokeStyle = grid; ctx.beginPath();
    for (let x = 0; x <= w.config.width; x++) { ctx.moveTo(left+x*unit,top); ctx.lineTo(left+x*unit,top+fieldHeight); }
    for (let y = 0; y <= w.config.height; y++) { ctx.moveTo(left,top+y*unit); ctx.lineTo(left+fieldWidth,top+y*unit); }
    ctx.stroke();ctx.globalAlpha=1;
    w.cells.forEach((c, i) => {
      if (!c.source) return;
      const energy = w.config.patchCapacity ? c.energy / w.config.patchCapacity : 0;
      ctx.globalAlpha = .06 + .52 * energy; ctx.fillStyle = source;
      const inset = Math.min(2, unit*.1); ctx.beginPath(); ctx.roundRect(left+(i%w.config.width)*unit+inset,top+Math.floor(i/w.config.width)*unit+inset,unit-2*inset,unit-2*inset,Math.min(4,unit*.15)); ctx.fill();
    }); ctx.globalAlpha = 1;
    const groups = new Map(); for (const o of w.organisms) { const key = o.y*w.config.width+o.x; const group=groups.get(key)??[];group.push(o);groups.set(key,group); }
    const selectedId = w.selectedRecord?.id, t = this.motion ? clamp((now-this.changedAt)/90,0,1) : 1;
    for (const group of groups.values()) {
      const o = group.find(o => o.id === selectedId) ?? group[0], prev = this.previous.get(o.id);
      let ox=o.x, oy=o.y;
      if (prev && Math.abs(o.x-prev.x)<=1 && Math.abs(o.y-prev.y)<=1) { ox=prev.x+(o.x-prev.x)*t;oy=prev.y+(o.y-prev.y)*t; }
      const x=left+(ox+.5)*unit,y=top+(oy+.5)*unit,r=Math.max(1.3,unit*(.15+Math.sqrt(o.energy/Math.max(1,w.config.maxEnergy))*.18)), active=o.id===selectedId;
      if(active){ctx.strokeStyle=accent;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(x,y,unit*.46,0,Math.PI*2);ctx.stroke();}
      ctx.strokeStyle=active?accent:ink;ctx.fillStyle=field;ctx.lineWidth=Math.max(.8,unit*.045);
      const dx=[0,1,0,-1][o.direction],dy=[-1,0,1,0][o.direction];ctx.beginPath();ctx.moveTo(x+dx*r,y+dy*r);ctx.lineTo(x+dx*(r+unit*.13),y+dy*(r+unit*.13));ctx.stroke();
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=active?accent:ink;ctx.beginPath();ctx.arc(x,y,Math.max(.6,r*.28),0,Math.PI*2);ctx.fill();
      if(group.length>1){ctx.beginPath();ctx.arc(x+r*.9,y-r*.9,Math.max(.7,unit*.07),0,Math.PI*2);ctx.fill();}
    }
    if(this.cell){ctx.strokeStyle=accent;ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.strokeRect(left+this.cell.x*unit+1,top+this.cell.y*unit+1,unit-2,unit-2);ctx.setLineDash([]);}
    this.effects=this.effects.filter(e=>now-e.time<700);
    if(this.motion) for(const e of this.effects){const p=(now-e.time)/700,x=left+(e.x+.5)*unit,y=top+(e.y+.5)*unit;ctx.globalAlpha=(1-p)*.75;ctx.strokeStyle=e.type==='death'?death:e.type==='harvest'?source:e.mutations?accent:ink;ctx.lineWidth=1.3;
      ctx.beginPath();if(e.type==='birth')ctx.arc(x,y,unit*(.18+p*.65),0,Math.PI*2);
      else if(e.type==='harvest'){ctx.arc(x,y,unit*(.6-p*.35),0,Math.PI*2);ctx.font='11px Menlo,monospace';ctx.fillStyle=ink;ctx.fillText(`+${e.amount}`,clamp(x+unit*.3,left,left+fieldWidth-48),y-unit*(.3+p));}
      else if(e.type==='move'){if(Math.abs(e.x-e.from.x)<=1&&Math.abs(e.y-e.from.y)<=1){ctx.moveTo(left+(e.from.x+.5)*unit,top+(e.from.y+.5)*unit);ctx.lineTo(x,y);}}
      else{const r=unit*(.18+p*.1);ctx.moveTo(x-r,y-r);ctx.lineTo(x+r,y+r);ctx.moveTo(x+r,y-r);ctx.lineTo(x-r,y+r);}ctx.stroke();}
    ctx.globalAlpha=1;
    const selected=w.selected,actions=w.actions??[],action=actions.findLast(a=>a.death||a.reproduction?.childId)??actions.findLast(a=>['HARVEST','MOVE','REPRODUCE'].includes(a.opcode));
    if(selected&&action){const message=action.opcode==='HARVEST'?`#${selected.id} +${action.harvested??0} energy`:action.opcode==='MOVE'?`#${selected.id} moved`:`#${selected.id} ${action.reproduction?.childId?`made #${action.reproduction.childId}`:'copy failed'}`;
      ctx.font='11px Menlo,monospace';const tw=ctx.measureText(message).width+16,x=clamp(left+(action.after.x+.5)*unit+10,left+4,left+fieldWidth-tw-4),y=clamp(top+(action.after.y+.5)*unit-30,top+4,top+fieldHeight-28);
      ctx.fillStyle=field;ctx.fillRect(x,y,tw,24);ctx.strokeStyle=accent;ctx.lineWidth=.8;ctx.strokeRect(x,y,tw,24);ctx.fillStyle=accent;ctx.fillText(message,x+8,y+16);
    }
    return this.motion && (t<1 || this.effects.length>0);
  }
}
export function drawAction(canvas, world, action = null) {
  const {ctx,width,height}=context(canvas), unit=Math.min(width,height)/3,left=(width-unit*3)/2,top=(height-unit*3)/2;
  ctx.clearRect(0,0,width,height);ctx.fillStyle=field;ctx.fillRect(0,0,width,height);
  const before=action?.before??world.selected, after=action?.after??world.selected;
  if(!before){canvas.setAttribute('aria-label','No selected program to show.');return;}
  const cells=action?.cells??Array.from({length:9},(_,i)=>{const dx=i%3-1,dy=Math.floor(i/3)-1,x=(before.x+dx+world.config.width)%world.config.width,y=(before.y+dy+world.config.height)%world.config.height;return{dx,dy,x,y,...world.cells[y*world.config.width+x]};});
  for(const c of cells){const x=left+(c.dx+1)*unit,y=top+(c.dy+1)*unit;
    ctx.strokeStyle=grid;ctx.lineWidth=.5;ctx.strokeRect(x+1,y+1,unit-2,unit-2);
    if(c.source){ctx.globalAlpha=.08+.5*c.energy/Math.max(1,world.config.patchCapacity);ctx.fillStyle=source;ctx.fillRect(x+2,y+2,unit-4,unit-4);ctx.globalAlpha=1;}
    ctx.font='9px Menlo,monospace';ctx.fillStyle=muted;ctx.fillText(`${c.x},${c.y}`,x+4,y+12);
  }
  const relative=(next,prev,size)=>next===prev?0:next===(prev+1)%size?1:next===(prev-1+size)%size?-1:0;
  const dx=relative(after.x,before.x,world.config.width),dy=relative(after.y,before.y,world.config.height),x=left+(1.5+dx)*unit,y=top+(1.5+dy)*unit,r=unit*.24;
  if(action?.opcode==='MOVE'&&!after.dead){ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(left+1.5*unit,top+1.5*unit);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);}
  ctx.strokeStyle=after.dead?death:accent;ctx.lineWidth=2;ctx.fillStyle=field;ctx.beginPath();
  if(after.dead){ctx.moveTo(x-r,y-r);ctx.lineTo(x+r,y+r);ctx.moveTo(x+r,y-r);ctx.lineTo(x-r,y+r);}else{ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}ctx.stroke();
  if(!after.dead){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+[0,1,0,-1][after.direction]*r*1.5,y+[-1,0,1,0][after.direction]*r*1.5);ctx.stroke();}
  if(action?.reproduction?.childId){ctx.beginPath();ctx.arc(x+r*.9,y-r*.9,r*.65,0,Math.PI*2);ctx.stroke();}
  if(action?.harvested){ctx.fillStyle=ink;ctx.font='12px Menlo,monospace';ctx.fillText(`+${action.harvested}`,clamp(x-r,left+2,left+3*unit-50),y-r-7);}
  canvas.setAttribute('aria-label',`${action?'Recorded':'Current'} close-up of #${action?.id??world.selected.id}: ${action?.opcode??'current state'}, position ${after.x},${after.y}, reserve ${after.energy} energy. ${action?.harvested?`Harvested ${action.harvested}.`:''}`);
}
export function drawTrend(canvas, trends, metric) {
  const { ctx, width, height } = context(canvas);
  ctx.clearRect(0,0,width,height);
  if (!trends.length) return;
  const first=trends[0].tick,last=trends.at(-1).tick,max=Math.max(1,...trends.map(t=>t[metric]));
  ctx.strokeStyle=line;ctx.lineWidth=.6;ctx.beginPath();for(const f of [0,.5,1]){ctx.moveTo(0,8+f*(height-16));ctx.lineTo(width,8+f*(height-16));}ctx.stroke();
  ctx.beginPath();trends.forEach((p,i)=>{const x=(p.tick-first)/Math.max(1,last-first)*width,y=height-8-p[metric]/max*(height-16);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.lineWidth=1.5;ctx.strokeStyle=ink;ctx.stroke();
  const end=trends.at(-1),x=width-2,y=height-8-end[metric]/max*(height-16);ctx.fillStyle=ink;ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=muted;ctx.font='9px Menlo,monospace';ctx.fillText(max.toLocaleString('en-US'),4,10);
}
