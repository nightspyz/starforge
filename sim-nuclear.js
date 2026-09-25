/* =====================================================================
   LIVE LAB — NUCLEAR FORCE
   Ported unchanged in physics from "From Particles to Life"
   (Live lab → Nuclear force). Strong attraction is short-range
   (a Morse potential); electric repulsion between protons is not.
   That single difference is why nuclei have a maximum size, and
   why heavy ones can split.
   ===================================================================== */
(() => {
"use strict";
const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const fmt = (v,d=2) => Number(v).toFixed(d);

/* same semi-empirical mass formula as the Star Forge, our universe's coefficients */
const aV=15.75, aS0=17.8, aC0=0.711, aA=23.7, apair=11.18;
function B(A, Z, al){
  const N = A - Z;
  if(A < 2 || Z < 1 || N < 0) return -1e9;
  const even = x => x % 2 === 0;
  const d = (even(Z) && even(N)) ? apair/Math.sqrt(A) : ((!even(Z) && !even(N)) ? -apair/Math.sqrt(A) : 0);
  return aV*A - aS0*Math.pow(A,2/3) - aC0*al*Z*(Z-1)/Math.cbrt(A) - aA*(A-2*Z)*(A-2*Z)/A + d;
}

function fit(cv){
  const ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
  if(!r.width) return null;
  cv.width = Math.round(r.width*dpr); cv.height = Math.round(r.height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx, W:r.width, H:r.height};
}
function rrect(ctx,x,y,w,h,r){ ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,w,h,r); else ctx.rect(x,y,w,h); }
function txt(ctx,s,x,y,font,col,align){ ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align||'left'; ctx.textBaseline = 'middle'; ctx.fillText(s,x,y); }
function circle(ctx,x,y,r,col,line){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle = col; ctx.fill(); if(line){ ctx.strokeStyle=line; ctx.lineWidth=0.05; ctx.stroke(); } }
function nlabel(ctx,s,x,y,size,col){ ctx.font = `700 ${size}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=col; ctx.fillText(s,x,y); }

const cv = $('nucCv');
let W=0, H=0, run=true, acc=0, visible=false, started=false;
let p = [], T = 0.25, EM = 1, stats = {};
const SC = () => 13;
const rnd2 = (a,b) => a + Math.random()*(b-a);
function add(o){ p.push(Object.assign({x:0,y:0,vx:0,vy:0,m:1}, o)); return p[p.length-1]; }
function nucleon(kind,x,y){ return add({kind,x,y,vx:rnd2(-1,1),vy:rnd2(-1,1),m:1,r:0.58}); }
const panelH = () => W < 640 ? 128 : 150;
const worldW = () => W/SC(), worldH = () => (H - panelH())/SC();
function wall(q, bounce){
  const R = q.r || 0.5, ww = worldW(), wh = worldH();
  if(q.x < R){ q.x = R; q.vx = Math.abs(q.vx)*bounce; }
  if(q.x > ww-R){ q.x = ww-R; q.vx = -Math.abs(q.vx)*bounce; }
  if(q.y < R){ q.y = R; q.vy = Math.abs(q.vy)*bounce; }
  if(q.y > wh-R){ q.y = wh-R; q.vy = -Math.abs(q.vy)*bounce; }
}
function thermostat(target, rate){
  let ke = 0; for(const q of p) ke += 0.5*q.m*(q.vx*q.vx + q.vy*q.vy);
  const cur = p.length ? ke/p.length : 0;
  if(cur <= 0){ if(target > 0) for(const q of p){ q.vx += rnd2(-1,1)*0.2; q.vy += rnd2(-1,1)*0.2; } return cur; }
  const f = Math.sqrt(1 + rate*(target/cur - 1));
  if(isFinite(f)) for(const q of p){ q.vx *= f; q.vy *= f; }
  return cur;
}

const NUC = {r0:1.16, a:1.45, cut:2.2, kc:2.4};
function step(dt){
  const D = 4.2, kc = NUC.kc*EM;
  for(const q of p){ q.fx = 0; q.fy = 0; }
  for(let i=0;i<p.length;i++) for(let j=i+1;j<p.length;j++){
    const A = p[i], Bq = p[j];
    let dx = Bq.x-A.x, dy = Bq.y-A.y, r2 = dx*dx+dy*dy;
    if(r2 < 1e-6) r2 = 1e-6;
    const r = Math.sqrt(r2); let f = 0;
    if(r < NUC.cut){
      const e = Math.exp(-NUC.a*(r - NUC.r0));
      f = -2*D*NUC.a*(e*e - e);
    }
    if(A.kind==='p' && Bq.kind==='p'){ f -= kc/Math.max(r2,0.36); }
    const ux = dx/r, uy = dy/r;
    A.fx += f*ux; A.fy += f*uy; Bq.fx -= f*ux; Bq.fy -= f*uy;
  }
  for(const q of p){
    q.vx += q.fx/q.m*dt; q.vy += q.fy/q.m*dt;
    q.x += q.vx*dt; q.y += q.vy*dt; wall(q, 0.85);
  }
  thermostat(T*0.9, 0.06);
}
function clusters(cut){
  const par = p.map((_,i)=>i), find = i => par[i]===i?i:(par[i]=find(par[i]));
  for(let i=0;i<p.length;i++) for(let j=i+1;j<p.length;j++){
    const dx = p[i].x-p[j].x, dy = p[i].y-p[j].y;
    if(dx*dx+dy*dy < cut*cut){ const a=find(i), b=find(j); if(a!==b) par[a]=b; }
  }
  const g = {}; p.forEach((q,i)=>(g[find(i)]=g[find(i)]||[]).push(q));
  return Object.values(g).sort((a,b)=>b.length-a.length);
}
function ballOfNucleons(A, Z, cx, cy){
  const list = []; for(let i=0;i<A;i++) list.push(i<Z?'p':'n');
  for(let i=list.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [list[i],list[j]]=[list[j],list[i]]; }
  const R = 0.62*Math.sqrt(A);
  list.forEach((k,i) => {
    const a = i*2.399963, rr = R*Math.sqrt(i/A);
    const q = nucleon(k, cx+rr*Math.cos(a), cy+rr*Math.sin(a));
    q.vx *= 0.15; q.vy *= 0.15;
  });
}
function clear(){ p = []; stats = {}; }

const SETUPS = [
  {n:'Carbon-12', f:() => { clear(); ballOfNucleons(12,6, worldW()/2, worldH()/2); T=0.25; }},
  {n:'Iron-56', f:() => { clear(); ballOfNucleons(56,26, worldW()/2, worldH()/2); T=0.25; }},
  {n:'Uranium-238', f:() => { clear(); ballOfNucleons(238,92, worldW()/2, worldH()/2); T=0.2; }},
  {n:'Free nucleons', f:() => { clear(); for(let i=0;i<70;i++) nucleon(i%2?'p':'n', rnd2(2,worldW()-2), rnd2(2,worldH()-2)); T=1.2; }}
];

function draw(){
  const f = fit(cv); if(!f) return; const {ctx} = f; W = f.W; H = f.H;
  ctx.clearRect(0,0,W,H);
  const narrow = W < 640;
  const cls = clusters(1.75), big = cls[0];
  ctx.save(); ctx.scale(SC(), SC());
  if(big && big.length > 2){
    let cx=0,cy=0; for(const q of big){ cx+=q.x; cy+=q.y; } cx/=big.length; cy/=big.length;
    let rad=0; for(const q of big) rad=Math.max(rad, Math.hypot(q.x-cx,q.y-cy));
    ctx.beginPath(); ctx.arc(cx,cy,rad+0.5,0,Math.PI*2);
    ctx.fillStyle='rgba(127,166,255,.06)'; ctx.fill();
    ctx.strokeStyle='rgba(127,166,255,.28)'; ctx.lineWidth=0.06; ctx.setLineDash([0.25,0.25]); ctx.stroke(); ctx.setLineDash([]);
  }
  for(const q of p){
    const pr = q.kind==='p';
    circle(ctx,q.x,q.y,q.r, pr?'#F2607A':'#7FA6FF', 'rgba(255,255,255,.35)');
    nlabel(ctx, pr?'p':'n', q.x, q.y+0.02, 0.5, pr?'#3d0d12':'#0d1526');
  }
  ctx.restore();
  stats.clusters = cls.length; stats.big = big?big.length:0; stats.bigZ = big?big.filter(q=>q.kind==='p').length:0;

  const bz = stats.bigZ||0, ba = stats.big||0, bn = ba-bz;
  const bound = ba>3 ? B(ba,bz,EM) : 0;
  const lines = [
    ['Largest nucleus', ba?`${ba}  (Z=${bz}, N=${bn})`:'—', ba>2?'#3ddc84':'#8d99b3'],
    ['Fragments', stats.clusters||0, (stats.clusters||0)>1?'#ffd23f':'#8d99b3'],
    [narrow?'Binding':'Binding (mass formula)', ba>3?(narrow?`${(bound/ba).toFixed(1)}/nucleon`:`${bound.toFixed(0)} MeV = ${(bound/ba).toFixed(1)}/nucleon`):'—', bound>0?'#3ddc84':'#ff5c5c'],
    ['Electromagnetism', `×${fmt(EM,2)}`, EM>1.5?'#ff5c5c':'#8d99b3']
  ];
  const lh = narrow ? 16 : 19, fs = narrow ? '10px' : '11.5px';
  const bw = Math.min(narrow?220:300, W-20), bh = (narrow?16:22) + lines.length*lh;
  rrect(ctx, W - bw - (narrow?8:12), narrow?8:12, bw, bh, 8); ctx.fillStyle='rgba(11,15,24,.82)'; ctx.fill();
  ctx.strokeStyle='rgba(38,49,74,.9)'; ctx.lineWidth=1; ctx.stroke();
  lines.forEach(([a,b,col],i) => {
    const y = (narrow?18:30) + i*lh;
    txt(ctx, a, W-bw+(narrow?4:2), y, `${fs} system-ui`, '#8d99b3');
    txt(ctx, String(b), W-(narrow?12:22), y, `700 ${fs} ui-monospace,Menlo,monospace`, col, 'right');
  });
  if(stats.clusters > 3 && stats.big < p.length*0.6){
    txt(ctx, narrow ? '💥 fission: repulsion beat the strong force' : '💥 the nucleus is breaking apart: electric repulsion beat the strong force', 14, H-14, '700 12px system-ui', '#ff5c5c');
  }
}

let raf = null;
function loop(){
  if(!visible){ raf = null; return; }
  if(run && p.length){
    acc = Math.min(acc + 0.016, 0.05);
    let n = 0;
    while(acc > 0.009 && n++ < 14){ acc -= 0.009; step(0.009*3); }
  }
  draw();
  raf = requestAnimationFrame(loop);
}
function kick(){ if(!raf && visible) raf = requestAnimationFrame(loop); }

function renderBar(){
  $('nSetups').innerHTML = SETUPS.map((s,i) => `<button type="button" data-s="${i}">${s.n}</button>`).join('');
  $('nSetups').querySelectorAll('[data-s]').forEach((b,i) => b.onclick = () => {
    SETUPS[i].f(); syncT();
    $('nSetups').querySelectorAll('button').forEach((bb,j) => bb.classList.toggle('on', j===i));
    draw();
  });
}
const syncT = () => { $('nTemp').value = T; $('nTempV').textContent = fmt(T,2); };
$('nRun').onclick = () => { run = !run; $('nRun').textContent = run ? 'Pause' : 'Run'; kick(); };
$('nClear').onclick = () => { clear(); draw(); };
$('nTemp').oninput = e => { T = +e.target.value; $('nTempV').textContent = fmt(T,2); };
$('nEM').oninput = e => { EM = +e.target.value; $('nEMV').textContent = '×'+fmt(EM,2); };
$('nAddP').onclick = () => { for(let i=0;i<4;i++) nucleon('p', rnd2(2,worldW()-2), rnd2(2,worldH()-2)); kick(); };
$('nAddN').onclick = () => { for(let i=0;i<4;i++) nucleon('n', rnd2(2,worldW()-2), rnd2(2,worldH()-2)); kick(); };

new IntersectionObserver(es => {
  for(const e of es){
    visible = e.isIntersecting;
    if(visible){
      if(!started){
        started = true;
        const f = fit(cv); if(f){ W=f.W; H=f.H; }
        renderBar(); SETUPS[0].f(); syncT();
        $('nSetups').querySelectorAll('button')[0]?.classList.add('on');
      }
      kick();
    }
  }
}, {threshold:0.02}).observe(cv);
addEventListener('resize', () => { if(started && visible) draw(); });
})();
