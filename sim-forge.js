/* =====================================================================
   CHAPTER 2 — STAR FORGE
   The engine and drawing code are carried over unchanged from
   "From Particles to Life" (Live lab → Star forge), with the
   constants of nature fixed at the values of our universe.
   ===================================================================== */
(() => {
"use strict";
const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const fmt = (v,d=2) => Number(v).toFixed(d);

/* ---- constants of nature: our universe ---- */
const P = {as:1, al:1};
const aV=15.75, aS0=17.8, aC0=0.711, aA=23.7, apair=11.18;   // SEMF, MeV
const ME0=0.511, DM0=1.29333, BD0=2.2246;
const R = (() => {
  const BD = BD0, Bpp = BD - 1.59 - 0.72, Qpp = BD - DM0 - ME0, Qn = DM0 - ME0;
  return {me:ME0, dm:DM0, diproton:Bpp > 0, pp:Qpp > 0, Qpp, neutronDecays:Qn > 0,
          nLife:879.4, carbonYield:Math.exp(-Math.abs(0)/13)};
})();
function B(A, Z, sM, eM){
  const N = A - Z;
  if(A < 2 || Z < 1 || N < 0) return -1e9;
  const even = x => x % 2 === 0;
  const d = (even(Z) && even(N)) ? apair/Math.sqrt(A) : ((!even(Z) && !even(N)) ? -apair/Math.sqrt(A) : 0);
  return aV*sM*A - aS0*sM*Math.pow(A,2/3) - aC0*eM*Z*(Z-1)/Math.cbrt(A) - aA*(A-2*Z)*(A-2*Z)/A + d;
}

/* ---- drawing helpers ---- */
function fit(cv){
  const ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
  if(!r.width) return null;
  cv.width = Math.round(r.width*dpr); cv.height = Math.round(r.height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx, W:r.width, H:r.height};
}
function rrect(ctx,x,y,w,h,r){ ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,w,h,r); else ctx.rect(x,y,w,h); }
function txt(ctx,s,x,y,font,col,align){ ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align||'left'; ctx.textBaseline = 'middle'; ctx.fillText(s,x,y); }

const cv = $('forgeCv');
let W=0, H=0, run=true, acc=0, flash=null, clock=0, hoverZ=0, started=false, visible=false;
let p = [], T = 0.42;
const SC = () => 12;
const rnd2 = (a,b) => a + Math.random()*(b-a);
function add(o){ p.push(Object.assign({x:0,y:0,vx:0,vy:0,m:1}, o)); return p[p.length-1]; }
const panelH = () => W < 640 ? 136 : 176;
const worldW = () => W/SC(), worldH = () => (H - panelH())/SC();
function wall(q, bounce){
  const Rr = q.r || 0.5, ww = worldW(), wh = worldH();
  if(q.x < Rr){ q.x = Rr; q.vx = Math.abs(q.vx)*bounce; }
  if(q.x > ww-Rr){ q.x = ww-Rr; q.vx = -Math.abs(q.vx)*bounce; }
  if(q.y < Rr){ q.y = Rr; q.vy = Math.abs(q.vy)*bounce; }
  if(q.y > wh-Rr){ q.y = wh-Rr; q.vy = -Math.abs(q.vy)*bounce; }
}
function thermostat(target, rate){
  let ke = 0; for(const q of p) ke += 0.5*q.m*(q.vx*q.vx + q.vy*q.vy);
  const cur = p.length ? ke/p.length : 0;
  if(cur <= 0){ if(target > 0) for(const q of p){ q.vx += rnd2(-1,1)*0.2; q.vy += rnd2(-1,1)*0.2; } return cur; }
  const f = Math.sqrt(1 + rate*(target/cur - 1));
  if(isFinite(f)) for(const q of p){ q.vx *= f; q.vy *= f; }
  return cur;
}

/* ---- elements ---- */
const ESYM = ('n H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr '
  + 'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta '
  + 'W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' ');
const ORIGIN = {
  BB:['Big Bang','#ff6b6b'], CR:['cosmic-ray collisions','#7ee0ff'], AGB:['dying low-mass stars','#3ddc84'],
  FU:['massive stars','#b388ff'], EX:['exploding white dwarfs','#ffa94d'], SP:['s-process: slow neutron capture','#ffd23f'],
  RP:['r-process: neutron-star mergers and supernovae','#ff7ba8'], MM:['man-made','#9aa5bd']
};
const EINFO = {
  1:['Hydrogen','BB','Made in the first three minutes. Three quarters of all atoms, and half of every water molecule.'],
  2:['Helium','BB','Also primordial, and made again by every star that burns hydrogen.'],
  3:['Lithium','BB','Partly from the Big Bang, partly cosmic rays. Stars destroy it almost as fast as they make it.'],
  4:['Beryllium','CR','Not made in stars at all. Cosmic rays chip it off heavier nuclei drifting through space.'],
  5:['Boron','CR','Another splinter knocked loose from carbon and oxygen by cosmic rays.'],
  6:['Carbon','AGB','Forged by the triple alpha. Four bonds each, chains of any length: the backbone of all life.'],
  7:['Nitrogen','AGB','Made in the CNO cycle. In every amino acid and every letter of the genetic code.'],
  8:['Oxygen','FU','Massive stars make it in bulk. By mass, the most abundant element in your body.'],
  9:['Fluorine','FU','Rare and fragile: stellar interiors destroy it almost as quickly as it forms.'],
  10:['Neon','FU','An alpha-ladder rung — oxygen that captured a helium nucleus.'],
  11:['Sodium','FU','From carbon burning. Your nerves fire by pumping it across membranes.'],
  12:['Magnesium','FU','Alpha ladder. Sits at the centre of every chlorophyll molecule.'],
  13:['Aluminium','FU','Its radioactive form ²⁶Al heated the rocks of the infant solar system.'],
  14:['Silicon','FU','Alpha ladder. Most of the rock under your feet, and every computer chip.'],
  15:['Phosphorus','FU','The backbone of DNA, and the energy currency ATP that runs every cell.'],
  16:['Sulfur','FU','Alpha ladder. Locks proteins into shape through disulfide bridges.'],
  17:['Chlorine','FU','Paired with sodium in the salt of seawater and of blood.'],
  18:['Argon','FU','Mostly ⁴⁰Ar, built up over billions of years by potassium decaying in rock.'],
  19:['Potassium','FU','Radioactive ⁴⁰K inside you decays a few thousand times every second.'],
  20:['Calcium','FU','The last easy rung of the alpha ladder. Your skeleton and your teeth.'],
  21:['Scandium','FU','Oddly rare: it falls in a gap between the alpha-ladder rungs.'],
  22:['Titanium','EX',''], 23:['Vanadium','EX',''], 24:['Chromium','EX',''],
  25:['Manganese','EX','Made in the last seconds before a white dwarf detonates.'],
  26:['Iron','EX','The end of the road. Nothing heavier releases energy by fusing, so stars stop here.'],
  27:['Cobalt','EX','Sits at the centre of vitamin B12, the one vitamin with a metal atom in it.'],
  28:['Nickel','EX','Supernovae shine for weeks on the decay of the ⁵⁶Ni they make in the first second.'],
  29:['Copper','FU','Carried oxygen in the blood of your evolutionary ancestors before iron took over.'],
  30:['Zinc','FU','Thousands of your proteins fold around a zinc atom to grip DNA.'],
  31:['Gallium','SP',''], 32:['Germanium','SP',''], 33:['Arsenic','SP',''], 34:['Selenium','SP','Rare but essential: without it, several enzymes simply do not work.'],
  35:['Bromine','SP',''], 36:['Krypton','SP',''], 37:['Rubidium','SP',''],
  38:['Strontium','SP','Chemically so like calcium that bones absorb it, which is why fallout strontium is dangerous.'],
  39:['Yttrium','SP',''], 40:['Zirconium','SP',''], 41:['Niobium','SP',''],
  42:['Molybdenum','SP','At the heart of the enzyme that pulls nitrogen out of the air.'],
  43:['Technetium','MM','The first element made by people. It has no stable isotope, yet it is seen in old stars — proof that they are forging elements right now.'],
  44:['Ruthenium','SP',''], 45:['Rhodium','RP',''], 46:['Palladium','SP',''],
  47:['Silver','SP','Half s-process, half neutron-star debris.'],
  48:['Cadmium','SP',''], 49:['Indium','RP',''], 50:['Tin','SP','Unusually common for its weight: its nucleus has a "magic" proton count that resists further capture.'],
  51:['Antimony','RP',''], 52:['Tellurium','RP',''],
  53:['Iodine','RP','Neutron-star debris that your thyroid cannot work without.'],
  54:['Xenon','RP',''], 55:['Caesium','RP',''], 56:['Barium','SP','A classic s-process element; stars rich in it are the smoking gun for slow neutron capture.'],
  57:['Lanthanum','SP',''], 58:['Cerium','SP',''], 59:['Praseodymium','SP',''], 60:['Neodymium','SP',''],
  61:['Promethium','MM','No stable isotope at all. It was detected around a neutron-star merger in 2017.'],
  62:['Samarium','SP',''], 63:['Europium','RP','Almost purely r-process: astronomers use it to measure neutron-star merger debris.'],
  64:['Gadolinium','RP',''], 65:['Terbium','RP',''], 66:['Dysprosium','RP',''], 67:['Holmium','RP',''],
  68:['Erbium','RP',''], 69:['Thulium','RP',''], 70:['Ytterbium','RP',''], 71:['Lutetium','RP',''],
  72:['Hafnium','SP',''], 73:['Tantalum','SP',''], 74:['Tungsten','SP','Holds together at higher temperature than any other metal.'],
  75:['Rhenium','RP',''], 76:['Osmium','RP','The densest natural element.'], 77:['Iridium','RP','The worldwide iridium layer in 66-million-year-old rock is the fingerprint of the asteroid that ended the dinosaurs.'],
  78:['Platinum','RP',''], 79:['Gold','RP','Made when neutron stars collide. Every gold atom you have ever seen is debris from such a crash.'],
  80:['Mercury','SP',''], 81:['Thallium','SP',''],
  82:['Lead','SP','The heaviest element with truly stable isotopes, and where most radioactive decay chains finally stop.'],
  83:['Bismuth','SP','Long called the heaviest stable element; it does decay, with a half-life a billion times the age of the universe.'],
  84:['Polonium','RP',''], 85:['Astatine','RP','The rarest natural element: perhaps a spoonful exists in the whole Earth at any moment.'],
  86:['Radon','RP',''], 87:['Francium','RP',''], 88:['Radium','RP',''], 89:['Actinium','RP',''],
  90:['Thorium','RP','Older than the solar system. Its slow decay still helps keep the Earth’s interior molten.'],
  91:['Protactinium','RP',''],
  92:['Uranium','RP','The heaviest element nature still holds in quantity, forged in a neutron-star merger before the Sun existed.'],
  93:['Neptunium','MM',''], 94:['Plutonium','MM','Essentially all of it is man-made, though nature makes fleeting traces.'],
  95:['Americium','MM','The speck inside a household smoke detector.'], 96:['Curium','MM',''], 97:['Berkelium','MM',''],
  98:['Californium','MM',''], 99:['Einsteinium','MM',''], 100:['Fermium','MM','About the heaviest a neutron-capture chain can reach before fission takes over.'],
  101:['Mendelevium','MM',''], 102:['Nobelium','MM',''], 103:['Lawrencium','MM',''], 104:['Rutherfordium','MM',''],
  105:['Dubnium','MM',''], 106:['Seaborgium','MM',''], 107:['Bohrium','MM',''], 108:['Hassium','MM',''],
  109:['Meitnerium','MM',''], 110:['Darmstadtium','MM',''], 111:['Roentgenium','MM',''], 112:['Copernicium','MM',''],
  113:['Nihonium','MM',''], 114:['Flerovium','MM',''], 115:['Moscovium','MM',''], 116:['Livermorium','MM',''],
  117:['Tennessine','MM',''], 118:['Oganesson','MM','The heaviest element ever made, and it survives for well under a second.']
};

// measured binding energies for the light and common nuclei; the mass formula covers the rest
const BETBL = {'0,1':0,'1,1':0,'1,2':2.2246,'1,3':8.482,'2,3':7.718,'2,4':28.296,'3,6':31.99,'3,7':39.24,
  '4,8':56.50,'4,9':58.16,'5,10':64.75,'5,11':76.21,'6,12':92.16,'6,13':97.11,'7,14':104.66,'7,15':115.49,
  '8,16':127.62,'8,17':131.76,'8,18':139.81,'9,19':147.80,'10,20':160.64,'10,22':177.77,'11,23':186.56,
  '12,24':198.26,'12,25':205.59,'13,27':224.95,'14,28':236.54,'15,31':262.92,'16,32':271.78,'17,35':298.21,
  '18,36':306.72,'19,39':333.72,'20,40':342.05,'22,48':418.70,'24,52':456.35,'26,54':471.76,'26,56':492.25,
  '28,58':506.46,'28,62':545.26,'29,63':551.38,'30,64':559.09};
function BEn(Z, A){
  if(Z < 0 || A < 1 || A < Z) return -1e9;
  if(A === 1) return 0;
  const k = Z + ',' + A, std = (P.as === 1 && P.al === 1);
  if(std && (k in BETBL)) return BETBL[k];
  // Below A = 12 the mass formula would invent nuclei that do not exist (no stable A = 5 or A = 8)
  if(A < 12) return (k in BETBL) ? BETBL[k]*(1 + (P.as - 1)*1.5) : -1e9;
  return B(A, Z, P.as, P.al);
}
const Qfus = (z1,a1,z2,a2) => BEn(z1+z2, a1+a2) - BEn(z1,a1) - BEn(z2,a2);
const Salpha = (Z,A) => A > 4 ? BEn(Z,A) - BEn(Z-2,A-4) - BEn(2,4) : 99;
const Sn = (Z,A) => BEn(Z,A) - BEn(Z,A-1);
const Qbeta = (Z,A) => (BEn(Z+1,A) - BEn(Z,A)) + (R.dm - R.me);
const nucR = A => 0.26 + 0.20*Math.cbrt(A);
function nucColor(Z){
  if(Z === 0) return '#c8d2e6';
  if(Z === 1) return '#ff6b6b';
  if(Z === 2) return '#3ddc84';
  if(Z <= 5)  return '#7ee0ff';
  if(Z <= 8)  return '#4fb3ff';
  if(Z <= 14) return '#b388ff';
  if(Z <= 20) return '#e07bff';
  if(Z <= 28) return '#ffa94d';
  if(Z <= 50) return '#ffd23f';
  if(Z <= 82) return '#f2e6a0';
  return '#ff7ba8';
}
// temperature: the slider is logarithmic, 0.005 to 10 billion kelvin
const T9 = () => 0.005*Math.pow(10, T*1.65);
const Tign = (z1,z2) => 0.016*Math.pow(Math.max(1, z1*z2)*P.al, 1.05);
function barrier(z1,z2){
  if(z1 === 0 || z2 === 0) return 1;
  const t = T9()/Tign(z1,z2);
  const sharp = 9 + 0.05*z1*z2;
  return Math.min(1, Math.exp(-sharp*(Math.pow(1/t, 1/3) - 1)));
}
const forge = {feed:0.35, fz:1, fa:1, neutrons:false, sn:0, released:0, rate:0, events:0, cap:230, log:[]};
function nuc(Z, A, x, y, v){
  const s = v === undefined ? 4 : v;
  return add({t:'nuc2', Z, A, x, y, vx:rnd2(-s,s), vy:rnd2(-s,s), m:Math.max(1,A), r:nucR(A), born:clock});
}
function flashAt(x, y, big){ flash = {x, y, t:clock, big:!!big}; }
function note(s){ forge.log.unshift({s, t:clock}); if(forge.log.length > 5) forge.log.pop(); }

function stepForge(dt){
  const kc = 0.30*P.al, t9 = T9();
  for(const q of p){ q.fx = 0; q.fy = 0; }
  for(let i=0;i<p.length;i++) for(let j=i+1;j<p.length;j++){
    const A1 = p[i], B1 = p[j];
    if(A1.Z === 0 && B1.Z === 0) continue;
    const dx = B1.x-A1.x, dy = B1.y-A1.y;
    let r2 = dx*dx + dy*dy; if(r2 < 0.04) r2 = 0.04;
    if(r2 > 160) continue;                                // plasma screening
    const r = Math.sqrt(r2);
    const f = -kc*A1.Z*B1.Z/r2;
    const ux = dx/r, uy = dy/r;
    A1.fx += f*ux; A1.fy += f*uy; B1.fx -= f*ux; B1.fy -= f*uy;
  }
  for(const q of p){
    q.vx += q.fx/q.m*dt; q.vy += q.fy/q.m*dt;
    q.x += q.vx*dt; q.y += q.vy*dt; wall(q, 1);
  }
  thermostat(2 + 15*clamp(Math.log10(t9/0.005)/3.3, 0, 1), 0.05);
}

function reactForge(dt){
  const t9 = T9(), kT = 0.0862*t9;                       // MeV
  const dead = new Set(), born = [];
  let released = 0;
  const kill = i => dead.add(i);
  for(let i=0;i<p.length;i++){
    if(dead.has(i)) continue;
    const A1 = p[i];
    for(let j=i+1;j<p.length;j++){
      if(dead.has(i) || dead.has(j)) continue;
      const B1 = p[j];
      const d = Math.hypot(B1.x-A1.x, B1.y-A1.y);
      if(d > A1.r + B1.r + 0.45) continue;
      const z1 = A1.Z, a1 = A1.A, z2 = B1.Z, a2 = B1.A;
      let prob = 0, mk = null, lbl = null, Q = 0;
      if(z1 === 0 && z2 === 0) continue;
      else if(z1 === 0 || z2 === 0){                     // neutron capture
        const N = z1 === 0 ? B1 : A1;
        if(Sn(N.Z, N.A+1) <= 0) continue;
        const k = forge.sn > 0 ? 1 + (Math.random()*14|0) : 1;
        let a = N.A;
        for(let c=0;c<k;c++){ if(Sn(N.Z, a+1) <= 0) break; a++; }
        if(a === N.A) continue;
        prob = forge.sn > 0 ? 0.62 : 0.34; Q = Sn(N.Z, a);
        mk = [[N.Z, a]]; lbl = 'ncap';
      } else if(z1 === 1 && a1 === 1 && z2 === 1 && a2 === 1){   // p + p
        if(R.diproton){ prob = barrier(1,1); mk = [[2,4]]; Q = 28.3; lbl = 'pp-runaway'; }
        else if(R.pp){ prob = barrier(1,1)*0.02; mk = [[1,2]]; Q = R.Qpp; lbl = 'pp'; }
      } else if(z1 === 2 && a1 === 4 && z2 === 2 && a2 === 4){   // triple alpha
        let third = -1;
        for(let k=0;k<p.length;k++){
          if(k === i || k === j || dead.has(k)) continue;
          if(p[k].Z === 2 && p[k].A === 4 && Math.hypot(p[k].x-A1.x, p[k].y-A1.y) < 3.2){ third = k; break; }
        }
        if(third < 0) continue;
        prob = barrier(2,2)*0.55*R.carbonYield;
        mk = [[6,12]]; Q = BEn(6,12) - 3*BEn(2,4); lbl = '3alpha'; dead.add(third);
      } else {                                            // general fusion
        const Zp = z1+z2, Ap = a1+a2;
        Q = Qfus(z1,a1,z2,a2);
        if(Q <= 0.3) continue;                            // endothermic: this is the iron wall
        if(Zp*Zp/Ap > 48) continue;
        prob = barrier(z1,z2)*0.9;
        mk = [[Zp, Ap]]; lbl = 'fus';
      }
      if(mk && Math.random() < prob){
        kill(i); kill(j);
        const mx = (A1.x+B1.x)/2, my = (A1.y+B1.y)/2;
        for(const [z,a] of mk) born.push({z, a, x:mx+rnd2(-.3,.3), y:my+rnd2(-.3,.3), v:2 + Math.min(7, Math.abs(Q)/4)});
        released += Q; forge.events++;
        if(lbl === '3alpha') flashAt(mx,my,false);
        else if(Q > 8) flashAt(mx,my,false);
        break;
      }
    }
  }
  for(let i=0;i<p.length;i++){
    if(dead.has(i)) continue;
    const q = p[i];
    if(q.Z === 0 && q.A === 1){
      if(R.neutronDecays && Math.random() < 0.05*(879.4/R.nLife)*dt){ q.Z = 1; q.beta = clock; }
      continue;
    }
    if(q.A <= 1) continue;
    const qb = Qbeta(q.Z, q.A);
    if(qb > 0.05){
      const rate = Math.min(9, 0.010*Math.pow(qb, 3));
      if(Math.random() < rate*dt){ q.Z += 1; q.r = nucR(q.A); q.beta = clock; continue; }
    }
    const sa = Salpha(q.Z, q.A);
    if(q.A > 8 && sa > 0 && sa < 20 && qb < 1.5){
      const rate = 400*Math.exp(-sa/Math.max(kT, 1e-4));
      if(Math.random() < Math.min(6, rate)*dt){
        kill(i);
        born.push({z:q.Z-2, a:q.A-4, x:q.x, y:q.y, v:3});
        born.push({z:2, a:4, x:q.x+rnd2(-.4,.4), y:q.y+rnd2(-.4,.4), v:5});
        released -= sa; forge.photo = (forge.photo||0)+1;
        continue;
      }
    }
    if(q.Z*q.Z/q.A > 47 && Math.random() < 1.2*dt){
      kill(i);
      const fa = Math.round(q.A*rnd2(0.40,0.52)), fz = Math.round(q.Z*fa/q.A);
      born.push({z:fz, a:fa, x:q.x, y:q.y, v:8});
      born.push({z:q.Z-fz, a:q.A-fa-2, x:q.x, y:q.y, v:8});
      born.push({z:0, a:1, x:q.x, y:q.y, v:11}); born.push({z:0, a:1, x:q.x, y:q.y, v:11});
      forge.fis = (forge.fis||0)+1; flashAt(q.x, q.y, false);
    }
  }
  if(dead.size) p = p.filter((_,i) => !dead.has(i));
  for(const b of born) if(b.z >= 0 && b.a >= 1) nuc(b.z, b.a, b.x, b.y, b.v);
  forge.released += released;
  forge.rate = forge.rate*0.9 + (released/Math.max(dt,1e-3))*0.1;

  if(forge.sn > 0){
    forge.sn -= dt;
    forge.nacc = (forge.nacc||0) + 125*dt;
    while(forge.nacc >= 1 && p.length < forge.cap + 110){ forge.nacc--; nuc(0, 1, rnd2(1, worldW()-1), rnd2(1, worldH()-1), 14); }
    if(forge.sn <= 0){
      note('Shock wave: the ejecta expand and cool, locking in the new elements.');
      T = 0.5; syncT();
      const cx = worldW()/2, cy = worldH()/2;
      for(const q of p){ const dx = q.x-cx, dy = q.y-cy, d = Math.hypot(dx,dy)||1; q.vx += dx/d*9; q.vy += dy/d*9; }
    }
  } else if(forge.neutrons){
    forge.nacc = (forge.nacc||0) + 9*dt;
    while(forge.nacc >= 1 && p.length < forge.cap){ forge.nacc--; nuc(0, 1, rnd2(1, worldW()-1), rnd2(1, worldH()-1), 6); }
  }
  if(forge.feed > 0 && p.length < forge.cap){
    forge.hacc = (forge.hacc||0) + forge.feed*9*dt;
    while(forge.hacc >= 1 && p.length < forge.cap){ forge.hacc--; nuc(forge.fz, forge.fa, rnd2(1, worldW()-1), rnd2(1, worldH()-1), 5); }
  }
}

function supernova(){
  forge.sn = 9; T = Math.max(T, 1.72); syncT();
  note('Core collapse! A burst of neutrons drives the r-process.');
  flashAt(worldW()/2, worldH()/2, true);
}
function abundance(){
  const c = {}; let tot = 0;
  for(const q of p){ if(q.Z === 0) continue; c[q.Z] = (c[q.Z]||0)+1; tot++; }
  return {c, tot};
}
function stageName(){
  const {c, tot} = abundance();
  if(!tot) return ['empty', '#8d99b3'];
  let dz = 1, dn = 0;
  for(const z in c) if(c[z] > dn){ dn = c[z]; dz = +z; }
  const heavy = Object.keys(c).filter(z => +z >= 40).length;
  const freeN = p.filter(q => q.Z === 0).length;
  if(forge.sn > 0) return ['💥 SUPERNOVA — r-process under way', '#ff5c5c'];
  if(heavy > 2 && freeN > 2) return ['neutron capture is building elements past iron', '#ffd23f'];
  if(heavy > 2) return ['heavy elements made, neutron source spent', '#f2e6a0'];
  if(dz >= 26) return ['iron core — fusion cannot release energy any more', '#ffa94d'];
  if(dz >= 20) return ['advanced burning toward the iron peak', '#e07bff'];
  if(dz >= 14) return ['silicon burning → iron', '#e07bff'];
  if(dz >= 10) return ['neon and oxygen burning', '#b388ff'];
  if(dz >= 6)  return ['carbon burning', '#4fb3ff'];
  if(dz === 2) return ['helium burning (triple alpha)', '#3ddc84'];
  return ['hydrogen burning', '#ff6b6b'];
}
function circle(ctx, x, y, r, col, line){
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = col; ctx.fill();
  if(line){ ctx.strokeStyle = line; ctx.lineWidth = 0.05; ctx.stroke(); }
}
function drawForge(ctx, now){
  for(const q of p){
    const col = nucColor(q.Z), rr = q.r;
    if(q.Z === 0){
      ctx.globalAlpha = 0.85; circle(ctx, q.x, q.y, rr*0.8, col, 'rgba(255,255,255,.3)'); ctx.globalAlpha = 1;
    } else {
      circle(ctx, q.x, q.y, rr, col, 'rgba(255,255,255,.45)');
      const sym = ESYM[q.Z] || ('Z'+q.Z);
      ctx.font = `800 ${Math.min(rr*1.15, 0.78)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 0.1; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.strokeText(sym, q.x, q.y);
      ctx.fillStyle = '#0b0f18'; ctx.fillText(sym, q.x, q.y);
      if(rr > 0.95){ ctx.font = `700 ${rr*0.46}px ui-monospace,Menlo,monospace`; ctx.fillStyle = 'rgba(11,15,24,.75)';
        ctx.fillText(String(q.A), q.x, q.y + rr*0.62); }
    }
    if(q.beta && now - q.beta < 0.4){
      ctx.strokeStyle = `rgba(120,230,255,${1 - (now-q.beta)/0.4})`; ctx.lineWidth = 0.07;
      ctx.beginPath(); ctx.arc(q.x, q.y, rr + 0.35, 0, 7); ctx.stroke();
    }
  }
  if(flash && now - flash.t >= 0 && now - flash.t < (flash.big ? 1.4 : 0.45)){
    const dur = flash.big ? 1.4 : 0.45, u = clamp((now - flash.t)/dur, 0, 1);
    ctx.strokeStyle = flash.big ? `rgba(255,190,120,${1-u})` : `rgba(255,240,180,${1-u})`;
    ctx.lineWidth = (flash.big ? 0.8 : 0.2)*(1-u);
    ctx.beginPath(); ctx.arc(flash.x, flash.y, 0.4 + u*(flash.big ? 40 : 3.2), 0, 7); ctx.stroke();
  }
}
let abGeom = null;
function drawAbundance(ctx){
  const narrow = W < 640;
  const h = panelH(), y0 = H - h, pad = 14, side = narrow ? 0 : 186, w = W - pad*2 - side;
  ctx.fillStyle = 'rgba(11,15,24,.86)'; ctx.fillRect(0, y0, W, h);
  ctx.strokeStyle = 'rgba(38,49,74,.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
  const {c, tot} = abundance();
  const Zmax = 100, bw = w/Zmax, base = y0 + h - (narrow ? 30 : 40), top = y0 + (narrow ? 48 : 46);
  abGeom = {y0, h, pad, w, bw, Zmax, base, top};
  let mx = 1; for(const z in c) mx = Math.max(mx, c[z]);
  const [st, sc] = stageName();
  if(narrow){
    txt(ctx, 'Abundance by element (log) — tap a bar', pad, y0 + 15, '700 11.5px system-ui', '#e6ebf5');
    txt(ctx, st, pad, y0 + 32, '700 11px system-ui', sc);
  } else {
    txt(ctx, 'Abundance by element (log scale) — hover a bar', pad, y0 + 15, '700 11.5px system-ui', '#e6ebf5');
    txt(ctx, st, pad + w, y0 + 15, '700 11.5px system-ui', sc, 'right');
  }
  for(let Z=1; Z<=Zmax; Z++){
    const n = c[Z] || 0, x = pad + (Z-1)*bw, hot = hoverZ === Z;
    if(n){
      const bh = Math.max(7, (base - top)*Math.log(1+n)/Math.log(1+mx));
      ctx.fillStyle = nucColor(Z); ctx.fillRect(x, base - bh, Math.max(1.6, bw-1), bh);
      if(hot){ ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.strokeRect(x-0.5, base-bh-0.5, Math.max(1.6,bw-1)+1, bh+1); }
      if(!narrow || hot || n > 2){
        ctx.save(); ctx.translate(x + bw/2 + 0.5, base - bh - 3); ctx.rotate(-Math.PI/2);
        ctx.font = '700 9.5px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = hot ? '#fff' : nucColor(Z); ctx.fillText(ESYM[Z] || Z, 0, 0);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = hot ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.055)';
      ctx.fillRect(x, base-3, Math.max(1.6, bw-1), 3);
      if(hot){ ctx.save(); ctx.translate(x + bw/2 + 0.5, base - 7); ctx.rotate(-Math.PI/2);
        ctx.font = '700 9.5px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#6b7b9c'; ctx.fillText(ESYM[Z] || Z, 0, 0); ctx.restore(); }
    }
    if([1,2,6,8,14,20,26,28,50,82,92].includes(Z) && (!narrow || [1,26,50,92].includes(Z))){
      ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.beginPath(); ctx.moveTo(x + bw/2, top); ctx.lineTo(x + bw/2, base); ctx.stroke();
      txt(ctx, String(Z), x + bw/2, base + 11, '9px ui-monospace,Menlo', c[Z] ? '#aab6cf' : '#4a5570', 'center');
    }
  }
  txt(ctx, 'atomic number Z →', pad + w, base + 24, '9.5px system-ui', '#5d6b8a', 'right');
  if(!narrow){
    forge.log.forEach((L,i) => {
      const a = clamp(1 - (clock - L.t)/14, 0, 1);
      ctx.globalAlpha = a; txt(ctx, L.s, W - 180, y0 + 40 + i*16, '11px system-ui', i ? '#8d99b3' : '#ffd23f'); ctx.globalAlpha = 1;
    });
    txt(ctx, `${tot} nuclei`, W - 180, y0 + 15, '700 11px ui-monospace,Menlo', '#8d99b3');
  }
  if(hoverZ) drawElementCard(ctx, hoverZ, c[hoverZ] || 0);
}
function drawElementCard(ctx, Z, n){
  const E = EINFO[Z]; if(!E) return;
  const [name, ocode, nt] = E, [oname, ocol] = ORIGIN[ocode] || ['unknown','#8d99b3'];
  const cw = Math.min(330, W - 20), x = clamp(abGeom.pad + (Z-1)*abGeom.bw - cw/2, 10, W - cw - 10);
  ctx.font = '11.5px system-ui';
  const words = nt ? nt.split(' ') : [];
  let lines = [], line = '';
  for(const wd of words){ const t = line ? line+' '+wd : wd;
    if(ctx.measureText(t).width > cw - 24 && line){ lines.push(line); line = wd; } else line = t; }
  if(line) lines.push(line);
  const ch = 72 + lines.length*15, y = abGeom.y0 - ch - 8;
  rrect(ctx, x, y, cw, ch, 10); ctx.fillStyle = 'rgba(13,18,30,.97)'; ctx.fill();
  ctx.strokeStyle = nucColor(Z); ctx.lineWidth = 1.5; ctx.stroke();
  rrect(ctx, x+12, y+11, 34, 34, 7); ctx.fillStyle = nucColor(Z); ctx.fill();
  txt(ctx, ESYM[Z] || Z, x+29, y+28, '800 15px system-ui', '#0b0f18', 'center');
  txt(ctx, name, x+54, y+21, '800 14px system-ui', '#e6ebf5');
  txt(ctx, `element ${Z}`, x+54, y+37, '11px ui-monospace,Menlo', '#8d99b3');
  const cnt = n ? `${n} in this star` : 'not present yet';
  txt(ctx, cnt, x+cw-12, y+21, '700 11.5px system-ui', n ? '#3ddc84' : '#6b7b9c', 'right');
  txt(ctx, 'made by: ' + oname, x+12, y+56, '700 11px system-ui', ocol);
  ctx.font = '11.5px system-ui'; ctx.fillStyle = '#aab6cf'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  lines.forEach((L,i) => ctx.fillText(L, x+12, y+74+i*15));
}
function drawHUD(ctx){
  const narrow = W < 640;
  const lines = [];
  const {c} = abundance();
  const hyd = c[1]||0, hv = Object.keys(c).filter(z => +z >= 30).reduce((a,z) => a + c[z], 0);
  const heaviest = Object.keys(c).length ? Math.max(...Object.keys(c).map(Number)) : 0;
  const free = p.filter(q => q.Z === 0).length;
  lines.push(['Temperature', `${T9() < 0.1 ? T9().toFixed(3) : T9().toFixed(2)} ×10⁹ K`, T9() > 1 ? '#ffa94d' : '#8d99b3']);
  lines.push(['H / free n', `${hyd} / ${free}`, hyd ? '#3ddc84' : '#ff5c5c']);
  let hn = null; for(const q of p) if(q.Z > 0 && (!hn || q.A > hn.A || (q.A === hn.A && q.Z > hn.Z))) hn = q;
  lines.push(['Heaviest', hn ? `${ESYM[hn.Z]||'Z'+hn.Z}-${hn.A}` : '—', heaviest >= 47 ? '#ff7ba8' : heaviest >= 26 ? '#ffa94d' : '#8d99b3']);
  if(!narrow) lines.push(['Beyond iron', `${hv} nuclei`, hv ? '#ffd23f' : '#8d99b3']);
  lines.push(['Fusion events', `${forge.events}`, '#4fb3ff']);
  lines.push(['Energy released', `${forge.released > 9999 ? (forge.released/1000).toFixed(1)+' GeV' : forge.released.toFixed(0)+' MeV'}`, '#ffd23f']);
  if(!narrow) lines.push(['Output right now', `${forge.rate.toFixed(0)} MeV/s`, forge.rate > 20 ? '#3ddc84' : forge.rate > 1 ? '#ffd23f' : '#ff5c5c']);
  if(forge.photo && !narrow) lines.push(['Photodisintegrated', `${forge.photo}`, '#ff5c5c']);
  if(forge.fis && !narrow) lines.push(['Fissioned', `${forge.fis}`, '#ff7ba8']);
  const lh = narrow ? 16 : 19, fs = narrow ? '10px' : '11.5px';
  const bw = Math.min(narrow ? 190 : 318, W - 20), bh = (narrow?16:22) + lines.length*lh;
  rrect(ctx, W - bw - (narrow?8:12), narrow?8:12, bw, bh, 8); ctx.fillStyle = 'rgba(11,15,24,.82)'; ctx.fill();
  ctx.strokeStyle = 'rgba(38,49,74,.9)'; ctx.lineWidth = 1; ctx.stroke();
  lines.forEach(([a,b,col],i) => {
    const y = (narrow?18:30) + i*lh;
    txt(ctx, a, W - bw + (narrow?4:2), y, `${fs} system-ui`, '#8d99b3');
    txt(ctx, String(b), W - (narrow?12:22), y, `700 ${fs} ui-monospace,Menlo,monospace`, col, 'right');
  });
  const y = H - 200;
  if(R.diproton) txt(ctx, '💥 bound diproton: hydrogen burns with nothing to slow it down', 14, y, '700 12px system-ui', '#ff5c5c');
  else if(forge.rate < 1 && forge.events > 25) txt(ctx, W < 640 ? '⛔ the iron wall: fusing past iron costs energy' : '⛔ the iron wall: fusing anything heavier costs energy instead of releasing it', 14, y, '700 12px system-ui', '#ffa94d');
}
function draw(now){
  const f = fit(cv); if(!f) return; const {ctx} = f; W = f.W; H = f.H;
  ctx.clearRect(0,0,W,H);
  ctx.save(); ctx.scale(SC(), SC()); drawForge(ctx, now); ctx.restore();
  drawAbundance(ctx);
  drawHUD(ctx);
}

/* ---- setups ---- */
function clear(){ p = [];
  forge.released = 0; forge.rate = 0; forge.events = 0; forge.photo = 0; forge.fis = 0; forge.sn = 0; forge.log = []; forge.nacc = 0; forge.hacc = 0; flash = null; }
const SETUPS = [
  {n:'Sun core (hydrogen)', f:() => { clear(); for(let i=0;i<120;i++) nuc(1,1, rnd2(1,worldW()-1), rnd2(1,worldH()-1), 5);
    T = 0.42; forge.feed = 0.35; forge.fz = 1; forge.fa = 1; forge.neutrons = false; note('A young star: pure hydrogen.'); }},
  {n:'Red giant (helium)', f:() => { clear(); for(let i=0;i<95;i++) nuc(2,4, rnd2(1,worldW()-1), rnd2(1,worldH()-1), 4);
    T = 0.95; forge.feed = 0.30; forge.fz = 2; forge.fa = 4; forge.neutrons = false; note('Helium burning: three alphas make carbon.'); }},
  {n:'Massive core (C + O)', f:() => { clear(); for(let i=0;i<95;i++) nuc(Math.random()<0.5?6:8, Math.random()<0.5?12:16, rnd2(1,worldW()-1), rnd2(1,worldH()-1), 4);
    T = 1.78; forge.feed = 0.28; forge.fz = 2; forge.fa = 4; forge.neutrons = false; note('Alpha capture climbing toward iron.'); }},
  {n:'AGB star (s-process)', f:() => { clear(); for(let i=0;i<34;i++) nuc(26,56, rnd2(1,worldW()-1), rnd2(1,worldH()-1), 3);
    for(let i=0;i<24;i++) nuc(2,4, rnd2(1,worldW()-1), rnd2(1,worldH()-1), 4);
    T = 0.70; forge.feed = 0; forge.fz = 2; forge.fa = 4; forge.neutrons = true; note('Slow neutron capture on iron seeds: the s-process.'); }},
  {n:'Pre-supernova', f:() => { clear(); for(let i=0;i<6;i++) nuc(26,56, rnd2(1,worldW()-1), rnd2(1,worldH()-1), 3);
    for(let i=0;i<4;i++) nuc(14,28, rnd2(1,worldW()-1), rnd2(1,worldH()-1), 4);
    T = 1.6; forge.feed = 0; forge.fz = 2; forge.fa = 4; forge.neutrons = false; note('An iron core. Press Supernova to collapse it.'); }}
];

/* ---- UI ---- */
let setupOn = 0;
function syncT(){ $('fTemp').value = T; const t = T9(); $('fTempV').textContent = (t < 0.1 ? t.toFixed(3) : t.toFixed(2)) + ' ×10⁹ K'; }
function syncUI(){
  $('fFeed').value = forge.feed;
  $('fFuelName').textContent = forge.fz === 1 ? 'Hydrogen' : 'Helium';
  $('fNeut').textContent = 'Neutron source: ' + (forge.neutrons ? 'on' : 'off');
  $('fNeut').classList.toggle('on', forge.neutrons);
  $('fNeut').setAttribute('aria-pressed', String(forge.neutrons));
  $('fSetups').querySelectorAll('button').forEach((b,i) => { b.classList.toggle('on', i === setupOn); b.setAttribute('aria-pressed', String(i === setupOn)); });
  syncT();
}
$('fSetups').innerHTML = SETUPS.map((s,i) => `<button type="button" data-s="${i}">${s.n}</button>`).join('');
$('fSetups').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { setupOn = +b.dataset.s; SETUPS[setupOn].f(); syncUI(); });
$('fTemp').oninput = e => { T = +e.target.value; syncT(); };
$('fFeed').oninput = e => forge.feed = +e.target.value;
$('fNeut').onclick = () => { forge.neutrons = !forge.neutrons; note(forge.neutrons ? 'Neutron source on: slow capture begins.' : 'Neutron source off.'); syncUI(); };
$('fAddN').onclick = () => { for(let i=0;i<14;i++) nuc(0,1, rnd2(1,worldW()-1), rnd2(1,worldH()-1), 8); };
$('fSN').onclick = supernova;
$('fRun').onclick = () => { run = !run; $('fRun').textContent = run ? 'Pause' : 'Run'; };
$('fClear').onclick = () => clear();

function pick(e){
  const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  if(!abGeom || my < abGeom.y0 + 24 || my > abGeom.base + 16 || mx < abGeom.pad || mx > abGeom.pad + abGeom.w){ hoverZ = 0; cv.style.cursor = 'default'; return; }
  const Z = Math.floor((mx - abGeom.pad)/abGeom.bw) + 1;
  hoverZ = (Z >= 1 && Z <= abGeom.Zmax) ? Z : 0;
  cv.style.cursor = hoverZ ? 'pointer' : 'default';
}
cv.addEventListener('pointermove', pick);
cv.addEventListener('pointerdown', pick);
cv.addEventListener('pointerleave', e => { if(e.pointerType === 'mouse'){ hoverZ = 0; cv.style.cursor = 'default'; } });

/* ---- loop: runs only while the forge is on screen ---- */
function start(){
  if(started) return; started = true;
  const f = fit(cv); if(f){ W = f.W; H = f.H; }
  SETUPS[0].f(); syncUI();
}
let t0 = performance.now(), tPrev = t0;
function loop(nowMs){
  const now = (nowMs - t0)/1000, dt = Math.min(0.05, (nowMs - tPrev)/1000); tPrev = nowMs;
  if(visible){
    clock = now;
    const f0 = fit(cv);
    if(f0 && (f0.W !== W || f0.H !== H)){
      const ow = W/SC(), oh = (H-panelH())/SC();
      W = f0.W; H = f0.H;
      if(p.length && ow > 0){
        const dx = (worldW() - ow)/2, dy = (worldH() - oh)/2;
        for(const q of p){ q.x = clamp(q.x + dx, 0.5, worldW()-0.5); q.y = clamp(q.y + dy, 0.5, worldH()-0.5); }
      }
    }
    if(run && p.length){
      acc += dt;
      const h = 0.003; let n = 0;
      while(acc > h && n++ < 14){ acc -= h; stepForge(h*3); }
      acc = Math.min(acc, h);
      reactForge(dt);
    }
    draw(now);
  }
  requestAnimationFrame(loop);
}
new IntersectionObserver(es => {
  for(const e of es){
    visible = e.isIntersecting;
    if(visible){ start(); tPrev = performance.now(); }
  }
}, {threshold:0.02}).observe(cv);
syncT();
requestAnimationFrame(loop);
window.forgeDbg = () => ({n:p.length, forge, T9:T9(), stage:stageName()[0], ab:abundance()});
window.forgeSN = supernova;
})();
