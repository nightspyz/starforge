/* =====================================================================
   CHAPTER 6 — LOGIC LAB
   A small circuit simulator: switches, real gates (AND/OR/NOT/XOR),
   lamps, and a binary-number readout. Every value shown is computed
   live from the current switch state, not scripted.
   ===================================================================== */
(() => {
"use strict";
const $ = id => document.getElementById(id);
function fit(cv){
  const ctx = cv.getContext('2d'), dpr = window.devicePixelRatio||1, r = cv.getBoundingClientRect();
  if(!r.width) return null;
  cv.width = Math.round(r.width*dpr); cv.height = Math.round(r.height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx, W:r.width, H:r.height};
}
function rrect(ctx,x,y,w,h,r){ ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,w,h,r); else ctx.rect(x,y,w,h); }

const cv = $('logicCv');
let W=0, H=0, visible=false, started=false;
let switches = {};
let presetIdx = 0;

function evalGate(kind, ins){
  if(kind==='AND')  return ins.every(v=>v===1) ? 1 : 0;
  if(kind==='OR')   return ins.some(v=>v===1) ? 1 : 0;
  if(kind==='NOT')  return ins[0] ? 0 : 1;
  if(kind==='XOR')  return (ins[0] !== ins[1]) ? 1 : 0;
  return 0;
}
function valueOf(nodes, id, cache){
  if(id in cache) return cache[id];
  const n = nodes.find(x => x.id === id);
  let v;
  if(n.type === 'switch') v = switches[n.id] || 0;
  else if(n.type === 'gate') v = evalGate(n.gate, n.inputs.map(i => valueOf(nodes, i, cache)));
  else if(n.type === 'lamp') v = valueOf(nodes, n.inputs[0], cache);
  else if(n.type === 'decimal') v = n.inputs.reduce((s,i,idx) => s + valueOf(nodes,i,cache)*n.weights[idx], 0);
  cache[id] = v; return v;
}

const PRESETS = [
  {n:'Binary numbers', sw:['A','B','C','D'], nodes:[
    {id:'A',type:'switch',x:0.15,y:0.16,label:'8'},
    {id:'B',type:'switch',x:0.15,y:0.38,label:'4'},
    {id:'C',type:'switch',x:0.15,y:0.60,label:'2'},
    {id:'D',type:'switch',x:0.15,y:0.82,label:'1'},
    {id:'OUT',type:'decimal',x:0.78,y:0.49,inputs:['A','B','C','D'],weights:[8,4,2,1]}
  ], wires:[['A','OUT'],['B','OUT'],['C','OUT'],['D','OUT']]},
  {n:'NOT gate', sw:['A'], nodes:[
    {id:'A',type:'switch',x:0.18,y:0.5,label:'A'},
    {id:'G',type:'gate',gate:'NOT',x:0.5,y:0.5,inputs:['A']},
    {id:'OUT',type:'lamp',x:0.8,y:0.5,inputs:['G'],label:'OUT'}
  ], wires:[['A','G'],['G','OUT']]},
  {n:'AND gate', sw:['A','B'], nodes:[
    {id:'A',type:'switch',x:0.18,y:0.32,label:'A'},
    {id:'B',type:'switch',x:0.18,y:0.68,label:'B'},
    {id:'G',type:'gate',gate:'AND',x:0.5,y:0.5,inputs:['A','B']},
    {id:'OUT',type:'lamp',x:0.8,y:0.5,inputs:['G'],label:'OUT'}
  ], wires:[['A','G'],['B','G'],['G','OUT']]},
  {n:'OR gate', sw:['A','B'], nodes:[
    {id:'A',type:'switch',x:0.18,y:0.32,label:'A'},
    {id:'B',type:'switch',x:0.18,y:0.68,label:'B'},
    {id:'G',type:'gate',gate:'OR',x:0.5,y:0.5,inputs:['A','B']},
    {id:'OUT',type:'lamp',x:0.8,y:0.5,inputs:['G'],label:'OUT'}
  ], wires:[['A','G'],['B','G'],['G','OUT']]},
  {n:'XOR gate', sw:['A','B'], nodes:[
    {id:'A',type:'switch',x:0.18,y:0.32,label:'A'},
    {id:'B',type:'switch',x:0.18,y:0.68,label:'B'},
    {id:'G',type:'gate',gate:'XOR',x:0.5,y:0.5,inputs:['A','B']},
    {id:'OUT',type:'lamp',x:0.8,y:0.5,inputs:['G'],label:'OUT'}
  ], wires:[['A','G'],['B','G'],['G','OUT']]},
  {n:'Half adder', sw:['A','B'], nodes:[
    {id:'A',type:'switch',x:0.14,y:0.32,label:'A'},
    {id:'B',type:'switch',x:0.14,y:0.68,label:'B'},
    {id:'XOR',type:'gate',gate:'XOR',x:0.48,y:0.24,inputs:['A','B']},
    {id:'AND',type:'gate',gate:'AND',x:0.48,y:0.76,inputs:['A','B']},
    {id:'SUM',type:'lamp',x:0.82,y:0.24,inputs:['XOR'],label:'SUM'},
    {id:'CARRY',type:'lamp',x:0.82,y:0.76,inputs:['AND'],label:'CARRY'}
  ], wires:[['A','XOR'],['B','XOR'],['A','AND'],['B','AND'],['XOR','SUM'],['AND','CARRY']]}
];

function nodePos(n){ return {x:n.x*W, y:n.y*H}; }
function drawWire(ctx, a, b, lit, t, phase){
  const pa = nodePos(a), pb = nodePos(b);
  ctx.strokeStyle = lit ? 'rgba(246,195,91,.85)' : 'rgba(58,63,82,.7)';
  ctx.lineWidth = lit ? 2.4 : 1.6;
  ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke();
  if(lit){
    const u = (t*0.35 + phase) % 1;
    const dx = pa.x + (pb.x-pa.x)*u, dy = pa.y + (pb.y-pa.y)*u;
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(dx,dy,2.6,0,7); ctx.fill();
  }
}
function drawSwitch(ctx, n, v){
  const {x,y} = nodePos(n), w=54,h=54;
  rrect(ctx,x-w/2,y-h/2,w,h,8);
  ctx.fillStyle = v ? 'rgba(246,195,91,.16)' : 'rgba(18,24,38,.92)'; ctx.fill();
  ctx.strokeStyle = v ? '#F6C35B' : '#273046'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle = '#8A90A3'; ctx.font='10px system-ui'; ctx.fillText(n.label||n.id, x, y-15);
  ctx.fillStyle = v ? '#F6C35B' : '#ECE6D8'; ctx.font='700 20px ui-monospace,Menlo,monospace'; ctx.fillText(String(v), x, y+7);
}
function drawGate(ctx, n, v){
  const {x,y} = nodePos(n), w=78,h=48;
  rrect(ctx,x-w/2,y-h/2,w,h,8);
  ctx.fillStyle = v ? 'rgba(127,166,255,.14)' : 'rgba(18,24,38,.92)'; ctx.fill();
  ctx.strokeStyle = v ? '#7FA6FF' : '#273046'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle = v ? '#cfe0ff' : '#ECE6D8'; ctx.font='700 14px system-ui'; ctx.fillText(n.gate, x, y-6);
  ctx.fillStyle = v ? '#7FA6FF' : '#8A90A3'; ctx.font='11px ui-monospace,Menlo,monospace'; ctx.fillText('= '+v, x, y+12);
}
function drawLamp(ctx, n, v){
  const {x,y} = nodePos(n), r=22;
  if(v){ const g = ctx.createRadialGradient(x,y,0,x,y,r*2.2); g.addColorStop(0,'rgba(246,195,91,.9)'); g.addColorStop(1,'rgba(246,195,91,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r*2.2,0,7); ctx.fill(); }
  ctx.beginPath(); ctx.arc(x,y,r,0,7);
  ctx.fillStyle = v ? '#F6C35B' : 'rgba(18,24,38,.92)'; ctx.fill();
  ctx.strokeStyle = v ? '#F6C35B' : '#273046'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle = '#8A90A3'; ctx.font='10px system-ui'; ctx.fillText(n.label||'OUT', x, y+r+14);
  ctx.fillStyle = v ? '#241a06' : '#8A90A3'; ctx.font='700 15px ui-monospace,Menlo,monospace'; ctx.fillText(String(v), x, y+1);
}
function drawDecimal(ctx, n, v){
  const {x,y} = nodePos(n), w=110,h=70;
  rrect(ctx,x-w/2,y-h/2,w,h,9);
  ctx.fillStyle = 'rgba(110,227,154,.10)'; ctx.fill();
  ctx.strokeStyle = '#6EE39A'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle = '#8A90A3'; ctx.font='10px system-ui'; ctx.fillText('decimal value', x, y-20);
  ctx.fillStyle = '#6EE39A'; ctx.font='700 30px ui-monospace,Menlo,monospace'; ctx.fillText(String(v), x, y+8);
}

function draw(t){
  const f = fit(cv); if(!f) return; const {ctx} = f; W = f.W; H = f.H;
  ctx.clearRect(0,0,W,H);
  const P = PRESETS[presetIdx], cache = {};
  for(const n of P.nodes) valueOf(P.nodes, n.id, cache);
  let wi = 0;
  for(const [a,b] of P.wires){
    const na = P.nodes.find(n=>n.id===a), nb = P.nodes.find(n=>n.id===b);
    drawWire(ctx, na, nb, !!cache[a], t, wi*0.31); wi++;
  }
  for(const n of P.nodes){
    const v = cache[n.id];
    if(n.type==='switch') drawSwitch(ctx,n,v);
    else if(n.type==='gate') drawGate(ctx,n,v);
    else if(n.type==='lamp') drawLamp(ctx,n,v);
    else if(n.type==='decimal') drawDecimal(ctx,n,v);
  }
  if(P.n === 'Half adder'){
    const total = (cache.CARRY||0)*2 + (cache.SUM||0);
    ctx.textAlign='left'; ctx.fillStyle='rgba(230,235,245,.6)'; ctx.font='600 12.5px system-ui';
    ctx.fillText(`${cache.A||0} + ${cache.B||0} = binary ${cache.CARRY||0}${cache.SUM||0}  (decimal ${total})`, 14, H-14);
  }
}

function renderSetups(){
  $('lSetups').innerHTML = PRESETS.map((p,i) => `<button type="button" data-p="${i}">${p.n}</button>`).join('');
  $('lSetups').querySelectorAll('[data-p]').forEach((b,i) => b.onclick = () => {
    presetIdx = i; switches = {}; renderSwitches(); syncPresetButtons(); draw(clock());
  });
  syncPresetButtons();
}
function syncPresetButtons(){
  $('lSetups').querySelectorAll('button').forEach((b,i) => b.classList.toggle('on', i===presetIdx));
}
function renderSwitches(){
  const P = PRESETS[presetIdx];
  $('lSwitches').innerHTML = P.sw.map(id => `<button type="button" data-sw="${id}">${id}: ${switches[id]||0}</button>`).join('');
  $('lSwitches').querySelectorAll('[data-sw]').forEach(b => b.onclick = () => {
    const id = b.dataset.sw; switches[id] = switches[id] ? 0 : 1;
    renderSwitches(); draw(clock());
  });
}

let t0 = null;
const clock = () => t0===null ? 0 : (performance.now()-t0)/1000;
function loop(ms){
  if(visible){
    if(t0===null) t0 = ms;
    if(!started){ started = true; renderSetups(); renderSwitches(); }
    draw((ms-t0)/1000);
  }
  requestAnimationFrame(loop);
}
new IntersectionObserver(es => { for(const e of es) visible = e.isIntersecting; }, {threshold:0.05}).observe(cv);
requestAnimationFrame(loop);
})();
