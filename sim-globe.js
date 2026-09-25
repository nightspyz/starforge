/* =====================================================================
   CHAPTER 7.5 — globe lab: a real orthographic-projection globe.
   Graticule and city coordinates are accurate; routes and pulses are
   illustrative, standing in for traffic rather than measuring it.
   ===================================================================== */
(() => {
"use strict";
const cv = document.getElementById('globeCv'); if(!cv) return;
const ctx = cv.getContext('2d');
const dragBtn = document.getElementById('gpDrag'), layerBtn = document.getElementById('gpLayer');
let W=0,H=0,DPR=1,visible=false;
function resize(){
  DPR = Math.min(2, devicePixelRatio||1); const r = cv.getBoundingClientRect();
  W = r.width; H = r.height; cv.width = W*DPR; cv.height = H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize', resize); resize();
function txt(s,x,y,font,col,align){ ctx.font=font; ctx.fillStyle=col; ctx.textAlign=align||'left'; ctx.textBaseline='middle'; ctx.fillText(s,x,y); }

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let autoRotate = !reduce;
let layer = 'routes';
dragBtn.textContent = 'Auto-rotate: ' + (autoRotate ? 'on' : 'off');
dragBtn.classList.toggle('on', autoRotate);

function toXYZ(lat, lon){
  const la = lat*Math.PI/180, lo = lon*Math.PI/180;
  return [Math.cos(la)*Math.sin(lo), -Math.sin(la), Math.cos(la)*Math.cos(lo)];
}
function rotY(p, a){ const [x,y,z]=p, ca=Math.cos(a), sa=Math.sin(a); return [x*ca+z*sa, y, -x*sa+z*ca]; }
function rotX(p, a){ const [x,y,z]=p, ca=Math.cos(a), sa=Math.sin(a); return [x, y*ca-z*sa, y*sa+z*ca]; }
function slerp(a,b,tt){
  let dot = a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; dot = Math.max(-1,Math.min(1,dot));
  const om = Math.acos(dot); if(om < 1e-6) return a;
  const s = Math.sin(om), w1 = Math.sin((1-tt)*om)/s, w2 = Math.sin(tt*om)/s;
  return [a[0]*w1+b[0]*w2, a[1]*w1+b[1]*w2, a[2]*w1+b[2]*w2];
}

const CITIES = [
  ['New York',40.7,-74.0], ['London',51.5,-0.12], ['Tokyo',35.7,139.7],
  ['São Paulo',-23.5,-46.6], ['Lagos',6.5,3.4], ['Mumbai',19.1,72.9],
  ['Sydney',-33.9,151.2], ['Beijing',39.9,116.4], ['Moscow',55.8,37.6],
  ['Cairo',30.0,31.2], ['Los Angeles',34.0,-118.2], ['Singapore',1.35,103.8],
  ['Nairobi',-1.3,36.8], ['Buenos Aires',-34.6,-58.4]
].map(([name,lat,lon]) => ({name, lat, lon, v: toXYZ(lat,lon)}));

const byName = n => CITIES.find(c => c.name === n);
const ROUTES = [
  ['New York','London'], ['London','Lagos'], ['New York','Los Angeles'],
  ['Los Angeles','Tokyo'], ['Tokyo','Singapore'], ['Singapore','Mumbai'],
  ['Mumbai','Cairo'], ['Cairo','Moscow'], ['Moscow','Beijing'],
  ['São Paulo','New York'], ['Sydney','Singapore'], ['Nairobi','Cairo']
].map(([a,b],i) => ({a:byName(a), b:byName(b), phase: i/12}));

let angle = 0.4;
const TILT = -0.30;
let dragging = false, lastX = 0;

function project(v, cx, cy, R){
  let p = rotY(v, angle);
  p = rotX(p, TILT);
  return {x: cx + p[0]*R, y: cy + p[1]*R, z: p[2]};
}

function draw(t){
  ctx.fillStyle = '#070a12'; ctx.fillRect(0,0,W,H);
  const cx = W*0.5, cy = H*0.52, R = Math.min(W,H)*0.40;

  // faint starfield
  ctx.fillStyle = 'rgba(210,220,240,.25)';
  for(let i=0;i<26;i++){ const gx=(i*97%100)/100*W, gy=(i*53%100)/100*H*0.7; ctx.fillRect(gx,gy,1,1); }

  // sphere base
  const g = ctx.createRadialGradient(cx-R*0.3,cy-R*0.3,R*0.1,cx,cy,R);
  g.addColorStop(0,'rgba(30,46,74,.9)'); g.addColorStop(1,'rgba(9,13,22,.95)');
  ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,200,.35)'; ctx.lineWidth = 1; ctx.stroke();

  // graticule: meridians every 30deg, parallels every 30deg
  ctx.lineWidth = 0.7;
  for(let lon=-180; lon<180; lon+=30){
    ctx.beginPath(); let started=false;
    for(let lat=-90; lat<=90; lat+=5){
      const p = project(toXYZ(lat,lon), cx,cy,R);
      if(p.z < -0.02){ started=false; continue; }
      ctx.strokeStyle = `rgba(120,160,220,${0.16+0.14*Math.max(0,p.z)})`;
      if(!started){ ctx.moveTo(p.x,p.y); started=true; } else ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();
  }
  for(let lat=-60; lat<=60; lat+=30){
    ctx.beginPath(); let started=false;
    for(let lon=-180; lon<=180; lon+=5){
      const p = project(toXYZ(lat,lon), cx,cy,R);
      if(p.z < -0.02){ started=false; continue; }
      ctx.strokeStyle = `rgba(120,160,220,${0.16+0.14*Math.max(0,p.z)})`;
      if(!started){ ctx.moveTo(p.x,p.y); started=true; } else ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();
  }

  // routes + pulses
  if(layer === 'routes'){
    ROUTES.forEach(rt => {
      ctx.beginPath(); let started=false;
      for(let i=0;i<=24;i++){
        const p3 = slerp(rt.a.v, rt.b.v, i/24);
        const p = project(p3, cx,cy,R);
        if(p.z < -0.03){ started=false; continue; }
        ctx.strokeStyle = `rgba(110,227,154,${0.25+0.3*Math.max(0,p.z)})`;
        if(!started){ ctx.moveTo(p.x,p.y); started=true; } else ctx.lineTo(p.x,p.y);
      }
      ctx.lineWidth = 1;
      ctx.stroke();
      const tp = reduce ? rt.phase : ((t*0.08 + rt.phase) % 1);
      const pulseP = project(slerp(rt.a.v, rt.b.v, tp), cx,cy,R);
      if(pulseP.z > -0.02){
        ctx.beginPath(); ctx.arc(pulseP.x,pulseP.y,2.4,0,Math.PI*2);
        ctx.fillStyle = '#F6C35B'; ctx.fill();
      }
    });
  }

  // cities
  CITIES.forEach(c => {
    const p = project(c.v, cx,cy,R);
    const front = p.z > -0.05;
    ctx.beginPath(); ctx.arc(p.x,p.y, front ? 2.6 : 1.4, 0, Math.PI*2);
    ctx.fillStyle = front ? `rgba(255,214,120,${0.5+0.5*Math.max(0,p.z)})` : 'rgba(255,214,120,.15)';
    ctx.fill();
  });

  txt(layer === 'routes' ? 'internet backbone routes (illustrative traffic)' : 'population centers',
    14, H-14, '11px monospace', 'rgba(230,235,245,.5)', 'left');

  if(autoRotate && !dragging) angle += reduce ? 0 : 0.0022;
}

let raf = null;
function loop(ms){
  if(!visible){ raf = null; return; }
  draw(ms/1000);
  if(!reduce || dragging || autoRotate) raf = requestAnimationFrame(loop);
  else raf = requestAnimationFrame(loop); // keep listening for drag input even when reduced
}
function kick(){ if(!raf && visible) raf = requestAnimationFrame(loop); }

cv.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if(!dragging) return; angle += (e.clientX-lastX)*0.008; lastX = e.clientX; draw(performance.now()/1000); });
cv.addEventListener('pointerup', () => dragging = false);
cv.addEventListener('pointercancel', () => dragging = false);
cv.addEventListener('pointerleave', () => dragging = false);

dragBtn.addEventListener('click', () => {
  autoRotate = !autoRotate;
  dragBtn.textContent = 'Auto-rotate: ' + (autoRotate ? 'on' : 'off');
  dragBtn.classList.toggle('on', autoRotate);
  kick();
});
layerBtn.addEventListener('click', () => {
  layer = layer === 'routes' ? 'cities' : 'routes';
  layerBtn.dataset.layer = layer;
  layerBtn.textContent = 'Layer: ' + layer;
  draw(performance.now()/1000);
});

new IntersectionObserver(es => { for(const e of es){ visible = e.isIntersecting; if(visible){ if(!W) resize(); kick(); } } }, {threshold:0.05}).observe(cv);
draw(0);
})();
