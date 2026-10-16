const data = await (await fetch('behavior-data.json')).json();
const slider = document.querySelector('#frame');
const svg = document.querySelector('#world');
const closeup = !!document.querySelector('.microscope');
if(document.querySelector('.atlas'))slider.value='12';
function render() {
  const w = data.frames[Number(slider.value)];
  document.querySelector('#tick').textContent = w.tick;
  document.querySelector('#population').textContent = w.organisms.length;
  document.querySelector('#births').textContent = w.stats.births.toLocaleString('en-US');
  document.querySelector('#deaths').textContent = w.stats.deaths.toLocaleString('en-US');
  const chosen = w.organisms.find(o=>o.id===93)??w.organisms[0];
  const selected=chosen?.id;
  document.querySelector('#selection').textContent=chosen?`Selected #${chosen.id} · ${chosen.energy.toLocaleString('en-US')} energy · generation ${chosen.generation}`:'No living program';
  const unit = closeup?120:600 / w.config.width;
  const position=(x,y)=>closeup?{x:(x-chosen.x+26)%24,y:(y-chosen.y+26)%24}:{x,y};
  let content = '<rect width="600" height="600" fill="#18352b"/>';
  w.cells.forEach((c,i)=>{const p=position(i%24,Math.floor(i/24));if(c.source&&(!closeup||(p.x<5&&p.y<5))) content += `<rect x="${p.x*unit+1}" y="${p.y*unit+1}" width="${unit-2}" height="${unit-2}" rx="3" fill="#8aba75" opacity="${.12+.65*c.energy/w.config.patchCapacity}"/>`;});
  const groups = new Map();
  for(const o of w.organisms){const key=o.y*24+o.x;const group=groups.get(key)??[];group.push(o);groups.set(key,group);}
  for(const group of groups.values()){
    const o=group.find(o=>o.id===selected)??group[0],p=position(o.x,o.y);
    if(closeup&&(p.x>=5||p.y>=5))continue;
    const x=(p.x+.5)*unit,y=(p.y+.5)*unit,r=(closeup?4:1)*(3+4*Math.sqrt(o.energy/w.config.maxEnergy)),color=o.id===selected?'#f1c074':'#e1f0ca';
    content+=`<g><title>Program ${o.id}: ${o.energy} energy, generation ${o.generation}; ${group.length} programs in cell</title><circle cx="${x}" cy="${y}" r="${r}" stroke="${color}" stroke-width="1.7" fill="#14261d"/><path d="M${x} ${y}l${[0,7,0,-7][o.direction]} ${[-7,0,7,0][o.direction]}" stroke="${color}"/>${group.length>1?`<circle cx="${x+7}" cy="${y-7}" r="2" fill="${color}"/>`:''}</g>`;
  }
  svg.innerHTML=content;
  const heading=document.querySelector('#headline');
  if(heading)heading.textContent=w.tick===0?'One program starts on an energy patch.':`${w.organisms.length} programs are alive after ${w.tick} ticks.`;
}
slider.addEventListener('input',render);render();
