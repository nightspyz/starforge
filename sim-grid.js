/* =====================================================================
   CHAPTER 5.7 — grid lab: an interactive electrical grid. Nuclear and
   fusion run near-flat; solar follows a real day/night curve; wind is
   noisy. Set the mix and demand, and watch whether supply keeps up.
   ===================================================================== */
(() => {
"use strict";
const cv = document.getElementById('gridCv'); if(!cv) return;
const ctx = cv.getContext('2d');
const bar = document.getElementById('gMixBar');
const demandEl = document.getElementById('gDemand'), demandV = document.getElementById('gDemandV');
const runBtn = document.getElementById('gRun'), stormBtn = document.getElementById('gStorm');
let W=0,H=0,DPR=1,visible=false;
function resize(){
  DPR = Math.min(2, devicePixelRatio||1); const r = cv.getBoundingClientRect();
  W = r.width; H = r.height; cv.width = W*DPR; cv.height = H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize', resize); resize();
function txt(s,x,y,font,col,align){ ctx.font=font; ctx.fillStyle=col; ctx.textAlign=align||'left'; ctx.textBaseline='middle'; ctx.fillText(s,x,y); }

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LEVEL_NAMES = ['Off','Low','Med','High'];
const SOURCES = [
  {id:'nuclear', label:'Nuclear', col:'#7FA6FF', levels:[0,22,42,60], flat:true},
  {id:'fusion',  label:'Fusion',  col:'#F6C35B', levels:[0,18,36,55], flat:true},
  {id:'solar',   label:'Solar',   col:'#6EE39A', levels:[0,22,46,76], kind:'solar'},
  {id:'wind',    label:'Wind',    col:'#F2607A', levels:[0,18,40,68], kind:'wind'}
];
let levelIdx = {nuclear:2, fusion:0, solar:2, wind:1};
let demand = +demandEl.value || 55;
let storm = false, run = true;
let simT = 0, lastMs = null;

function buildBar(){
  bar.innerHTML = SOURCES.map(s => `<button type="button" data-src="${s.id}">${s.label}: ${LEVEL_NAMES[levelIdx[s.id]]}</button>`).join('');
  bar.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.src;
      levelIdx[id] = (levelIdx[id]+1) % LEVEL_NAMES.length;
      b.textContent = `${SOURCES.find(s=>s.id===id).label}: ${LEVEL_NAMES[levelIdx[id]]}`;
      b.classList.toggle('on', levelIdx[id] > 0);
      if(reduce) draw();
    });
  });
}
buildBar();

demandEl.addEventListener('input', () => { demand = +demandEl.value; demandV.textContent = demand; if(reduce) draw(); });
demandV.textContent = demand;

runBtn.addEventListener('click', () => { run = !run; runBtn.textContent = run ? 'Pause' : 'Resume'; lastMs = null; kick(); });
stormBtn.addEventListener('click', () => { storm = !storm; stormBtn.classList.toggle('on', storm); if(reduce) draw(); });

function dayFactor(st){ const day = (st % 24)/24; return Math.max(0, Math.sin(day*Math.PI*2)); }
function windFactor(st){ return Math.max(0, Math.min(1, 0.5 + 0.32*Math.sin(st*0.17) + 0.24*Math.sin(st*0.53+1.3) + 0.16*Math.sin(st*1.1+2.7))); }
function flatFactor(st, ph){ return 0.9 + 0.07*Math.sin(st*0.1+ph); }

function outputs(st){
  return SOURCES.map(s => {
    const cap = s.levels[levelIdx[s.id]];
    let f = 1;
    if(s.kind === 'solar') f = storm ? 0 : dayFactor(st);
    else if(s.kind === 'wind') f = storm ? 0 : windFactor(st);
    else f = flatFactor(st, s.id === 'nuclear' ? 0 : 2.1);
    return {s, cap, f, out: cap*f};
  });
}

function draw(){
  ctx.fillStyle = '#0a0e16'; ctx.fillRect(0,0,W,H);
  const OUT = outputs(simT);
  const supply = OUT.reduce((a,o)=>a+o.out, 0);
  const ratio = supply / Math.max(1, demand);
  const brown = Math.max(0, 1-ratio);
  const flicker = brown > 0.03 ? (0.6 + 0.4*Math.sin(simT*9)) : 1;

  const srcX = W*0.13, hubX = W*0.52, hubY = H*0.42, cityX = W*0.86;
  const srcYs = SOURCES.map((_,i) => H*(0.14 + i*0.62/(SOURCES.length-1)));

  SOURCES.forEach((s,i) => {
    const o = OUT[i], on = o.cap > 0;
    const sy = srcYs[i];
    ctx.strokeStyle = on ? s.col : 'rgba(120,130,150,.15)';
    ctx.globalAlpha = on ? 0.25+0.45*o.f : 0.1;
    ctx.lineWidth = on ? 1 + 2*o.f : 1;
    ctx.beginPath(); ctx.moveTo(srcX+42, sy); ctx.quadraticCurveTo((srcX+hubX)/2, sy, hubX-28, hubY); ctx.stroke();
    ctx.globalAlpha = 1;
    if(on && !reduce){
      for(let k=0;k<3;k++){
        const p = ((simT*(0.15+o.f*0.3) + k/3) % 1);
        const px = srcX+42 + (hubX-28-(srcX+42))*p, py = sy + (hubY-sy)*p*p*(3-2*p);
        ctx.beginPath(); ctx.arc(px,py,2.2,0,Math.PI*2); ctx.fillStyle = s.col; ctx.fill();
      }
    }
    ctx.beginPath(); ctx.arc(srcX, sy, 15, 0, Math.PI*2);
    ctx.fillStyle = on ? 'rgba(15,20,30,.9)' : 'rgba(15,20,30,.6)';
    ctx.fill(); ctx.strokeStyle = on ? s.col : 'rgba(120,130,150,.35)'; ctx.lineWidth = 1.4; ctx.stroke();
    txt(s.label[0], srcX, sy, '11px monospace', on ? s.col : 'rgba(150,160,180,.5)', 'center');
    txt(Math.round(o.out), srcX, sy+26, '10px monospace', 'rgba(230,235,245,.6)', 'center');
  });

  const hubR = 16 + Math.min(24, supply*0.14);
  const g = ctx.createRadialGradient(hubX,hubY,2,hubX,hubY,hubR*1.6);
  g.addColorStop(0, `rgba(246,195,91,${0.35*Math.min(1,ratio)})`); g.addColorStop(1,'rgba(246,195,91,0)');
  ctx.beginPath(); ctx.arc(hubX,hubY,hubR*1.6,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  ctx.strokeStyle = ratio>=1 ? 'rgba(110,227,154,.7)' : 'rgba(242,96,122,.7)'; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.arc(hubX,hubY,hubR,0,Math.PI*2); ctx.stroke();

  ctx.strokeStyle = `rgba(127,166,255,${0.15+0.35*Math.min(1,ratio)})`; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(hubX+hubR*0.8,hubY); ctx.quadraticCurveTo((hubX+cityX)/2, H*0.5, cityX-30, H*0.5); ctx.stroke();

  // city: buildings dim/brighten & flicker with supply vs demand
  ctx.save();
  const cityGroundY = H*0.78;
  for(let i=0;i<7;i++){
    const bw = W*0.045, bh = H*(0.14+((i*37)%5)*0.07);
    const bxp = cityX-40 + i*bw*1.25;
    ctx.fillStyle = '#0c1420'; ctx.fillRect(bxp, cityGroundY-bh, bw, bh);
    const lit = Math.min(1, ratio) * flicker;
    ctx.fillStyle = `rgba(255,${200*lit|0},${90*lit|0},${0.15+0.55*lit})`;
    for(let wy=cityGroundY-bh+8; wy<cityGroundY-6; wy+=10) for(let wx=bxp+3; wx<bxp+bw-3; wx+=8){
      if(((wx+wy)|0)%3===0) ctx.fillRect(wx,wy,3,4);
    }
  }
  ctx.restore();

  txt(`Supply ${Math.round(supply)}`, 14, H-30, '12px monospace', 'rgba(230,235,245,.65)', 'left');
  txt(`Demand ${Math.round(demand)}`, 14, H-14, '12px monospace', 'rgba(230,235,245,.65)', 'left');
  txt(ratio>=1 ? 'Meeting demand' : 'Brownout', W-14, H-14, '600 12px monospace', ratio>=1 ? '#6EE39A' : '#F2607A', 'right');
  if(storm) txt('Cloudy & still: solar + wind at zero', W-14, H-30, '11px monospace', 'rgba(230,235,245,.5)', 'right');
}

let raf = null;
function loop(ms){
  if(!visible){ raf = null; return; }
  if(!reduce && run){
    if(lastMs===null) lastMs = ms;
    simT += Math.min(0.25, (ms-lastMs)/1000);
    lastMs = ms;
    draw();
  } else if(reduce && lastMs===null){
    lastMs = ms; draw();
  }
  raf = requestAnimationFrame(loop);
}
function kick(){ if(!raf && visible) raf = requestAnimationFrame(loop); }
new IntersectionObserver(es => { for(const e of es){ visible = e.isIntersecting; if(visible){ if(!W) resize(); draw(); kick(); } } }, {threshold:0.05}).observe(cv);
draw();
})();
