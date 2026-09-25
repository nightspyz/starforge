/* =====================================================================
   CHAPTER 12 — feed lab: human data sources feeding a neural net,
   the net driving a robot arm, a rover, and a ship. Interactive:
   toggle sources with the lab-bar buttons; capability follows what's fed.
   ===================================================================== */
(() => {
"use strict";
const cv = document.getElementById('feedCv'); if(!cv) return;
const ctx = cv.getContext('2d');
let W=0,H=0,DPR=1,visible=false;
function resize(){
  DPR = Math.min(2, devicePixelRatio||1); const r = cv.getBoundingClientRect();
  W = r.width; H = r.height; cv.width = W*DPR; cv.height = H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize', resize); resize();
function rrect(x,y,w,h,r){ ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,w,h,r); else ctx.rect(x,y,w,h); }
function txt(s,x,y,font,col,align){ ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align||'left'; ctx.textBaseline = 'middle'; ctx.fillText(s,x,y); }

const SOURCES = [
  {id:'video', label:'Video', col:'#F2607A'},
  {id:'text',  label:'Text',  col:'#7FA6FF'},
  {id:'games', label:'Games', col:'#6EE39A'},
  {id:'music', label:'Music', col:'#F6C35B'},
];
let active = {video:true, text:true, games:true, music:false};
let cap = 0.75; // smoothed capability 0..1, eases toward target
let seed = 133; const rnd = () => (seed = (seed*16807)%2147483647)/2147483647;
const particles = SOURCES.map(() => Array.from({length:5}, () => ({p: rnd()})));

function loop(ms){
  if(visible){
    if(!W) resize();
    const t = ms/1000;
    const activeCount = Object.values(active).filter(Boolean).length;
    const target = 0.18 + activeCount*0.2;
    cap += (target-cap)*0.04;

    ctx.fillStyle = '#0c1018'; ctx.fillRect(0,0,W,H);

    const srcX = W*0.12, hubX = W*0.5, hubY = H*0.46, outX = W*0.86;
    const srcYs = SOURCES.map((_,i) => H*(0.18 + i*0.66/(SOURCES.length-1)));

    // streams: source -> hub
    SOURCES.forEach((s,i) => {
      const on = active[s.id];
      const sy = srcYs[i];
      ctx.strokeStyle = on ? s.col : 'rgba(120,130,150,.15)';
      ctx.globalAlpha = on ? 0.5 : 0.12;
      ctx.lineWidth = on ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(srcX+46, sy); ctx.quadraticCurveTo((srcX+hubX)/2, sy, hubX-30, hubY); ctx.stroke();
      ctx.globalAlpha = 1;
      if(on){
        particles[i].forEach(p => {
          p.p = (p.p + 0.006 + activeCount*0.002) % 1;
          const px = srcX+46 + (hubX-30-(srcX+46))*p.p;
          const py = sy + (hubY-sy)*p.p*p.p*(3-2*p.p);
          ctx.beginPath(); ctx.arc(px,py,2.2,0,7); ctx.fillStyle = s.col; ctx.fill();
        });
      }
      // source node
      ctx.beginPath(); ctx.arc(srcX, sy, 15, 0, 7);
      ctx.fillStyle = on ? 'rgba(15,20,30,.9)' : 'rgba(15,20,30,.6)';
      ctx.fill(); ctx.strokeStyle = on ? s.col : 'rgba(120,130,150,.35)'; ctx.lineWidth = 1.4; ctx.stroke();
      txt(s.label[0], srcX, sy, '11px monospace', on ? s.col : 'rgba(150,160,180,.5)', 'center');
      txt(s.label, srcX, sy+26, '10px monospace', on ? 'rgba(230,235,245,.7)' : 'rgba(150,160,180,.4)', 'center');
    });

    // hub: pulsing layered nodes, like the NN chapter, scaled by capability
    const hubR = 30 + cap*22;
    const pulse = 1 + Math.sin(t*3)*0.04*cap;
    const grad = ctx.createRadialGradient(hubX,hubY,2,hubX,hubY,hubR*pulse);
    grad.addColorStop(0, `rgba(246,195,91,${0.25+0.4*cap})`);
    grad.addColorStop(1, 'rgba(246,195,91,0)');
    ctx.beginPath(); ctx.arc(hubX,hubY,hubR*pulse,0,7); ctx.fillStyle = grad; ctx.fill();
    const nlayers=3, nper=5;
    for(let l=0;l<nlayers;l++){
      for(let i=0;i<nper;i++){
        const ang = (i/nper)*6.28 + l*0.6 + t*0.15;
        const rr = hubR*0.45 + l*8;
        const nx = hubX + Math.cos(ang)*rr, ny = hubY + Math.sin(ang)*rr*0.6;
        ctx.beginPath(); ctx.arc(nx,ny,2.4,0,7); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
      }
    }
    txt('capability', hubX, hubY+hubR*pulse+18, '10px monospace', 'rgba(230,235,245,.4)', 'center');
    txt(Math.round(cap*100)+'%', hubX, hubY+hubR*pulse+32, '12px monospace', '#F6C35B', 'center');

    // hub -> outputs
    const OUT = [
      {label:'Arm', y: H*0.2},
      {label:'Rover', y: H*0.46},
      {label:'Ship', y: H*0.74},
    ];
    OUT.forEach((o,i) => {
      ctx.strokeStyle = `rgba(127,166,255,${0.15+0.35*cap})`; ctx.lineWidth = 1+cap*1.5;
      ctx.beginPath(); ctx.moveTo(hubX+hubR*0.6,hubY); ctx.quadraticCurveTo((hubX+outX)/2, o.y, outX-30, o.y); ctx.stroke();
    });

    // output icons, animated by capability
    ctx.save(); ctx.translate(outX, OUT[0].y);
    const armA = Math.sin(t*2)*0.35*cap;
    ctx.strokeStyle = '#C9DAFF'; ctx.lineWidth=3; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,14); ctx.lineTo(0,-4);
    ctx.lineTo(Math.sin(armA)*18, -4-Math.cos(armA)*18); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,14,3,0,7); ctx.fillStyle='#C9DAFF'; ctx.fill();
    ctx.restore();

    ctx.save(); ctx.translate(outX, OUT[1].y);
    const rx = Math.sin(t*1.3)*10*cap;
    ctx.translate(rx,0);
    ctx.fillStyle = '#6EE39A'; rrect(-16,-8,32,16,4); ctx.fill();
    ctx.beginPath(); ctx.arc(-10,10,4,0,7); ctx.arc(10,10,4,0,7); ctx.fillStyle='#0c1018'; ctx.fill();
    ctx.restore();

    ctx.save(); ctx.translate(outX, OUT[2].y);
    const bob = Math.sin(t*1.8)*4*cap;
    ctx.translate(0,bob); ctx.rotate(-0.2);
    ctx.fillStyle = '#C9DAFF';
    ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-8,-6); ctx.lineTo(-4,0); ctx.lineTo(-8,6); ctx.closePath(); ctx.fill();
    if(cap>0.3){
      ctx.globalAlpha = cap;
      const g = ctx.createLinearGradient(-8,0,-8-16*cap,0);
      g.addColorStop(0,'rgba(127,166,255,.9)'); g.addColorStop(1,'rgba(127,166,255,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(-4,-3); ctx.lineTo(-8-16*cap,0); ctx.lineTo(-4,3); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1;
    }
    ctx.restore();

    OUT.forEach(o => txt(o.label, outX, o.y+22, '10px monospace', 'rgba(230,235,245,.55)', 'center'));
  }
  requestAnimationFrame(loop);
}
new IntersectionObserver(es => { for(const e of es) visible = e.isIntersecting; }, {threshold:0.05}).observe(cv);
requestAnimationFrame(loop);

const bar = document.getElementById('feedSources');
if(bar){
  bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    const id = b.dataset.src;
    active[id] = !active[id];
    b.classList.toggle('on', active[id]);
  });
}
})();
