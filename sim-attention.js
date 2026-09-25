/* =====================================================================
   CHAPTER 9 — ATTENTION LAB
   Real scaled dot-product self-attention: softmax(QKᵀ/√d)V, computed
   live over a small fixed embedding per sentence. Clicking a word makes
   it the query and redraws the real weights it computes toward every
   key in the sentence — the same arithmetic "Attention Is All You Need"
   (2017) introduced, not an animation standing in for it.
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
function txt(ctx,s,x,y,font,col,align){ ctx.font=font; ctx.fillStyle=col; ctx.textAlign=align||'left'; ctx.textBaseline='middle'; ctx.fillText(s,x,y); }
function rrect(ctx,x,y,w,h,r){ ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,w,h,r); else ctx.rect(x,y,w,h); }

const cv = $('attnCv');
if(cv){
const D = 6; // toy embedding dimension
let seed = 811;
const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
const rndV = (n) => Array.from({length:n}, () => rnd()*2-1);
const rndM = (r,c) => Array.from({length:r}, () => rndV(c));
function matVec(M, v){ return M.map(row => row.reduce((s,w,i) => s + w*v[i], 0)); }
function dot(a,b){ let s=0; for(let i=0;i<a.length;i++) s += a[i]*b[i]; return s; }
function softmax(arr){
  const m = Math.max(...arr); const ex = arr.map(x => Math.exp(x-m));
  const s = ex.reduce((a,b)=>a+b,0); return ex.map(x => x/s);
}

// one shared, fixed "head" — the same three projection matrices
// (query, key, value) applied to every sentence below.
const Wq = rndM(D,D), Wk = rndM(D,D), Wv = rndM(D,D);

const SENTENCES = [
  "the cat sat on the mat".split(' '),
  "she poured the water until it overflowed".split(' '),
  "attention lets every word see every other word".split(' ')
];

let sIdx = 0, focus = 0;
let words, embs, Q, K, V, weights; // weights[i][j] = attention from word i to word j

function buildSentence(){
  words = SENTENCES[sIdx];
  embs = words.map(() => rndV(D));
  Q = embs.map(e => matVec(Wq, e));
  K = embs.map(e => matVec(Wk, e));
  V = embs.map(e => matVec(Wv, e));
  weights = Q.map((qi) => softmax(K.map(kj => dot(qi,kj) / Math.sqrt(D))));
  focus = 0;
}

let W=0,H=0,visible=false,started=false;
let wordBoxes = [];

function layout(){
  wordBoxes = [];
  const pad = 16, gap = 10;
  const font = W < 640 ? '600 15px system-ui' : '600 17px system-ui';
  const measureCv = document.createElement('canvas'), mctx = measureCv.getContext('2d');
  mctx.font = font;
  let x = pad, y = 44, rowH = 40, maxW = W - pad*2;
  const rows = [[]];
  for(let i=0;i<words.length;i++){
    const w = mctx.measureText(words[i]).width + 26;
    if(x + w > maxW + pad && rows[rows.length-1].length){ rows.push([]); x = pad; y += rowH; }
    rows[rows.length-1].push({i, x, w});
    x += w + gap;
  }
  for(const row of rows){
    for(const b of row) wordBoxes.push({i:b.i, x:b.x, y, w:b.w, h:28});
  }
  return {font, bottom: y + 28};
}

function draw(){
  const f = fit(cv); if(!f) return; const {ctx} = f; W=f.W; H=f.H;
  ctx.clearRect(0,0,W,H);
  const {font, bottom} = layout();
  const labelY = bottom + 20, diagTop = bottom + 42, diagBottom = H - 20;

  // lines from the focused word down to every word, weighted by attention
  const src = wordBoxes.find(b => b.i === focus);
  if(src){
    const sx = src.x + src.w/2, sy = src.y + src.h;
    for(const b of wordBoxes){
      const wgt = weights[focus][b.i];
      const tx = b.x + b.w/2, ty = diagBottom;
      const midY = diagTop + (diagBottom-diagTop) * (b.i===focus ? 0.5 : 0.35);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx+tx)/2, midY, tx, ty);
      const glow = 0.12 + wgt*0.88;
      ctx.strokeStyle = `rgba(246,195,91,${glow.toFixed(3)})`;
      ctx.lineWidth = 0.6 + wgt*7;
      ctx.stroke();
      // weight readout under each target
      txt(ctx, Math.round(wgt*100)+'%', tx, ty+16, '11px ui-monospace,Menlo,monospace',
        wgt>0.4 ? '#F6C35B' : 'rgba(141,153,179,.75)', 'center');
    }
  }

  // words
  for(const b of wordBoxes){
    const on = b.i === focus;
    rrect(ctx, b.x, b.y, b.w, b.h, 6);
    ctx.fillStyle = on ? 'rgba(246,195,91,.18)' : 'rgba(18,24,38,.92)'; ctx.fill();
    ctx.strokeStyle = on ? '#F6C35B' : '#273046'; ctx.lineWidth = on ? 2 : 1.4; ctx.stroke();
    txt(ctx, words[b.i], b.x+b.w/2, b.y+b.h/2, font, on ? '#fff' : '#ECE6D8', 'center');
  }

  txt(ctx, focus!==null ? `attention from "${words[focus]}" → every word (softmax over QKᵀ/√${D})` : '',
    16, labelY, '11px ui-monospace,Menlo,monospace', 'rgba(141,153,179,.75)', 'left');
}

function renderSetups(){
  $('attnSetups').innerHTML = SENTENCES.map((s,i) => `<button type="button" data-s="${i}">${s.length} words · "${s.slice(0,3).join(' ')}…"</button>`).join('');
  $('attnSetups').querySelectorAll('[data-s]').forEach((b,i) => b.onclick = () => {
    sIdx = i; buildSentence(); renderSetups(); renderWords(); draw();
  });
  $('attnSetups').querySelectorAll('button').forEach((b,i) => b.classList.toggle('on', i===sIdx));
}
function renderWords(){
  $('attnWords').innerHTML = words.map((w,i) => `<button type="button" data-w="${i}">${w}</button>`).join('');
  $('attnWords').querySelectorAll('[data-w]').forEach((b,i) => b.onclick = () => {
    focus = i; renderWords(); draw();
  });
  $('attnWords').querySelectorAll('button').forEach((b,i) => b.classList.toggle('on', i===focus));
}

function kickStart(){
  if(started) return; started = true;
  buildSentence();
  renderSetups(); renderWords(); draw();
}

cv.addEventListener('click', (e) => {
  const r = cv.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  const hit = wordBoxes.find(b => px>=b.x && px<=b.x+b.w && py>=b.y && py<=b.y+b.h);
  if(hit){ focus = hit.i; renderWords(); draw(); }
});

new IntersectionObserver(es => {
  for(const e of es){
    visible = e.isIntersecting;
    if(visible){ kickStart(); draw(); }
  }
}, {threshold:0.02}).observe(cv);
addEventListener('resize', () => { if(started && visible) draw(); });
}
})();
