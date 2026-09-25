/* =====================================================================
   CHAPTER 7 — NEURAL NETWORK LAB
   A real 2-input, 8-neuron hidden layer, 1-output network, trained
   live with backpropagation and gradient descent on binary
   cross-entropy loss. The coloured field is its actual decision
   boundary, redrawn every frame from the network's current weights.
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
function txt(ctx,s,x,y,font,col,align){ ctx.font=font; ctx.fillStyle=col; ctx.textAlign=align||'left'; ctx.textBaseline='middle'; ctx.fillText(s,x,y); }
const rnd2 = (a,b) => a + Math.random()*(b-a);

const cv = $('nnCv');
let W=0,H=0,visible=false,started=false,run=true;
const H_UNITS = 8;
let lr = 0.6, steps = 0;
let net, pts, dsIdx = 0;

function initNet(){
  net = {
    w1: [Array.from({length:H_UNITS},()=>rnd2(-1,1)), Array.from({length:H_UNITS},()=>rnd2(-1,1))],
    b1: Array.from({length:H_UNITS},()=>0),
    w2: Array.from({length:H_UNITS},()=>rnd2(-1,1)),
    b2: 0
  };
  steps = 0;
}
function forward(x,y){
  const h = new Array(H_UNITS);
  for(let j=0;j<H_UNITS;j++) h[j] = Math.tanh(net.w1[0][j]*x + net.w1[1][j]*y + net.b1[j]);
  let z2 = net.b2;
  for(let j=0;j<H_UNITS;j++) z2 += net.w2[j]*h[j];
  return {h, out: 1/(1+Math.exp(-z2))};
}
function trainStep(n){
  for(let k=0;k<n;k++){
    const p = pts[Math.floor(Math.random()*pts.length)];
    const {h, out} = forward(p.x, p.y);
    const dz2 = out - p.t;
    const w2snap = net.w2.slice();
    const dz1 = h.map((hv,j) => dz2*w2snap[j]*(1-hv*hv));
    for(let j=0;j<H_UNITS;j++){
      net.w2[j] -= lr*dz2*h[j];
      net.w1[0][j] -= lr*dz1[j]*p.x;
      net.w1[1][j] -= lr*dz1[j]*p.y;
      net.b1[j] -= lr*dz1[j];
    }
    net.b2 -= lr*dz2;
    steps++;
  }
}
function lossAcc(){
  let L=0, correct=0;
  for(const p of pts){
    const {out} = forward(p.x,p.y);
    const o = Math.min(1-1e-7, Math.max(1e-7, out));
    L += -(p.t*Math.log(o) + (1-p.t)*Math.log(1-o));
    if((o>0.5?1:0) === p.t) correct++;
  }
  return {L: L/pts.length, acc: correct/pts.length};
}

function genBlobs(){
  const a = Array.from({length:45},() => ({x:rnd2(-0.95,-0.1)+rnd2(-.1,.1), y:rnd2(-0.95,-0.1)+rnd2(-.1,.1), t:0}));
  const b = Array.from({length:45},() => ({x:rnd2(0.1,0.95)+rnd2(-.1,.1), y:rnd2(0.1,0.95)+rnd2(-.1,.1), t:1}));
  return a.concat(b);
}
function genXOR(){
  const out=[];
  for(let i=0;i<90;i++){
    const x = rnd2(-1,1), y = rnd2(-1,1);
    out.push({x,y,t: (x>0) !== (y>0) ? 1 : 0});
  }
  return out;
}
function genCircle(){
  const out=[];
  for(let i=0;i<90;i++){
    const x = rnd2(-1,1), y = rnd2(-1,1);
    out.push({x,y,t: Math.hypot(x,y) < 0.55 ? 1 : 0});
  }
  return out;
}
const DATASETS = [
  {n:'Two blobs', gen:genBlobs},
  {n:'XOR', gen:genXOR},
  {n:'Circle', gen:genCircle}
];

function toPx(x,y){ return { px: (x+1)/2*W, py: (1-(y+1)/2)*H }; }
function toWorld(px,py){ return { x: px/W*2-1, y: (1-py/H)*2-1 }; }

function draw(){
  const f = fit(cv); if(!f) return; const {ctx} = f; W=f.W; H=f.H;
  const cols = 44, rows = Math.round(cols*H/W);
  const cw = W/cols, ch = H/rows;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const {x,y} = toWorld((c+0.5)*cw, (r+0.5)*ch);
      const {out} = forward(x,y);
      const c0 = [242,96,122], c1 = [127,166,255];
      const rr = c0[0]+(c1[0]-c0[0])*out, gg = c0[1]+(c1[1]-c0[1])*out, bb = c0[2]+(c1[2]-c0[2])*out;
      ctx.fillStyle = `rgba(${rr|0},${gg|0},${bb|0},.22)`;
      ctx.fillRect(c*cw, r*ch, cw+1, ch+1);
    }
  }
  for(const p of pts){
    const {px,py} = toPx(p.x,p.y);
    const {out} = forward(p.x,p.y);
    const miss = (out>0.5?1:0) !== p.t;
    ctx.beginPath(); ctx.arc(px,py,miss?5.5:4,0,7);
    ctx.fillStyle = p.t ? '#7FA6FF' : '#F2607A';
    ctx.fill();
    ctx.strokeStyle = miss ? '#fff' : 'rgba(5,6,10,.6)'; ctx.lineWidth = miss?1.6:1; ctx.stroke();
  }
  const {L, acc} = lossAcc();
  const narrow = W < 640;
  const lines = [
    ['Steps', steps, '#8A90A3'],
    ['Loss', L.toFixed(3), L<0.3?'#6EE39A':L<0.6?'#F6C35B':'#F2607A'],
    ['Accuracy', (acc*100).toFixed(0)+'%', acc>0.9?'#6EE39A':'#F6C35B']
  ];
  const lh = narrow?16:19, fs = narrow?'10px':'11.5px';
  const bw = Math.min(narrow?170:220, W-20), bh=(narrow?16:22)+lines.length*lh;
  rrect(ctx, W-bw-(narrow?8:12), narrow?8:12, bw, bh, 8); ctx.fillStyle='rgba(11,15,24,.82)'; ctx.fill();
  ctx.strokeStyle='rgba(38,49,74,.9)'; ctx.lineWidth=1; ctx.stroke();
  lines.forEach(([a,b,col],i) => {
    const y=(narrow?18:30)+i*lh;
    txt(ctx,a,W-bw+(narrow?4:2),y,`${fs} system-ui`,'#8d99b3');
    txt(ctx,String(b),W-(narrow?12:22),y,`700 ${fs} ui-monospace,Menlo,monospace`,col,'right');
  });
  if(!run){ txt(ctx,'paused',14,H-14,'700 12px system-ui','#8d99b3'); }
}

function loadDataset(i){ dsIdx=i; pts = DATASETS[i].gen(); initNet(); }

function renderSetups(){
  $('nnSetups').innerHTML = DATASETS.map((d,i)=>`<button type="button" data-d="${i}">${d.n}</button>`).join('');
  $('nnSetups').querySelectorAll('[data-d]').forEach((b,i)=> b.onclick = () => {
    loadDataset(i);
    $('nnSetups').querySelectorAll('button').forEach((bb,j)=>bb.classList.toggle('on', j===i));
    draw();
  });
  $('nnSetups').querySelectorAll('button')[0]?.classList.add('on');
}

let raf=null;
function loop(){
  if(!visible){ raf=null; return; }
  if(run) trainStep(5);
  draw();
  raf = requestAnimationFrame(loop);
}
function kick(){ if(!raf && visible) raf = requestAnimationFrame(loop); }

$('nnRun').onclick = () => { run = !run; $('nnRun').textContent = run ? 'Pause' : 'Run'; kick(); };
$('nnReset').onclick = () => { initNet(); draw(); };
$('nnLR').oninput = e => { lr = +e.target.value; $('nnLRV').textContent = lr.toFixed(2); };

new IntersectionObserver(es => {
  for(const e of es){
    visible = e.isIntersecting;
    if(visible){
      if(!started){
        started = true;
        const f = fit(cv); if(f){ W=f.W; H=f.H; }
        renderSetups(); loadDataset(0);
      }
      kick();
    }
  }
}, {threshold:0.02}).observe(cv);
addEventListener('resize', () => { if(started && visible) draw(); });
})();
