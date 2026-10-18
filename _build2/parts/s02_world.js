/* ============================================================
   PART 02: WORLD - San Andreas heightfield, road data, terrain,
   water, biome colours, minimap bake, chunked build pipeline.
   Island (r<1500) heights are bit-identical to the original.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
/* NOTE: clamp/lerp/smooth/rnd/fbm live in the shared global lexical scope of
   the base script (top-level const), so they are referenced directly. */
const smoothstep = smooth;

/* ---------- build queue (all heavy world parts register here) ---------- */
SA.BQ = SA.BQ || [];
SA.addBuild = (label, fn) => SA.BQ.push({label, fn});
SA.runBuild = function(done){
  const q = SA.BQ.slice(); let i = 0;
  function step(){
    if(i >= q.length){ SA.prog(false); if(done) done(); return; }
    const it = q[i];
    SA.prog('Building '+it.label+' ... '+(i+1)+'/'+q.length, (i)/(q.length+0.001));
    setTimeout(()=>{
      try{ it.fn() }catch(e){ console.error('[SA build]', it.label, e); }
      i++; SA.prog(null,(i)/(q.length||1));
      step();
    }, 12);
  }
  step();
};

/* ============================================================
   1. TERRAIN FUNCTION
   ============================================================ */
const fbm = window.fbm;
function baseIsland(x,z){                       /* exact copy of original */
  let d=Math.hypot(x,z);
  if(d>820)d+=(fbm(x*.0016+31.7,z*.0016+11.3,2)-.5)*150;
  if(d<780)return 0;
  const n=fbm(x*.0045+13.7,z*.0045+7.3,4),n2=fbm(x*.017,z*.017,3);
  let h=smoothstep((d-780)/150)*(9+n*26);
  h+=smoothstep((d-930)/270)*(n*105+n2*22)*(.3+.7*smoothstep((d-780)/150));
  const t3=smoothstep((d-1200)/240);
  return h*(1-t3)+(-27)*t3;
}

/* land ellipses (cx,cz,rx,rz) - smooth union; carves subtract */
const LAND = [
  {cx:0,    cz:-2450, rx:2850, rz:850 },     /* main continent */
  {cx:-2820,cz:-1680, rx:620,  rz:560 },     /* San Fierro peninsula */
  {cx:-1950,cz:-2050, rx:560,  rz:520 },     /* Flint join */
  {cx:-950, cz:-3050, rx:820,  rz:540 },     /* Tierra Robada */
  {cx:1850, cz:-2600, rx:640,  rz:560 },     /* NE desert */
];
const CARVE = [
  {cx:-2300,cz:-1520, rx:330, rz:420 },      /* SF bay inlet */
  {cx:-2100,cz:-2150, rx:190, rz:150 },      /* Flint lake */
  {cx:-640, cz:-1830, rx:100, rz:85  },      /* Red County pond */
  {cx:-3300,cz:-2380, rx:260, rz:300 },      /* sea west of SF tip */
];
function ellipseM(e,x,z){
  const dx=(x-e.cx)/e.rx, dz=(z-e.cz)/e.rz;
  const t=1-Math.sqrt(dx*dx+dz*dz);
  return smoothstep(clamp(t/0.15,0,1));
}
function mainlandMask(x,z){
  let m=0;
  for(let i=0;i<LAND.length;i++){const v=ellipseM(LAND[i],x,z); if(v>m)m=v;}
  for(let i=0;i<CARVE.length;i++){const v=ellipseM(CARVE[i],x,z); if(v>0)m=Math.min(m,1-v*1.25);}
  return clamp(m,0,1);
}
function mesaField(x,z){ return smoothstep((fbm(x*.0036+8.1,z*.0036+3.3,2)-.52)/.12); }
function mainlandH(x,z){
  let h=(fbm(x*.0021+5.3,z*.0021+9.1,4)-.42)*95;
  h+=(fbm(x*.0009+2.2,z*.0009+4.4,2)-.5)*66;
  /* region weights */
  const flint  = smoothstep(1-clamp(Math.hypot(x+1900,z+2250)/1100,0,1));          /* forest hills */
  const rcb    = smoothstep(1-clamp(Math.hypot(x-(-350),z+1800)/820,0,1));        /* red county gentle */
  const robada = smoothstep(1-clamp(Math.hypot(x+1000,z+3150)/700,0,1));          /* canyon desert */
  const bone   = smoothstep(1-clamp(Math.hypot(x-1100,z+2550)/1050,0,1));         /* bone county desert */
  /* region elevation targets: keep land above water with regional character */
  if(flint>.02){
    const ft=18+Math.abs(fbm(x*.006+1.7,z*.006+2.9,3)-.5)*120;
    h=lerp(h,ft,flint*.85);
  }
  if(rcb>.02)   h=lerp(h,   12+(fbm(x*.004+3.1,z*.004+8.8,3)-.42)*34, rcb*.7);
  if(robada>.02)h=lerp(h,   24+(fbm(x*.005+6.6,z*.005+1.2,2)-.5)*26, robada*.8);
  if(bone>.02)  h=lerp(h,   30+(fbm(x*.0045+4.2,z*.0045+6.1,3)-.5)*44, bone*.72);
  /* extra flint ridges */
  h+=Math.abs(fbm(x*.006+1.7,z*.006+2.9,3)-.5)*2*55*flint;
  /* canyon carving (robada) */
  const cn=Math.abs(fbm(x*.0032+4.3,z*.0032+7.7,3)-.5)*2;
  h-=smoothstep(1-clamp(cn*2.6,0,1))*34*robada;
  /* desert mesa terraces */
  const mesa=mesaField(x,z)*Math.max(bone,robada*.6);
  h=h*(1-mesa*.55)+mesa*(Math.round(h/14)*14+6);
  /* Mount Chiliad dome */
  const cdx=x+1750,cdz=z+2950,cd=Math.hypot(cdx,cdz);
  if(cd<680){
    const dome=382*Math.exp(-(cd*cd)/(2*340*340));
    const rocky=fbm(x*.012+9.1,z*.012+3.3,3)*22*(1-clamp(cd/680,0,1));
    h=Math.max(h,dome-26+rocky*(dome/382));
  }
  /* coastal smoothing + mainland base level */
  return h*.92+8;
}
function padWeight(p,x,z){
  const dx=Math.max(p.x0-x, x-p.x1, 0), dz=Math.max(p.z0-z, z-p.z1, 0);
  const d=Math.hypot(dx,dz);
  return 1-smoothstep(clamp(d/(p.edge||70),0,1));
}
function applyPads(x,z,h){
  let ws=0,wy=0;
  for(let i=0;i<SA.pads.length;i++){
    const p=SA.pads[i]; if(x<p.x0-p.edge||x>p.x1+p.edge||z<p.z0-p.edge||z>p.z1+p.edge)continue;
    const w=padWeight(p,x,z); if(w<=0)continue;
    ws+=w; wy+=w*p.y;
  }
  if(ws<=0)return h;
  const w=Math.min(1,ws);
  return lerp(h, wy/Math.max(ws,1e-6), w);
}
/* corridor flattening: spatial hash of road segments */
SA.corrGrid = new Map();
const CGRID=220;
function corrKey(k,l){return k+':'+l}
function corrAdd(sx1,sz1,sx2,sz2,y1,y2,w){
  const seg={x1:sx1,z1:sz1,x2:sx2,z2:sz2,y1,y2,w:Math.max(w,3)};
  const k0=Math.floor(Math.min(sx1,sx2)/CGRID),k1=Math.floor(Math.max(sx1,sx2)/CGRID);
  const l0=Math.floor(Math.min(sz1,sz2)/CGRID),l1=Math.floor(Math.max(sz1,sz2)/CGRID);
  for(let k=k0;k<=k1;k++)for(let l=l0;l<=l1;l++){
    const key=corrKey(k,l); let a=SA.corrGrid.get(key); if(!a){a=[];SA.corrGrid.set(key,a)} a.push(seg);
  }
}
function applyCorr(x,z,h){
  const key=corrKey(Math.floor(x/CGRID),Math.floor(z/CGRID));
  const a=SA.corrGrid.get(key); if(!a)return h;
  for(let i=0;i<a.length;i++){
    const s=a[i];
    const dx=s.x2-s.x1,dz=s.z2-s.z1,L2=dx*dx+dz*dz||1;
    let t=((x-s.x1)*dx+(z-s.z1)*dz)/L2; t=clamp(t,0,1);
    const px=s.x1+dx*t,pz=s.z1+dz*t;
    const d=Math.hypot(x-px,z-pz);
    const inner=s.w*.5, outer=inner+11;
    if(d>=outer)continue;
    const k=smoothstep(1-(d-inner)/(outer-inner));
    h=lerp(h, lerp(s.y1,s.y2,t), k);
  }
  return h;
}
function saTerrain(x,z){
  const r2=x*x+z*z;
  if(r2<1380*1380){
    /* island fast path - identical to original except small pads */
    let h=baseIsland(x,z);
    if(SA._padNearIsland) h=applyPads(x,z,h);
    return h;
  }
  let h;
  if(z<-1440 && x>-3300 && x<2700) h=-27;   /* pure mainland zone: skip base */
  else h=baseIsland(x,z);
  const m=mainlandMask(x,z);
  if(m>0.002){
    const mh=mainlandH(x,z);
    h=lerp(h,lerp(-30,mh,smoothstep(clamp(m*1.35,0,1))),m);
  }
  h=applyPads(x,z,h);
  h=applyCorr(x,z,h);
  return h;
}
SA.terrainH = saTerrain;
SA.groundY = (x,z)=>saTerrain(x,z);
SA.inWater = (x,z)=>saTerrain(x,z) < SA.WATER_Y-.35;
SA.waterDepth = function(x,z){ return SA.WATER_Y - saTerrain(x,z); };
window.terrainH = saTerrain;   /* island values identical; nothing base-side uses it at runtime anyway */

/* ============================================================
   2. PADS  (city platforms; flat areas for streets & buildings)
   ============================================================ */
function pad(x0,x1,z0,z1,y,edge,name){ SA.pads.push({x0,x1,z0,z1,y,edge:edge||70,name:name||''}); }
SA.addPad = pad;
/* San Fierro */
pad(-3400,-2980,-1560,-1180,  8, 90,'Doherty');
pad(-2980,-2560,-1560,-1180, 34, 90,'Calton');
pad(-2980,-2560,-1960,-1560, 58, 90,'Downtown SF');
pad(-3400,-2980,-1960,-1560, 26, 90,'Juniper');
pad(-2980,-2560,-2180,-1960, 22, 80,'Chinatown');
pad(-2760,-2560,-2180,-1960, 70, 80,'Peak Park');
/* Las Venturas */
pad( 950,2150,-2450,-1550, 12,100,'Las Venturas');
/* LS International Airport (mainland, north of the city) */
pad(-180, 300,-1150,-760,   6, 90,'LS Airport');
/* Verdant Meadows airstrip */
pad( 100, 560,-2950,-2620, 24, 80,'Verdant Meadows');
/* Area 69 */
pad( 980,1380,-2780,-2430, 40, 70,'Area 69');
/* Big Ear */
pad( 330, 610,-2450,-2250, 30, 60,'Big Ear');
/* towns */
pad(-500,-160,-1880,-1620, 16, 70,'Blueberry');
pad( 250, 500,-2030,-1790, 18, 70,'Dillimore');
pad( 600, 960,-1920,-1600, 20, 70,'Palomino Creek');
pad( 520, 760,-1760,-1580, 14, 60,'Trailer Park');
pad(-560,-360,-720,-600,    0, 50,'Grove Street');
pad(-170,  90,-1450,-1290,  3, 95,'Bridge Coast');

/* ============================================================
   3. ROAD NETWORK DATA
   ============================================================ */
/* kind: hwy | street | dirt | bridge ; drape: follow terrain (no corridor) */
function road(name,kind,w,pts,opt){
  const r=Object.assign({name,kind,w,pts,ys:[],drape:false,bridge:false},opt||{});
  SA.roads.push(r); return r;
}
/* --- Julius Thruway: LS -> mainland --- */
road('Julius Hill Pass','hwy',13,[[-40,-480],[-52,-560],[-64,-650],[-58,-760],[-44,-870],[-52,-980],[-66,-1080],[-50,-1190],[-40,-1280],[-40,-1345]],{drape:true});
road('Julius Thruway','bridge',12,[[-40,-1345],[-42,-1680]],{bridge:true,deckY:[4,8.5]});
road('Thruway North','hwy',13,[[-42,-1680],[-50,-1770],[-56,-1850]]);
/* --- Red County junction & routes --- */
/* Route 1: east to Las Venturas */
road('Country Route 1','hwy',13,[[-56,-1800],[120,-1850],[300,-1890],[430,-1930],[620,-2010],[800,-2110],[950,-2240],[1040,-2400],[1010,-2450]]);
road('LV West Approach','hwy',13,[[1010,-2450],[1050,-2350],[1100,-2250],[1140,-2150],[1180,-2050],[1210,-1955],[1240,-1900]]);
/* Route 2: west to San Fierro */
road('Country Route 2','hwy',13,[[-56,-1800],[-190,-1860],[-340,-1940],[-520,-2020],[-740,-2120],[-960,-2230],[-1200,-2310],[-1440,-2380],[-1680,-2440],[-1900,-2420],[-2120,-2360],[-2330,-2300],[-2520,-2280],[-2680,-2210],[-2760,-2140],[-2790,-2060],[-2800,-1980],[-2800,-1900]]);
road('SF Approach Street','street',9,[[-2800,-1900],[-2800,-1830],[-2790,-1760],[-2780,-1690]]);
/* Gant Bridge: SF north -> mainland */
road('Gant Bridge','bridge',12,[[-2820,-2140],[-2600,-2320],[-2480,-2400]],{bridge:true,deckY:[9,14]});
/* Route 3: LV -> Verdant Meadows */
road('Desert Route 3','hwy',12,[[1000,-1560],[900,-1620],[780,-1670],[640,-1700],[520,-1850],[470,-2050],[440,-2250],[430,-2420],[420,-2560],[360,-2600]]);
/* Route 4: Verdant -> Big Ear -> Area 69 -> LV north */
road('Desert Route 4','dirt',9,[[420,-2560],[470,-2450],[540,-2380],[620,-2320],[700,-2380],[790,-2470],[900,-2560],[980,-2600],[1120,-2610],[1280,-2570],[1450,-2500],[1620,-2470],[1740,-2420],[1820,-2330],[1870,-2200],[1890,-2080],[1880,-1960],[1850,-1900]]);
/* Chiliad trail (dirt, draped) */
road('Chiliad Trail','dirt',7,[[-1680,-2440],[-1620,-2540],[-1560,-2660],[-1600,-2800],[-1700,-2900],[-1790,-2940],[-1860,-2920],[-1900,-2850]],{drape:true});
/* SF grid streets (flat pads) */
(function(){
  const xs=[-3360,-3250,-3140,-3030,-2920,-2810,-2700,-2590];
  for(const x of xs) road('SF St x'+x,'street',8,[[x,-1185],[x,-1720],[x,-2160]]);
  const zs=[-1240,-1340,-1440,-1540,-1650,-1770,-1890,-2010,-2120];
  for(const z of zs) road('SF St z'+z,'street',8,[[-3390,z],[-2640,z]]);
})();
/* LV grid streets */
(function(){
  const xs=[990,1120,1250,1380,1510,1640,1790,1930,2070];
  for(const x of xs) road('LV St x'+x,'street',9,[[x,-2440],[x,-1560]]);
  const zs=[-2410,-2280,-2150,-2020,-1890,-1760,-1630];
  for(const z of zs) road('LV St z'+z,'street',9,[[960,z],[2140,z]]);
})();
/* town streets */
road('Blueberry Main','street',8,[[-480,-1750],[-180,-1750]]);
road('Blueberry Side','street',7,[[-330,-1660],[-330,-2060]]);
road('Dillimore Main','street',8,[[260,-1910],[490,-1910]]);
road('Dillimore Side','street',7,[[380,-1820],[380,-2260]]);
road('Palomino Main','street',8,[[620,-1760],[940,-1760]]);
road('Palomino Side','street',7,[[780,-1630],[780,-2000]]);
road('Trailer Lane','dirt',5,[[500,-1650],[700,-1620],[790,-1690]],{drape:true});
road('Grove Lane','street',6,[[-540,-660],[-380,-660]],{drape:false});
/* airport taxiways + runway (flat pad) */
road('LS Runway','street',36,[[-160,-950],[280,-950]]);
road('LS Taxiway','street',10,[[-140,-880],[260,-880]]);
road('VM Runway','street',30,[[130,-2800],[530,-2800]]);
road('VM Taxiway','street',8,[[150,-2740],[480,-2740]]);
/* area69 service road */
road('A69 Access','dirt',6,[[1080,-2440],[1080,-2760]],{drape:false});
/* --- compute Y profiles for corridors (after pads exist) --- */
function rawH(x,z){ /* terrain without corridor influence */
  const r2=x*x+z*z;
  if(r2<1380*1380) return applyPads(x,z,baseIsland(x,z));
  let h;
  if(z<-1440 && x>-3300 && x<2700) h=-27; else h=baseIsland(x,z);
  const m=mainlandMask(x,z);
  if(m>0.002) h=lerp(h,lerp(-30,mainlandH(x,z),smoothstep(clamp(m*1.35,0,1))),m);
  return applyPads(x,z,h);
}
SA.rawH = rawH;
(function computeYs(){
  const R=SA.roads;
  const lock=new Map();
  for(const r of R){
    if(r.bridge){ r.ys=[]; continue; }
    r.ys=r.pts.map(p=>rawH(p[0],p[1]));
    const n=r.pts.length;
    for(let it=0;it<3;it++){ const c=r.ys.slice(); for(let i=1;i<n-1;i++) r.ys[i]=(c[i-1]+c[i]*2+c[i+1])/4; }
    lock.set(r,new Set());
  }
  /* --- junction pass: insert shared nodes so crossing roads agree on height --- */
  function segInt(a1,a2,b1,b2){
    const d1x=a2[0]-a1[0],d1z=a2[1]-a1[1],d2x=b2[0]-b1[0],d2z=b2[1]-b1[1];
    const den=d1x*d2z-d1z*d2x; if(Math.abs(den)<1e-9) return null;
    const t=((b1[0]-a1[0])*d2z-(b1[1]-a1[1])*d2x)/den;
    const u=((b1[0]-a1[0])*d1z-(b1[1]-a1[1])*d1x)/den;
    if(t<0||t>1||u<0||u>1) return null;
    return [t,u];
  }
  const byRoad=new Map();
  for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++){
    const a=R[i],b=R[j];
    if(a.bridge||b.bridge||a.drape||b.drape) continue;
    let ax0=Infinity,ax1=-Infinity,az0=Infinity,az1=-Infinity;
    for(const p of a.pts){ if(p[0]<ax0)ax0=p[0]; if(p[0]>ax1)ax1=p[0]; if(p[1]<az0)az0=p[1]; if(p[1]>az1)az1=p[1]; }
    let bx0=Infinity,bx1=-Infinity,bz0=Infinity,bz1=-Infinity;
    for(const p of b.pts){ if(p[0]<bx0)bx0=p[0]; if(p[0]>bx1)bx1=p[0]; if(p[1]<bz0)bz0=p[1]; if(p[1]>bz1)bz1=p[1]; }
    if(ax1<bx0-26||bx1<ax0-26||az1<bz0-26||bz1<az0-26) continue;
    for(let ai=0;ai<a.pts.length-1;ai++)for(let bi=0;bi<b.pts.length-1;bi++){
      const hit=segInt(a.pts[ai],a.pts[ai+1],b.pts[bi],b.pts[bi+1]);
      if(!hit) continue;
      const ya=a.ys[ai]+(a.ys[ai+1]-a.ys[ai])*hit[0];
      const yb=b.ys[bi]+(b.ys[bi+1]-b.ys[bi])*hit[1];
      const yj=(ya+yb)/2;
      const ha={seg:ai,t:hit[0],y:yj,x:a.pts[ai][0]+(a.pts[ai+1][0]-a.pts[ai][0])*hit[0],z:a.pts[ai][1]+(a.pts[ai+1][1]-a.pts[ai][1])*hit[0]};
      const hb={seg:bi,t:hit[1],y:yj,x:b.pts[bi][0]+(b.pts[bi+1][0]-b.pts[bi][0])*hit[1],z:b.pts[bi][1]+(b.pts[bi+1][1]-b.pts[bi][1])*hit[1]};
      if(!byRoad.has(a)) byRoad.set(a,[]);
      if(!byRoad.has(b)) byRoad.set(b,[]);
      byRoad.get(a).push(ha); byRoad.get(b).push(hb);
    }
  }
  for(const [r,arr] of byRoad){
    arr.sort((p,q)=> q.seg-p.seg || q.t-p.t);
    for(const h of arr){
      const si=h.seg;
      /* skip if the junction node already exists */
      if(Math.hypot(h.x-r.pts[si][0],h.z-r.pts[si][1])<2.2) { r.ys[si]=h.y; lock.get(r).add(si); continue; }
      if(Math.hypot(h.x-r.pts[si+1][0],h.z-r.pts[si+1][1])<2.2) { r.ys[si+1]=h.y; lock.get(r).add(si+1); continue; }
      r.pts.splice(si+1,0,[h.x,h.z]);
      r.ys.splice(si+1,0,h.y);
      lock.get(r).add(si+1);
    }
    const n=r.pts.length, L=lock.get(r);
    for(let it=0;it<2;it++){
      const c=r.ys.slice();
      for(let i=1;i<n-1;i++){ if(L.has(i)) continue; r.ys[i]=(c[i-1]+c[i]*2+c[i+1])/4; }
    }
  }
  /* register corridors */
  for(const r of R){
    if(r.bridge||r.drape) continue;
    for(let i=0;i<r.pts.length-1;i++) corrAdd(r.pts[i][0],r.pts[i][1],r.pts[i+1][0],r.pts[i+1][1],r.ys[i],r.ys[i+1],r.w);
  }
  /* bridges get explicit straight deck profiles */
  for(const r of R){
    if(!r.bridge) continue;
    const n=r.pts.length, y0=(r.deckY&&r.deckY[0])||8, y1=(r.deckY&&r.deckY[1])||y0;
    r.ys=r.pts.map((p,i)=>lerp(y0,y1,i/(n-1)));
  }
})();
SA._padNearIsland = true;

/* ============================================================
   4. TERRAIN MESH REBUILD (7200 x 7200)
   ============================================================ */
const T_SIZE=7200, T_SEG=340, T_HALF=3600;
function biomeColor(x,z,h,out){
  const r2=x*x+z*z;
  const sl=Math.min(1,(Math.abs(saTerrain(x+14,z)-h)+Math.abs(saTerrain(x,z+14)-h))/15);
  let r,g,b;
  if(r2<1400*1400){
    /* original island colouring */
    if(h<-3){r=.16;g=.27;b=.33}
    else if(h<1.6){r=.78;g=.71;b=.5}
    else{
      const t=clamp((h-26)/95,0,1);
      r=lerp(.22,.44,t);g=lerp(.42,.42,t);b=lerp(.19,.37,t);
      if(h>112){const s2=clamp((h-112)/45,0,1);r=lerp(r,.75,s2);g=lerp(g,.75,s2);b=lerp(b,.73,s2)}
    }
    if(h>=1.6&&h<6){const t=(h-1.6)/4.4;r=lerp(.78,.22,t);g=lerp(.71,.42,t);b=lerp(.5,.19,t)}
    if(h>3&&sl>.22){const t=clamp((sl-.22)/.5,0,1);r=lerp(r,.46,t);g=lerp(g,.44,t);b=lerp(b,.4,t)}
  }else{
    const m=mainlandMask(x,z);
    const desert=smoothstep(1-clamp(Math.hypot(x-1100,z+2550)/1220,0,1))*1.15
                +smoothstep(1-clamp(Math.hypot(x+1000,z+3150)/820,0,1))*1.0;
    const forest=smoothstep(1-clamp(Math.hypot(x+1850,z+2300)/1000,0,1));
    if(h<SA.WATER_Y-0.4){                 /* sea floor */
      const dp=clamp((SA.WATER_Y-h)/26,0,1);
      r=lerp(.34,.10,dp);g=lerp(.47,.16,dp);b=lerp(.52,.24,dp);
    }else if(h<1.6){                      /* beach */
      r=.82;g=.75;b=.55;
    }else{
      if(desert>0.35){
        const t=clamp(desert,0,1);
        r=lerp(.30,.74,t);g=lerp(.42,.64,t);b=lerp(.22,.42,t);
      }else{
        const t=clamp(h/180,0,1);
        r=lerp(.22,.38,t);g=lerp(.44,.42,t);b=lerp(.18,.3,t);
        r=lerp(r,.19,forest*.55);g=lerp(g,.36,forest*.55);b=lerp(b,.16,forest*.55);
      }
    }
    if(h>2&&sl>.30){const t=clamp((sl-.30)/.5,0,1);r=lerp(r,.44,t);g=lerp(g,.41,t);b=lerp(b,.37,t)}
    if(h>200){const t=clamp((h-200)/160,0,1);r=lerp(r,.5,t);g=lerp(g,.46,t);b=lerp(b,.43,t)}
    /* pads: urban grey / concrete */
    let pw=0,py=0;
    for(let i=0;i<SA.pads.length;i++){
      const p=SA.pads[i];
      if(x<p.x0-p.edge||x>p.x1+p.edge||z<p.z0-p.edge||z>p.z1+p.edge)continue;
      const w=padWeight(p,x,z); if(w<=0)continue; pw+=w; py+=w*p.y;
    }
    if(pw>0.5){
      const urban=(x>950&&x<2150&&z>-2450&&z<-1550)||(x<-2560&&z>-2180&&z<-1180);
      let cityPad=urban;
      for(let i=0;i<SA.pads.length;i++){
        const p=SA.pads[i];
        if(x<p.x0||x>p.x1||z<p.z0||z>p.z1)continue;
        const nm=p.name||'';
        if(nm==='LS Airport'||nm==='Verdant Meadows'||nm==='Area 69'||nm==='Big Ear') cityPad=true;
      }
      let k=clamp((pw-0.5)/0.5,0,1);
      if(!cityPad) k*=0.55;
      r=lerp(r,.41,k);g=lerp(g,.40,k);b=lerp(b,.42,k);
    }
  }
  const nv=(fbm(x*.05,z*.05,2)-.5)*.13;r+=nv;g+=nv;b+=nv;
  out[0]=clamp(r,0,1);out[1]=clamp(g,0,1);out[2]=clamp(b,0,1);
}
SA.biomeColor=biomeColor;
SA.addBuild('terrain', ()=>{
  const geo=new THREE.PlaneGeometry(T_SIZE,T_SIZE,T_SEG,T_SEG);
  geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position, n=pos.count;
  const cols=new Float32Array(n*3);
  const tmp=[0,0,0];
  for(let i=0;i<n;i++){
    const x=pos.getX(i),z=pos.getZ(i);
    const h=saTerrain(x,z);
    pos.setY(i,h);
    biomeColor(x,z,h,tmp);
    cols[i*3]=tmp[0];cols[i*3+1]=tmp[1];cols[i*3+2]=tmp[2];
  }
  geo.setAttribute('color',new THREE.BufferAttribute(cols,3));
  geo.computeVertexNormals();
  scene.remove(terrain);
  terrain.geometry.dispose();
  const mat=terrain.material;
  scene.add(terrain);                       /* reuse original mesh obj + material */
  terrain.geometry=geo;
  terrain.frustumCulled=false;
  /* water + sky horizons */
  water.geometry.dispose();
  water.geometry=new THREE.PlaneGeometry(13000,13000).rotateX(-Math.PI/2);
  water.frustumCulled=false;
  waterNrm.repeat.set(360,360);
  camera.far=6400;camera.updateProjectionMatrix();
  skyDome.geometry.dispose();
  skyDome.geometry=new THREE.SphereGeometry(5200,32,16);
});

/* ---------- coast foam ---------- */
SA.addBuild('coast foam', ()=>{
  const items=[];
  for(let x=-3350;x<2750;x+=36){
    for(let z=-3450;z<-1350;z+=36){
      if(Math.abs(x)<60&&Math.abs(z+1450)<400) continue;
      const h=saTerrain(x,z);
      if(h>-2.95&&h<-1.5){
        items.push([x,SA.WATER_Y+.05,z,rnd(2.0,3.6),1,rnd(2.0,3.6),Math.random()*3]);
      }
    }
  }
  const foamM=new THREE.MeshBasicMaterial({map:softTex,color:0xcfe8f2,transparent:true,opacity:.28,blending:THREE.AdditiveBlending,depthWrite:false});
  SA.coastFoam=inst(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),foamM,items);
});

/* ============================================================
   5. MINIMAP BAKE (512x512 world map texture)
   Called AFTER all cities are built (from s18 boot) so that
   city blocks can be painted on top.
   ============================================================ */
SA.bakeMap = function(){
  const S=512, c=document.createElement('canvas'); c.width=c.height=S;
  const g=c.getContext('2d');
  const img=g.createImageData(S,S), d=img.data;
  const tmp=[0,0,0];
  const scale=T_SIZE/S;
  for(let py=0;py<S;py++){
    const z=-T_HALF+py*scale;
    for(let px=0;px<S;px++){
      const x=-T_HALF+px*scale;
      const h=saTerrain(x,z);
      biomeColor(x,z,h,tmp);
      const i=(py*S+px)*4;
      d[i]=tmp[0]*255;d[i+1]=tmp[1]*255;d[i+2]=tmp[2]*255;d[i+3]=255;
    }
  }
  g.putImageData(img,0,0);
  const W2PX=v=>(v+T_HALF)/T_SIZE*S;
  /* city blocks: original Los Santos from buildingsMap */
  g.fillStyle='#3c4249';
  if(typeof buildingsMap!=='undefined')for(const b of buildingsMap){
    g.fillRect(W2PX(b.x0),W2PX(b.z0),Math.max(1,(b.x1-b.x0)/T_SIZE*S),Math.max(1,(b.z1-b.z0)/T_SIZE*S));
  }
  /* new cities (SF/LV/towns) */
  if(SA.cityBlocks){
    for(const b of SA.cityBlocks){
      g.fillStyle=b.c||'#3c4249';
      g.fillRect(W2PX(b.x0),W2PX(b.z0),Math.max(1,(b.x1-b.x0)/T_SIZE*S),Math.max(1,(b.z1-b.z0)/T_SIZE*S));
    }
  }
  /* LS grid roads */
  g.strokeStyle='#7d838a';g.lineWidth=.8;
  g.beginPath();
  for(const R of ROADS){
    const X=W2PX(R);
    g.moveTo(X,W2PX(-505));g.lineTo(X,W2PX(505));
    g.moveTo(W2PX(-505),W2PX(R));g.lineTo(W2PX(505),W2PX(R));
  }
  g.stroke();
  /* highways + country routes */
  g.strokeStyle='#d8c26a';g.lineWidth=1;
  for(const r of SA.roads){
    if(r.kind==='street')continue;
    g.beginPath();
    for(let i=0;i<r.pts.length;i++){
      const X=W2PX(r.pts[i][0]), Z=W2PX(r.pts[i][1]);
      if(i===0)g.moveTo(X,Z);else g.lineTo(X,Z);
    }
    g.stroke();
  }
  g.strokeStyle='#b9bec4';g.lineWidth=.6;
  g.globalAlpha=.55;
  for(const r of SA.roads){
    if(r.kind!=='street'||r.w<8)continue;
    g.beginPath();
    for(let i=0;i<r.pts.length;i++){
      const X=W2PX(r.pts[i][0]), Z=W2PX(r.pts[i][1]);
      if(i===0)g.moveTo(X,Z);else g.lineTo(X,Z);
    }
    g.stroke();
  }
  g.globalAlpha=1;
  SA.mapCanvas=c;
  console.log('[SA] map baked');
};
})();
