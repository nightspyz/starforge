/* =====================================================================
   LIVE LAB — ORBITAL INSERTION
   Real 2D orbital mechanics under inverse-square gravity: the ship
   starts already in a stable elliptical orbit, free to reshape with
   prograde/retrograde burns, and the orbit drawn on screen is derived
   every frame from its actual
   position and velocity — specific energy, angular momentum, the
   eccentricity vector — the same equations behind any real orbit
   (and behind KSP). Controls, navball and prograde/retrograde markers
   are modeled on Kerbal Space Program's conventions.
   ===================================================================== */
(() => {
"use strict";
const cv = document.getElementById('flightCv'); if(!cv) return;
const ctx = cv.getContext('2d');
const runBtn = document.getElementById('flRun'), resetBtn = document.getElementById('flReset');
const thrustBtn = document.getElementById('flThrust');
const proBtn = document.getElementById('flProGrade'), retroBtn = document.getElementById('flRetroGrade');
const knobCv = document.getElementById('flKnob');
const statusEl = document.getElementById('flStatus');
let W=0,H=0,DPR=1,visible=false;
function resize(){
  DPR = Math.min(2, devicePixelRatio||1); const r = cv.getBoundingClientRect();
  W = r.width; H = r.height; cv.width = W*DPR; cv.height = H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
  PXU = Math.min(W,H) * 0.125;
}
addEventListener('resize', resize);

const OK = '#6EE39A', WARN = '#F6C35B', COLD = '#7FA6FF', BAD = '#F2607A';
const MU = 1.09;                 // gravitational parameter, unit space
const SURFACE_U = 1.0;           // planet radius, unit space
const APO0_U = 2.4, PERI0_U = 1.5;   // starting orbit: already stable, clear of the surface
const ACCEL_U = 0.16;            // burn acceleration, units/s^2
const ROT_ACCEL = 2.4;           // rad/s^2 at full knob deflection
const STABLE_PERI_U = 1.15, STABLE_ECC = 0.35, STABLE_HOLD = 1.2;
let PXU = 60;

let run = true, t = 0;
let ship, crashed = false, stable = false, stableTimer = 0;
let autoAlign = null; // target angle while PRO/RETRO auto-rotates, or null
let elems = {r:0, v:0, apo:0, peri:0, ecc:0, escape:false, argPeri:0, a:0};
let seed = 5; const rnd = () => (seed = (seed*16807)%2147483647)/2147483647;
const STARS = Array.from({length:70}, () => ({x:rnd(), y:rnd(), s:0.4+rnd()*1.1}));

function reset(){
  const a = (APO0_U+PERI0_U)/2;
  const vApo = Math.sqrt(MU*(2/APO0_U - 1/a));
  ship = {rx: APO0_U, ry: 0, vx: 0, vy: vApo, angle: Math.PI/2, vangle: 0};
  crashed = false; stable = false; stableTimer = 0; autoAlign = null;
  run = true; runBtn.textContent = 'Pause';
  statusEl.classList.remove('ok');
}
reset();

function normAngle(a){ while(a > Math.PI) a -= Math.PI*2; while(a < -Math.PI) a += Math.PI*2; return a; }
function txt(s,x,y,font,col,align){ ctx.font=font; ctx.fillStyle=col; ctx.textAlign=align||'left'; ctx.textBaseline='middle'; ctx.fillText(s,x,y); }

function gravAccel(rx,ry){
  const r = Math.hypot(rx,ry) || 1e-6;
  const f = -MU / (r*r*r);
  return {ax: f*rx, ay: f*ry};
}

function orbitalElements(rx,ry,vx,vy){
  const r = Math.hypot(rx,ry), v2 = vx*vx+vy*vy;
  const energy = v2/2 - MU/r;
  const rdotv = rx*vx + ry*vy;
  const ex = (v2/MU - 1/r)*rx - (rdotv/MU)*vx;
  const ey = (v2/MU - 1/r)*ry - (rdotv/MU)*vy;
  const ecc = Math.hypot(ex,ey);
  const escape = energy >= -1e-5 || ecc >= 0.995;
  let a = -MU/(2*energy);
  const argPeri = Math.atan2(ey,ex);
  const apo = escape ? Infinity : a*(1+ecc);
  const peri = escape ? a*(1-ecc) : a*(1-ecc); // still meaningful as closest approach
  return {r, v: Math.sqrt(v2), apo, peri, ecc, escape, argPeri, a};
}

function step(dt){
  t += dt;
  // auto-align to prograde/retrograde: ease rotation toward target, real torque
  if(autoAlign !== null){
    const diff = normAngle(autoAlign - ship.angle);
    if(Math.abs(diff) < 0.02 && Math.abs(ship.vangle) < 0.05){ ship.angle = autoAlign; ship.vangle = 0; autoAlign = null; }
    else ship.vangle += Math.sign(diff)*ROT_ACCEL*dt;
  } else if(knobInput !== 0){
    ship.vangle += knobInput*ROT_ACCEL*dt;
  } else {
    ship.vangle *= Math.max(0, 1 - 3*dt); // gentle damping when idle, like RCS auto-trim
  }
  ship.angle += ship.vangle*dt;

  // substep the gravity + thrust integration for a stable orbit
  const N = 6, h = dt/N;
  for(let i=0;i<N;i++){
    const g = gravAccel(ship.rx, ship.ry);
    let ax = g.ax, ay = g.ay;
    if(burning){
      ax += Math.cos(ship.angle)*ACCEL_U;
      ay += Math.sin(ship.angle)*ACCEL_U;
    }
    ship.vx += ax*h; ship.vy += ay*h;
    ship.rx += ship.vx*h; ship.ry += ship.vy*h;
  }

  elems = orbitalElements(ship.rx, ship.ry, ship.vx, ship.vy);

  if(elems.r < SURFACE_U*0.985 && !crashed){
    crashed = true; run = false; runBtn.textContent = 'Resume';
    statusEl.textContent = 'Crashed into the surface — reset to try again.';
    statusEl.classList.remove('ok');
    return;
  }

  const goodPeri = elems.peri > STABLE_PERI_U && !elems.escape;
  if(goodPeri && elems.ecc < STABLE_ECC){
    stableTimer += dt;
    if(stableTimer >= STABLE_HOLD && !stable){ stable = true; statusEl.classList.add('ok'); }
  } else {
    stableTimer = Math.max(0, stableTimer - dt*2);
    if(stableTimer <= 0) stable = false;
  }
  statusEl.classList.toggle('ok', stable);
  statusEl.textContent = stable ? 'Stable orbit achieved — clear of the surface, low eccentricity.'
    : elems.escape ? 'Escape trajectory — you are no longer bound to the planet.'
    : (elems.peri < SURFACE_U ? 'Periapsis is under the surface — burn prograde near apoapsis to raise it.' : 'In orbit — burn prograde to raise it, retrograde to bring it down, or circularize.');
}

function drawPlanet(cx,cy){
  const r = SURFACE_U*PXU;
  const g = ctx.createRadialGradient(cx-r*0.3,cy-r*0.3,r*0.1,cx,cy,r);
  g.addColorStop(0,'#2a4a6b'); g.addColorStop(0.6,'#16324a'); g.addColorStop(1,'#0a1a28');
  ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(127,166,255,.25)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx,cy,r+3,0,7); ctx.stroke();
}

function drawOrbit(cx,cy){
  if(elems.escape || !(elems.a > 0)) return;
  const a = elems.a, e = elems.ecc, ap = elems.argPeri;
  ctx.strokeStyle = stable ? 'rgba(110,227,154,.85)' : (elems.peri < SURFACE_U ? 'rgba(242,96,122,.6)' : 'rgba(246,195,91,.65)');
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for(let i=0;i<=90;i++){
    const nu = i/90*Math.PI*2;
    const rr = a*(1-e*e)/(1+e*Math.cos(nu));
    const xo = rr*Math.cos(nu), yo = rr*Math.sin(nu);
    const x = cx + (xo*Math.cos(ap) - yo*Math.sin(ap))*PXU;
    const y = cy + (xo*Math.sin(ap) + yo*Math.cos(ap))*PXU;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  }
  ctx.closePath(); ctx.stroke();

  // periapsis / apoapsis markers
  const peX = cx + Math.cos(ap)*elems.peri*PXU, peY = cy + Math.sin(ap)*elems.peri*PXU;
  const apX = cx - Math.cos(ap)*elems.apo*PXU, apY = cy - Math.sin(ap)*elems.apo*PXU;
  ctx.fillStyle = elems.peri < SURFACE_U ? BAD : COLD;
  ctx.beginPath(); ctx.arc(peX,peY,3.5,0,7); ctx.fill();
  txt('Pe', peX, peY-11, '10px ui-monospace,Menlo,monospace', elems.peri < SURFACE_U ? BAD : COLD, 'center');
  if(isFinite(elems.apo)){
    ctx.fillStyle = WARN;
    ctx.beginPath(); ctx.arc(apX,apY,3.5,0,7); ctx.fill();
    txt('Ap', apX, apY-11, '10px ui-monospace,Menlo,monospace', WARN, 'center');
  }
}

function drawShip(x,y,a,thrustOn){
  ctx.save(); ctx.translate(x,y); ctx.rotate(a);
  ctx.fillStyle = '#ece6d8';
  ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(-8,6); ctx.lineTo(-4,0); ctx.lineTo(-8,-6); ctx.closePath(); ctx.fill();
  if(thrustOn){
    const g = ctx.createLinearGradient(-8,0,-22,0);
    g.addColorStop(0,'rgba(255,190,120,.9)'); g.addColorStop(1,'rgba(255,110,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-8,3.5); ctx.lineTo(-22,0); ctx.lineTo(-8,-3.5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// mini navball: heading needle plus prograde/retrograde markers, KSP-style
function drawNavball(){
  const r = W < 640 ? 30 : 38, cx = W - r - 14, cy = r + 14;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.fillStyle = 'rgba(9,13,21,.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(58,69,98,.9)'; ctx.lineWidth = 1.4; ctx.stroke();
  const vAngle = Math.atan2(ship.vy, ship.vx);
  const headX = cx+Math.cos(ship.angle)*r*0.82, headY = cy+Math.sin(ship.angle)*r*0.82;
  ctx.strokeStyle = 'rgba(230,235,245,.85)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(headX,headY); ctx.stroke();
  // prograde (teal circle + wings)
  const pgX = cx+Math.cos(vAngle)*r*0.62, pgY = cy+Math.sin(vAngle)*r*0.62;
  ctx.strokeStyle = OK; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(pgX,pgY,3.6,0,7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pgX-7,pgY); ctx.lineTo(pgX-3.6,pgY); ctx.moveTo(pgX+3.6,pgY); ctx.lineTo(pgX+7,pgY); ctx.moveTo(pgX,pgY-6); ctx.lineTo(pgX,pgY-3.6); ctx.stroke();
  // retrograde (circle + x)
  const rgX = cx-Math.cos(vAngle)*r*0.62, rgY = cy-Math.sin(vAngle)*r*0.62;
  ctx.strokeStyle = BAD;
  ctx.beginPath(); ctx.arc(rgX,rgY,3.6,0,7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rgX-4,rgY-4); ctx.lineTo(rgX+4,rgY+4); ctx.moveTo(rgX+4,rgY-4); ctx.lineTo(rgX-4,rgY+4); ctx.stroke();
}

function drawHUD(){
  const pad = W < 640 ? 12 : 18;
  const font = W < 640 ? '10px ui-monospace,Menlo,monospace' : '11px ui-monospace,Menlo,monospace';
  const lfont = W < 640 ? '9px system-ui' : '10px system-ui';
  const altU = elems.r - SURFACE_U;
  const periCol = elems.peri < SURFACE_U ? BAD : (elems.peri > STABLE_PERI_U ? OK : WARN);
  const eccCol = elems.ecc < STABLE_ECC ? OK : COLD;
  txt('ALTITUDE', pad, pad+2, lfont, 'rgba(141,153,179,.75)', 'left');
  txt(altU.toFixed(2)+' R', pad, pad+16, font, altU>0?'rgba(230,235,245,.85)':BAD, 'left');
  txt('VELOCITY', pad, pad+34, lfont, 'rgba(141,153,179,.75)', 'left');
  txt(elems.v.toFixed(2)+' u/s', pad, pad+48, font, 'rgba(230,235,245,.85)', 'left');
  txt('APOAPSIS', W-pad-58, pad+2, lfont, 'rgba(141,153,179,.75)', 'right');
  txt(elems.escape ? 'ESCAPE' : elems.apo.toFixed(2)+' R', W-pad-58, pad+16, font, WARN, 'right');
  txt('PERIAPSIS', pad, H-pad-32, lfont, 'rgba(141,153,179,.75)', 'left');
  txt(elems.peri.toFixed(2)+' R', pad, H-pad-18, font, periCol, 'left');
  txt('ECCENTRICITY', pad, H-pad-2, lfont, 'rgba(141,153,179,.75)', 'left');
  txt(elems.ecc.toFixed(2), pad+96, H-pad-2, font, eccCol, 'left');
  txt('STATUS', W-pad, H-pad-16, lfont, 'rgba(141,153,179,.75)', 'right');
  txt(crashed ? 'CRASHED' : stable ? 'STABLE ORBIT' : elems.escape ? 'ESCAPING' : 'INSERTING', W-pad, H-pad-2, font, crashed?BAD:(stable?OK:'rgba(230,235,245,.85)'), 'right');
}

function draw(){
  ctx.fillStyle = '#05060c'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(220,228,245,.4)';
  for(const s of STARS) ctx.fillRect(s.x*W, s.y*H, s.s, s.s);

  const cx = W/2, cy = H/2;
  drawOrbit(cx,cy);
  drawPlanet(cx,cy);
  drawShip(cx+ship.rx*PXU, cy+ship.ry*PXU, ship.angle, burning);
  drawNavball();
  drawHUD();
}

let raf = null, lastMs = null;
function loop(ms){
  if(!visible){ raf = null; return; }
  if(run){
    if(lastMs===null) lastMs = ms;
    const dt = Math.min(0.033, (ms-lastMs)/1000);
    lastMs = ms;
    step(dt);
  } else lastMs = null;
  draw();
  raf = requestAnimationFrame(loop);
}
function kick(){ if(!raf && visible) raf = requestAnimationFrame(loop); }

let burning = false, knobInput = 0;
function holdBtn(btn, on, off){
  const down = e => { on(); e.preventDefault(); };
  const up = () => off();
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('pointercancel', up);
}
holdBtn(thrustBtn, () => { burning = true; thrustBtn.classList.add('held'); autoAlign = null; }, () => { burning = false; thrustBtn.classList.remove('held'); });
addEventListener('keydown', e => {
  if(e.key===' ' || e.key==='ArrowUp'){ burning = true; autoAlign = null; e.preventDefault(); }
});
addEventListener('keyup', e => { if(e.key===' ' || e.key==='ArrowUp') burning = false; });

proBtn.addEventListener('click', () => { autoAlign = Math.atan2(ship.vy, ship.vx); proBtn.classList.add('on'); retroBtn.classList.remove('on'); });
retroBtn.addEventListener('click', () => { autoAlign = Math.atan2(ship.vy, ship.vx) + Math.PI; retroBtn.classList.add('on'); proBtn.classList.remove('on'); });

runBtn.addEventListener('click', () => { if(crashed) return; run = !run; runBtn.textContent = run ? 'Pause' : 'Resume'; lastMs = null; kick(); });
resetBtn.addEventListener('click', () => { reset(); proBtn.classList.remove('on'); retroBtn.classList.remove('on'); draw(); });

// KSP-style analog rotation knob: drag away from center to command a turn
// rate proportional to the deflection; it springs back to neutral on release.
(() => {
  const kctx = knobCv.getContext('2d');
  const R = 42, CX = 42, CY = 42, MAXDEG = 55 * Math.PI/180;
  let dragging = false, knobAngle = 0;
  function drawKnob(){
    kctx.clearRect(0,0,84,84);
    kctx.beginPath(); kctx.arc(CX,CY,R,0,7);
    const g = kctx.createRadialGradient(CX-10,CY-10,4,CX,CY,R);
    g.addColorStop(0,'#1c2436'); g.addColorStop(1,'#0c111c');
    kctx.fillStyle = g; kctx.fill();
    kctx.strokeStyle = dragging ? '#F6C35B' : '#2a3450'; kctx.lineWidth = 2; kctx.stroke();
    for(let i=-2;i<=2;i++){
      const a = -Math.PI/2 + i*0.28;
      kctx.strokeStyle = 'rgba(141,153,179,.5)'; kctx.lineWidth = 1.5;
      kctx.beginPath(); kctx.moveTo(CX+Math.cos(a)*(R-3), CY+Math.sin(a)*(R-3)); kctx.lineTo(CX+Math.cos(a)*(R-8), CY+Math.sin(a)*(R-8)); kctx.stroke();
    }
    const na = -Math.PI/2 + knobAngle;
    kctx.strokeStyle = '#F6C35B'; kctx.lineWidth = 3; kctx.lineCap='round';
    kctx.beginPath(); kctx.moveTo(CX,CY); kctx.lineTo(CX+Math.cos(na)*(R-10), CY+Math.sin(na)*(R-10)); kctx.stroke();
    kctx.beginPath(); kctx.arc(CX,CY,4,0,7); kctx.fillStyle = '#ece6d8'; kctx.fill();
  }
  function angleFromEvent(e){
    const rect = knobCv.getBoundingClientRect();
    const x = e.clientX-rect.left-CX, y = e.clientY-rect.top-CY;
    let a = Math.atan2(y,x) + Math.PI/2;
    while(a > Math.PI) a -= Math.PI*2; while(a < -Math.PI) a += Math.PI*2;
    return Math.max(-MAXDEG, Math.min(MAXDEG, a));
  }
  knobCv.addEventListener('pointerdown', e => { dragging = true; autoAlign = null; knobAngle = angleFromEvent(e); knobInput = knobAngle/MAXDEG; drawKnob(); knobCv.setPointerCapture(e.pointerId); });
  knobCv.addEventListener('pointermove', e => { if(!dragging) return; knobAngle = angleFromEvent(e); knobInput = knobAngle/MAXDEG; drawKnob(); });
  function release(){ dragging = false; knobAngle = 0; knobInput = 0; drawKnob(); }
  knobCv.addEventListener('pointerup', release);
  knobCv.addEventListener('pointercancel', release);
  knobCv.addEventListener('pointerleave', () => { if(dragging) release(); });
  drawKnob();
})();

new IntersectionObserver(es => { for(const e of es){ visible = e.isIntersecting; if(visible){ if(!W) resize(); kick(); } } }, {threshold:0.05}).observe(cv);
resize();
draw();
})();
