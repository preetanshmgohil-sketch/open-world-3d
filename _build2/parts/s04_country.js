/* ============================================================
   PART 04: COUNTRYSIDE (Red County towns, farms, forests,
   Mount Chiliad + cable car, Area 69, Big Ear, Verdant
   Meadows, desert props) + shared instance-bucket system +
   the interact-spot system used by all later parts.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;

/* ============================================================
   instance bucket system (shared by all city parts)
   ============================================================ */
SA.ib = {};
SA.ibGeo = {
  box: new THREE.BoxGeometry(1,1,1),
  roof: new THREE.ConeGeometry(.7071,1,4).rotateY(Math.PI/4),
  silo: new THREE.CylinderGeometry(1,1,1,10),
  dome: new THREE.SphereGeometry(1,10,6,0,Math.PI*2,0,Math.PI/2),
  cyl: new THREE.CylinderGeometry(1,1,1,8),
  trunk: new THREE.CylinderGeometry(.24,.34,1,6),
  leafA: new THREE.IcosahedronGeometry(1,1),
  cone: new THREE.ConeGeometry(1,1,7),
  rock: new THREE.IcosahedronGeometry(1,0),
  post: new THREE.BoxGeometry(.14,.9,.14),
  rail: new THREE.BoxGeometry(1,.09,.07),
  lampPost: new THREE.CylinderGeometry(.13,.17,1,6),
  drum: new THREE.CylinderGeometry(.55,.55,1,10),
};
SA.ibAdd = function(bucket, x,y,z, sx,sy,sz, ry){
  let b = SA.ib[bucket];
  if(!b){ b = SA.ib[bucket] = { items: [], mat: SA.ibMat(bucket), shadow: false, geoKey: 'box' }; }
  b.items.push([x,y,z, sx===undefined?1:sx, sy===undefined?1:sy, sz===undefined?1:sz, ry||0]);
};
SA.ibShape = function(bucket, geoKey, mat, shadow){
  let b = SA.ib[bucket];
  if(!b) b = SA.ib[bucket] = { items: [], geoKey, mat, shadow: !!shadow };
  else { b.geoKey = geoKey; b.mat = mat; b.shadow = !!shadow; }
};
SA.ibMat = function(key){
  switch(key){
    case 'wallA': return SA.MAT.wallA; case 'wallB': return SA.MAT.wallB;
    case 'wallC': return SA.MAT.wallC; case 'wallD': return SA.MAT.wallD;
    case 'roofA': return SA.MAT.roofA; case 'roofB': return SA.MAT.roofB; case 'roofC': return SA.MAT.roofC;
    default: return SA.MAT.wallA;
  }
};
SA.ibFlush = function(){
  for(const k in SA.ib){
    const b = SA.ib[k];
    if(!b.items.length || b.done) continue;
    inst(SA.ibGeo[b.geoKey || 'box'], b.mat, b.items, b.shadow);
    b.done = true;
  }
};

/* shared materials */
const wallTex = canvasTex(128,128,(g,w,h)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,w,h);
  g.fillStyle='rgba(0,0,0,.06)';
  for(let i=0;i<60;i++)g.fillRect(Math.random()*w,Math.random()*h,3,2);
  g.fillStyle='#31404d';
  for(const [wx,wy] of [[14,18],[52,18],[90,18],[14,52],[52,52],[90,52]]){ g.fillRect(wx,wy,22,26); }
  g.fillStyle='rgba(255,255,255,.25)';
  for(const [wx,wy] of [[14,18],[52,18],[90,18],[14,52],[52,52],[90,52]]){ g.fillRect(wx,wy,22,4); }
  g.fillStyle='#4a3826';g.fillRect(52,88,24,40);
  g.fillStyle='rgba(0,0,0,.5)';g.fillRect(52,88,24,3);
},[1,1]);
SA.MAT = {
  wallA: new THREE.MeshStandardMaterial({map:wallTex, color:0xd8cbb0, roughness:.9}),
  wallB: new THREE.MeshStandardMaterial({map:wallTex, color:0xb9c4c9, roughness:.9}),
  wallC: new THREE.MeshStandardMaterial({map:wallTex, color:0xc9a97e, roughness:.9}),
  wallD: new THREE.MeshStandardMaterial({map:wallTex, color:0x9fb0a4, roughness:.9}),
  roofA: new THREE.MeshStandardMaterial({color:0x7b4a3a, roughness:.85}),
  roofB: new THREE.MeshStandardMaterial({color:0x5d6166, roughness:.85}),
  roofC: new THREE.MeshStandardMaterial({color:0x5f7a54, roughness:.85}),
  barn:  new THREE.MeshStandardMaterial({color:0x9c3b2e, roughness:.9}),
  barnRoof: new THREE.MeshStandardMaterial({color:0x6e6e72, roughness:.85}),
  silo:  new THREE.MeshStandardMaterial({color:0xcfd3d6, roughness:.7, metalness:.15}),
  wood:  new THREE.MeshStandardMaterial({color:0x8a6b48, roughness:1}),
  conc:  new THREE.MeshStandardMaterial({color:0xb5b8ba, roughness:.95}),
  dark:  new THREE.MeshStandardMaterial({color:0x3a3f44, roughness:.8}),
  glassB:new THREE.MeshStandardMaterial({color:0x8fb6c6, roughness:.3, metalness:.3}),
  trunk: new THREE.MeshStandardMaterial({color:0x6d5638, roughness:1}),
  leafA: new THREE.MeshStandardMaterial({color:0x3e7a3a, roughness:1}),
  leafB: new THREE.MeshStandardMaterial({color:0x5f9c46, roughness:1}),
  conif: new THREE.MeshStandardMaterial({color:0x2f5e38, roughness:1}),
  cactus:new THREE.MeshStandardMaterial({color:0x5c8a52, roughness:.95}),
  rock:  new THREE.MeshStandardMaterial({color:0x8d8a82, roughness:1}),
  fence: new THREE.MeshStandardMaterial({color:0x9a8a70, roughness:1}),
  dish:  new THREE.MeshStandardMaterial({color:0xdadde0, roughness:.5, metalness:.2, side:THREE.DoubleSide}),
};
/* register all instance-bucket shapes */
const M_ = SA.MAT;
SA.ibShape('wallA','box',M_.wallA,true);   SA.ibShape('wallB','box',M_.wallB,true);
SA.ibShape('wallC','box',M_.wallC,true);   SA.ibShape('wallD','box',M_.wallD,true);
SA.ibShape('roofA','roof',M_.roofA,true);  SA.ibShape('roofB','roof',M_.roofB,true);  SA.ibShape('roofC','roof',M_.roofC,true);
SA.ibShape('barn','box',M_.barn,true);     SA.ibShape('silo','silo',M_.silo,true);    SA.ibShape('dome','dome',M_.silo,true);
SA.ibShape('conc','box',M_.conc,true);     SA.ibShape('box','box',M_.dark,false);     SA.ibShape('cyl','cyl',M_.dark,false);
SA.ibShape('drum','cyl',M_.conc,false);    SA.ibShape('post','post',M_.fence,false);  SA.ibShape('rail','rail',M_.fence,false);

/* house helper: walls + roof + collider */
let houseSeed = 7;
function rrand(){ houseSeed = (houseSeed*1103515245 + 12345) & 0x7fffffff; return houseSeed/0x7fffffff; }
const WALLS = ['wallA','wallB','wallC','wallD'], ROOFS = ['roofA','roofB','roofC'];
SA.addHouse = function(x,z,w,d,h,ry,opt){
  opt = opt || {};
  const gy = SA.terrainH(x,z);
  const wall = opt.wall || WALLS[(rrand()*4)|0];
  const roof = opt.roof || ROOFS[(rrand()*3)|0];
  const rh = opt.roofH===undefined ? 2.2+Math.min(w,d)*.22 : opt.roofH;
  SA.ibAdd(wall, x, gy+h/2+.02, z, w, h, d, ry);
  if(opt.flat){
    SA.ibAdd('roofB', x, gy+h+.15, z, w*1.06, .3, d*1.06, ry);
  } else {
    SA.ibAdd(roof, x, gy+h+rh/2, z, w*1.18, rh, d*1.18, ry);
  }
  if(opt.chimney) SA.ibAdd('roofB', x+w*.22, gy+h+rh*.7, z+d*.18, .7, 1.7, .7, ry);
  const cs = Math.abs(Math.cos(ry)), sn = Math.abs(Math.sin(ry));
  const ex = (w*cs+d*sn)/2, ez = (w*sn+d*cs)/2;
  addCollider({x0:x-ex, x1:x+ex, z0:z-ez, z1:z+ez, h:h+2, y0:gy});
  return gy;
};

/* fence: posts + rails following terrain */
function fenceLine(x1,z1,x2,z2,step){
  step = step || 7;
  const L = Math.hypot(x2-x1,z2-z1);
  const n = Math.max(1, Math.round(L/step));
  let prev = null;
  for(let i=0;i<=n;i++){
    const t=i/n, x=x1+(x2-x1)*t, z=z1+(z2-z1)*t;
    const y=SA.terrainH(x,z);
    SA.ibAdd('post', x, y+.45, z);
    if(prev){
      const dx=x-prev[0], dz=z-prev[1], dl=Math.hypot(dx,dz);
      const ry=Math.atan2(-dz,dx);
      const ym=(y+prev[2])/2;
      SA.ibAdd('rail', (x+prev[0])/2, ym+.72, (z+prev[1])/2, dl, 1, 1, ry);
      SA.ibAdd('rail', (x+prev[0])/2, ym+.40, (z+prev[1])/2, dl, 1, 1, ry);
    }
    prev=[x,y,z];
  }
  /* fence colliders as segments (skip - too many; use every ~24 units) */
  for(let i=0;i<n;i+=4){
    const xa=x1+(x2-x1)*i/n, za=z1+(z2-z1)*i/n;
    const xb=x1+(x2-x1)*Math.min(i+4,n)/n, zb=z1+(z2-z1)*Math.min(i+4,n)/n;
    const ya=SA.terrainH(xa,za);
    addCollider({x0:Math.min(xa,xb)-.3, x1:Math.max(xa,xb)+.3, z0:Math.min(za,zb)-.3, z1:Math.max(za,zb)+.3, h:1.2, y0:ya});
  }
}
SA.fenceLine = fenceLine;

/* ============================================================
   interact-spot system (E key)
   ============================================================ */
SA.spots = [];
SA.addSpot = function(o){ SA.spots.push(o); return o; };
SA._spot = null;
SA.updateSpots = function(){
  if(SA.ride){ return; }
  const pc = cur();
  let best=null, bd=1e9;
  if(!pc){
    for(let i=0;i<SA.spots.length;i++){
      const s=SA.spots[i];
      if(s.when && !s.when()) continue;
      const d=Math.hypot(player.x-s.x, player.z-s.z);
      if(d<s.r && d<bd){ bd=d; best=s; }
    }
  }
  SA._spot = best;
  const el = SA.hudRefs.acthud;
  if(best){
    el.style.display='block';
    el.textContent = '[E] ' + best.label;
    el.dataset.owner = 'spot';
  } else if(el.dataset.owner === 'spot'){
    el.style.display='none';
  }
};
SA.addUpd(function(){ SA.updateSpots(); });
SA.hooks.key.push(function(code){
  if(code==='KeyE' && SA._spot && !SA.ride){
    try{ SA._spot.fn(SA._spot); }catch(e){ console.error('[SA spot]', e); }
    return true;
  }
  return false;
});

/* ============================================================
   BUILD: towns + farms + fields
   ============================================================ */
const cropTexG = canvasTex(128,128,(g,w,h)=>{
  g.fillStyle='#4e7a3a';g.fillRect(0,0,w,h);
  for(let i=0;i<16;i++){ g.fillStyle=i%2?'#457034':'#578444'; g.fillRect(0,i*8,w,4); }
  for(let i=0;i<420;i++){ g.fillStyle='rgba(30,60,20,.35)'; g.fillRect(Math.random()*w,Math.random()*h,2,2); }
},[1,1]);
const cropTexW = canvasTex(128,128,(g,w,h)=>{
  g.fillStyle='#c9a94a';g.fillRect(0,0,w,h);
  for(let i=0;i<16;i++){ g.fillStyle=i%2?'#bd9c3f':'#d4b455'; g.fillRect(0,i*8,w,4); }
  for(let i=0;i<380;i++){ g.fillStyle='rgba(120,90,20,.3)'; g.fillRect(Math.random()*w,Math.random()*h,2,2); }
},[1,1]);
const cropMatG = new THREE.MeshStandardMaterial({map:cropTexG, roughness:1});
const cropMatW = new THREE.MeshStandardMaterial({map:cropTexW, roughness:1});

function field(x1,z1,x2,z2,width,mat){
  const {pts,ys} = SA.resample([[x1,z1],[x2,z2]], 16, .22);
  const g = SA.ribbonGeo(pts, ys, width, 14, 0, [0,1]);
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  scene.add(m);
}

SA.addBuild('towns', ()=>{
  /* ---------- Blueberry ---------- */
  const bbY = 16;
  const bbRowN = [[-455,-1712,'wallA'],[-395,-1712,'wallB'],[-275,-1712,'wallC'],[-215,-1712,'wallD'],[-455,-1790,'wallB'],[-330,-1790,'wallD'],[-215,-1790,'wallA']];
  for(const [x,z,wl] of bbRowN) SA.addHouse(x, z, 11, 9, 5.2, 0, {wall:wl});
  SA.addHouse(-330, -1640, 13, 10, 6, Math.PI, {wall:'wallC'});
  SA.addHouse(-245, -1835, 12, 9, 5, 0, {wall:'wallB'});
  /* Blueberry barber + general store fronts (marker shops) */
  SA.addHouse(-355, -1712, 12, 10, 5.6, 0, {wall:'wallD', flat:false});
  SA.cityBlocks = SA.cityBlocks || [];
  SA.cityBlocks.push({x0:-500,x1:-160,z0:-1900,z1:-1610,c:'#4b5057'});
  /* ---------- Dillimore ---------- */
  const dlRow = [[290,-1952,'wallB'],[360,-1952,'wallA'],[430,-1952,'wallC'],[290,-1868,'wallD'],[360,-1868,'wallC'],[430,-1868,'wallA']];
  for(const [x,z,wl] of dlRow) SA.addHouse(x, z, 12, 9, 5.4, 0, {wall:wl});
  SA.addHouse(455, -1868, 14, 11, 6.4, 0, {wall:'wallB'});
  SA.cityBlocks.push({x0:250,x1:500,z0:-2040,z1:-1790,c:'#4b5057'});
  /* ---------- Palomino Creek ---------- */
  const plRow = [[660,-1712,'wallA'],[730,-1712,'wallB'],[800,-1712,'wallC'],[870,-1712,'wallA'],[660,-1810,'wallD'],[730,-1810,'wallB'],[800,-1810,'wallA'],[870,-1810,'wallC']];
  for(const [x,z,wl] of plRow) SA.addHouse(x, z, 11, 9, 5.2, 0, {wall:wl});
  SA.addHouse(915, -1712, 12, 10, 5.6, 0, {wall:'wallD'});
  SA.cityBlocks.push({x0:600,x1:960,z0:-1930,z1:-1600,c:'#4b5057'});
  /* trailer park */
  const trailers = [[545,-1600,14],[610,-1602,14],[672,-1598,14],[560,-1678,16],[640,-1680,16]];
  for(const [x,z,y0] of trailers){
    const gy = SA.terrainH(x,z);
    SA.ibAdd('wallB', x, gy+1.35, z, 8.4, 2.7, 3.4, 0);
    SA.ibAdd('roofB', x, gy+2.85, z, 8.7, .5, 3.7, 0);
    SA.ibAdd('box', x+1.2, gy+.75, z+1.75, .8, 1.5, .18, 0);
    addCollider({x0:x-4.2,x1:x+4.2,z0:z-2,z1:z+2,h:3.4,y0:gy});
  }
  SA.addHouse(760, -1620, 10, 8, 4.8, 0, {wall:'wallC'});

  /* ---------- farms ---------- */
  /* farm A (Blueberry north) */
  const gyA = SA.terrainH(-300,-1590);
  SA.ibAdd('barn', -300, gyA+3.6, -1590, 13, 7.2, 9, 0);
  SA.ibAdd('roofA', -300, gyA+7.2+2.4, -1590, 14.6, 4.8, 10.6, 0);
  addCollider({x0:-307,x1:-293,z0:-1595,z1:-1585,h:8,y0:gyA});
  const gyS = SA.terrainH(-268,-1582);
  SA.ibAdd('silo', -268, gyS+5, -1582, 3, 10, 3, 0);
  SA.ibAdd('dome', -268, gyS+10, -1582, 3, 3.2, 3, 0);
  SA.addHouse(-330, -1600, 11, 9, 5.6, 0, {wall:'wallA', chimney:true});
  /* farm B (south Red County) */
  const gyB = SA.terrainH(-290,-2280);
  SA.ibAdd('barn', -290, gyB+3.6, -2280, 13, 7.2, 9, 0);
  SA.ibAdd('roofA', -290, gyB+9.6, -2280, 14.6, 4.8, 10.6, 0);
  addCollider({x0:-297,x1:-283,z0:-2285,z1:-2275,h:8,y0:gyB});
  SA.addHouse(-240, -2300, 11, 9, 5.4, 0, {wall:'wallB', chimney:true});
  /* farm C (Palomino) */
  const gyC = SA.terrainH(575,-1700);
  SA.ibAdd('barn', 575, gyC+3.4, -1700, 12, 6.8, 8.5, 0);
  SA.ibAdd('roofA', 575, gyC+9.2, -1700, 13.6, 4.6, 10, 0);
  addCollider({x0:569,x1:581,z0:-1705,z1:-1695,h:8,y0:gyC});
  const gyS2 = SA.terrainH(610,-1690);
  SA.ibAdd('silo', 610, gyS2+4.5, -1690, 2.8, 9, 2.8, 0);
  SA.ibAdd('dome', 610, gyS2+9, -1690, 2.8, 3, 2.8, 0);

  /* fields */
  field(-520,-1560,-250,-1590, 70, cropMatG);
  field(-540,-1950,-380,-2080, 78, cropMatW);
  field(240,-1725, 520,-1725, 58, cropMatG);
  field(620,-1662, 900,-1662, 52, cropMatW);
  field(-150,-1655, 10,-1558, 72, cropMatG);
  field(-390,-2330,-160,-2295, 84, cropMatW);

  /* fences around farm A pen (cows) + fields */
  fenceLine(-360,-1560,-240,-1560);
  fenceLine(-360,-1640,-240,-1640);
  fenceLine(-360,-1560,-360,-1640);
  fenceLine(-240,-1560,-240,-1640);
  fenceLine(-520,-1555,-250,-1585, 9);
  fenceLine(240,-1700, 520,-1700, 9);
  fenceLine(620,-1640, 900,-1640, 9);
  fenceLine(-390,-2305,-160,-2270, 9);

  /* ---------- gas stations ---------- */
  function gasStation(x,z,ry){
    const gy = SA.terrainH(x,z);
    SA.ibAdd('conc', x, gy+.08, z, 22, .16, 14, ry);
    SA.addHouse(x+7, z+4.5, 7, 5, 4, ry, {wall:'wallB', flat:true, roofH:.3});
    SA.ibAdd('box', x-7, gy+.2, z-4, .8, 4.2, .8, 0);
    SA.ibAdd('box', x-7, gy+.2, z+4, .8, 4.2, .8, 0);
    SA.ibAdd('box', x-1, gy+.2, z-4, .8, 4.2, .8, 0);
    SA.ibAdd('box', x-1, gy+.2, z+4, .8, 4.2, .8, 0);
    SA.ibAdd('roofB', x-4, gy+4.5, z, 9, .5, 11, 0);
    SA.ibAdd('drum', x-8.5, gy+.8, z-2, .8, 1.6, .8, 0);
    SA.ibAdd('drum', x-8.5, gy+.8, z+1, .8, 1.6, .8, 0);
    SA.addSpot({x:x-2, z:z+6, r:7, label:'Service vehicle ($100)', fn:()=>{
      const pc = cur();
      if(pc){ if(pc.damage>0.05||pc.hp<(pc.maxHp||250)){ if(cash>=100){ cash-=100; pc.damage=0; if(pc.maxHp) pc.hp=pc.maxHp; SA.toast('Vehicle repaired -$100'); } else SA.toast('Not enough cash'); } else SA.toast('Vehicle is fine'); }
      else { if(player.hp<100){ if(cash>=50){ cash-=50; player.hp=100; SA.toast('Health restored -$50'); } else SA.toast('Not enough cash'); } else SA.toast('Health is fine'); }
    }});
  }
  gasStation(455, -1955, 0);
  gasStation(720, -1685, Math.PI);

  /* ---------- shops registry (used by s11) ---------- */
  SA.shops = SA.shops || [];
  SA.shops.push({kind:'barber', x:-355, z:-1712, name:'Blueberry Barbers'});
  SA.shops.push({kind:'food', x:-330, z:-1835, name:'Blueberry Diner'});
  SA.shops.push({kind:'food', x:455, z:-1868, name:'Welcome Pump'});
  SA.shops.push({kind:'food', x:730, z:-1810, name:'Pizza Stack'});
  SA.shops.push({kind:'gun', x:245, z:-1868, name:'Dillimore Ammunation'});
  SA.shops.push({kind:'clothes', x:915, z:-1810, name:'Palomino Binco'});
  /* safehouses */
  SA.safehouses = SA.safehouses || [];
  SA.safehouses.push({x:895, z:-1712, name:'Palomino Creek Safehouse', price:20000, city:'Red County'});

  console.log('[SA] towns + farms built');
});

/* ============================================================
   BUILD: forests / desert props / rocks
   ============================================================ */
SA.addBuild('nature', ()=>{
  const pads = SA.pads;
  function inPad(x,z,m){
    m=m||12;
    for(const p of pads){ if(x>p.x0-m&&x<p.x1+m&&z>p.z0-m&&z<p.z1+m) return true; }
    return false;
  }
  function nearRoad(x,z,m){
    for(const r of SA.roads){
      if(r.w<6) continue;
      const hw=(r.w/2)+(m||6);
      for(let i=0;i<r.pts.length-1;i++){
        const x1=r.pts[i][0],z1=r.pts[i][1],x2=r.pts[i+1][0],z2=r.pts[i+1][1];
        if(x<Math.min(x1,x2)-hw||x>Math.max(x1,x2)+hw||z<Math.min(z1,z2)-hw||z>Math.max(z1,z2)+hw) continue;
        const dx=x2-x1,dz=z2-z1,L2=dx*dx+dz*dz||1;
        let t=((x-x1)*dx+(z-z1)*dz)/L2; t=t<0?0:t>1?1:t;
        if(Math.hypot(x-(x1+dx*t), z-(z1+dz*t))<hw) return true;
      }
    }
    return false;
  }
  function scatter(n, pick){
    let tries=0, made=0;
    while(made<n && tries<n*14){
      tries++;
      const x=pick[0]+Math.random()*(pick[1]-pick[0]);
      const z=pick[2]+Math.random()*(pick[3]-pick[2]);
      const h=SA.terrainH(x,z);
      if(h<pick[4]||h>pick[5])continue;
      if(inPad(x,z,14)||nearRoad(x,z,5))continue;
      if(!pick[6]||!pick[6](x,z,h))continue;
      const s=pick[7]?pick[7]():1;
      if(pick[8]) { made+=pick[8](x,z,h,s); }
      else { made++; }
    }
    return made;
  }
  const trunkItems=[],leafA=[],leafB=[],conif=[];
  /* Flint forest */
  scatter(260, [-2400,-1400,-2700,-1800, 2, 130, null, ()=>rnd(.8,1.6), (x,z,h,s)=>{
    trunkItems.push([x,h+.9*s,z, s,s,s*1.2,0]);
    (Math.random()<.5?leafA:leafB).push([x,h+3.4*s,z, s*2.6,s*2.4,s*2.6,0]);
    return 1;
  }]);
  scatter(120, [-1500,-1050,-2700,-2200, 2, 120, null, ()=>rnd(.9,1.7), (x,z,h,s)=>{
    trunkItems.push([x,h+.9*s,z, s,s,s*1.2,0]);
    (Math.random()<.5?leafA:leafB).push([x,h+3.4*s,z, s*2.6,s*2.4,s*2.6,0]);
    return 1;
  }]);
  /* Red County scatter */
  scatter(170, [-600,400,-2400,-1600, 2, 60, null, ()=>rnd(.8,1.4), (x,z,h,s)=>{
    trunkItems.push([x,h+.85*s,z, s,s,s*1.1,0]);
    (Math.random()<.3?conif:leafB).push([x,h+3.2*s,z, s*2.5,s*2.3,s*2.5,0]);
    return 1;
  }]);
  /* Chiliad conifers */
  scatter(170, [-2100,-1400,-3200,-2500, 6, 310, (x,z,h)=>h>4, ()=>rnd(.9,1.8), (x,z,h,s)=>{
    trunkItems.push([x,h+.8*s,z, s*.9,s,s*.9,0]);
    conif.push([x,h+3.6*s,z, s*2.2,s*3.4,s*2.2,0]);
    return 1;
  }]);
  /* north coast pines */
  scatter(70, [-1700,-500,-3600,-3100, 2, 90, null, ()=>rnd(.9,1.5), (x,z,h,s)=>{
    trunkItems.push([x,h+.8*s,z, s*.9,s,s*.9,0]);
    conif.push([x,h+3.6*s,z, s*2.2,s*3.4,s*2.2,0]);
    return 1;
  }]);
  inst(SA.ibGeo.trunk, SA.MAT.trunk, trunkItems, true);
  inst(SA.ibGeo.leafA, SA.MAT.leafA, leafA, true);
  inst(SA.ibGeo.leafB, SA.MAT.leafB, leafB, true);
  inst(SA.ibGeo.cone, SA.MAT.conif, conif, true);

  /* cacti */
  const cacT=[],cacA=[];
  scatter(150, [-1950,-250,-3600,-2300, 4, 90, null, ()=>rnd(.7,1.5), (x,z,h,s)=>{
    cacT.push([x,h+1.6*s,z, s,s,s,0]);
    cacA.push([x+.5*s,h+1.9*s,z, s*.36,s*.8,s*.36,.4]);
    cacA.push([x-.45*s,h+2.2*s,z, s*.32,s*.7,s*.32,-.5]);
    return 1;
  }]);
  scatter(90, [300,2100,-3100,-2450, 6, 100, null, ()=>rnd(.7,1.4), (x,z,h,s)=>{
    cacT.push([x,h+1.6*s,z, s,s,s,0]);
    cacA.push([x+.5*s,h+1.9*s,z, s*.36,s*.8,s*.36,.4]);
    return 1;
  }]);
  inst(SA.ibGeo.cyl, SA.MAT.cactus, cacT, true);
  inst(SA.ibGeo.cyl, SA.MAT.cactus, cacA, true);

  /* rocks */
  const rocks=[];
  scatter(120, [-2100,-500,-3600,-2600, 2, 200, null, ()=>rnd(.6,2.2), (x,z,h,s)=>{
    rocks.push([x,h+.3*s,z, s,s*.8,s,Math.random()*3]);
    return 1;
  }]);
  scatter(90, [300,2100,-3100,-2400, 8, 120, null, ()=>rnd(.5,1.8), (x,z,h,s)=>{
    rocks.push([x,h+.25*s,z, s,s*.8,s,Math.random()*3]);
    return 1;
  }]);
  scatter(40, [-1200,-100,-2900,-1600, 4, 80, null, ()=>rnd(.5,1.4), (x,z,h,s)=>{
    rocks.push([x,h+.2*s,z, s,s*.8,s,Math.random()*3]);
    return 1;
  }]);
  inst(SA.ibGeo.rock, SA.MAT.rock, rocks, true);
  console.log('[SA] nature built');
});

/* ============================================================
   BUILD: Mount Chiliad cable car
   ============================================================ */
SA.cable = null;
SA.addBuild('cablecar', ()=>{
  const base = {x:-1740, z:-2480};
  const top  = {x:-1755, z:-2885};
  const y0 = SA.terrainH(base.x,base.z);
  const y1 = SA.terrainH(top.x,top.z);
  const supports = [
    {x:base.x, z:base.z, y:y0+9},
    {x:base.x+(top.x-base.x)*.33, z:base.z+(top.z-base.z)*.33, tower:true},
    {x:base.x+(top.x-base.x)*.66, z:base.z+(top.z-base.z)*.66, tower:true},
    {x:top.x, z:top.z, y:y1+9},
  ];
  for(let i=1;i<=2;i++){
    const s=supports[i];
    const tg=SA.terrainH(s.x,s.z);
    s.y=Math.max(tg+14, lerp(y0+9,y1+9,i===1?.33:.66));
    SA.ibAdd('conc', s.x, (tg+s.y)/2, s.z, 2.2, s.y-tg, 2.2, 0);
    SA.ibAdd('conc', s.x, s.y+.3, s.z, 4.6, .6, 1.1, 0);
  }
  /* cable analytic along z */
  const L = Math.hypot(top.x-base.x, top.z-base.z);
  const sag = 4.5;
  SA.cablePos = function(t){
    const x = lerp(base.x, top.x, t), z = lerp(base.z, top.z, t);
    /* piecewise span height with sag */
    let y;
    const s0=0, s1=.33, s2=.66, s3=1;
    const ys=[supports[0].y, supports[1].y, supports[2].y, supports[3].y];
    if(t<s1){ const u=t/s1; y=lerp(ys[0],ys[1],u) - Math.sin(u*Math.PI)*sag; }
    else if(t<s2){ const u=(t-s1)/(s2-s1); y=lerp(ys[1],ys[2],u) - Math.sin(u*Math.PI)*sag; }
    else { const u=(t-s2)/(s3-s2); y=lerp(ys[2],ys[3],u) - Math.sin(u*Math.PI)*sag; }
    return {x,y,z};
  };
  /* two parallel cables */
  for(const off of [-1.7,1.7]){
    const pts=[];
    for(let i=0;i<=60;i++){
      const p=SA.cablePos(i/60);
      pts.push(new THREE.Vector3(p.x+off, p.y, p.z));
    }
    const curve=new THREE.CatmullRomCurve3(pts);
    const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,60,.17,5,false), SA.MAT.dark);
    scene.add(tube);
  }
  /* stations */
  const gyB = SA.terrainH(base.x,base.z);
  SA.ibAdd('wallC', base.x, gyB+3, base.z, 12, 6, 9, 0);
  SA.ibAdd('roofA', base.x, gyB+6.9, base.z, 13.6, 2.6, 10.6, 0);
  addCollider({x0:base.x-6,x1:base.x+6,z0:base.z-4.5,z1:base.z+4.5,h:7,y0:gyB});
  SA.ibAdd('conc', base.x, gyB+4.5, base.z-6.4, 5, .5, 5, 0);
  const gyT = SA.terrainH(top.x,top.z);
  SA.ibAdd('wallB', top.x, gyT+3, top.z, 12, 6, 9, 0);
  SA.ibAdd('roofB', top.x, gyT+6.9, top.z, 13.6, 2.6, 10.6, 0);
  addCollider({x0:top.x-6,x1:top.x+6,z0:top.z-4.5,z1:top.z+4.5,h:7,y0:gyT});
  SA.ibAdd('conc', top.x, gyT+4.5, top.z+6.4, 5, .5, 5, 0);
  /* gondola */
  const g = new THREE.Group();
  const gBody = new THREE.Mesh(new THREE.BoxGeometry(3.1,2.5,3.1), new THREE.MeshStandardMaterial({color:0xc23a2e, roughness:.6}));
  gBody.position.y = 1.55; gBody.castShadow = true; g.add(gBody);
  const gRoof = new THREE.Mesh(new THREE.BoxGeometry(3.5,.3,3.5), SA.MAT.dark);
  gRoof.position.y = 2.9; g.add(gRoof);
  const gArm = new THREE.Mesh(new THREE.BoxGeometry(.35,2.6,.35), SA.MAT.dark);
  gArm.position.y = 4.2; g.add(gArm);
  const gArm2 = new THREE.Mesh(new THREE.BoxGeometry(3.6,.35,.6), SA.MAT.dark);
  gArm2.position.y = 5.4; g.add(gArm2);
  scene.add(g);
  SA.cable = { t:0, dir:1, pause:0, group:g, base, top, y0:gyB, y1:gyT, len:L };
  const p0 = SA.cablePos(0);
  g.position.set(p0.x, p0.y-6.1, p0.z);
  /* cable car ride state */
  SA.ride = null;
  function board(from){
    if(SA.ride) return;
    SA.ride = {from, times:0};
    player.frozen = 1;
    SA.toast('Hold on tight!');
  }
  function disembark(){
    const r=SA.ride; SA.ride=null;
    player.frozen = 0; player.vy = 0;
    const s = r.from===0 ? SA.cable.top : SA.cable.base;
    player.x = s.x + 6; player.z = s.z + 6;
    player.y = SA.terrainH(player.x,player.z)+.05;
    SA.toast('Welcome to ' + (r.from===0?'Mount Chiliad summit':'Chiliad valley station'));
  }
  SA.addSpot({x:base.x, z:base.z+7, r:9, label:'Ride cable car up', when:()=>SA.cable&&SA.cable.t<.03&&!SA.ride, fn:()=>board(0)});
  SA.addSpot({x:top.x, z:top.z-7, r:9, label:'Ride cable car down', when:()=>SA.cable&&SA.cable.t>.97&&!SA.ride, fn:()=>board(1)});
  SA.addUpd(function(dt){
    const c = SA.cable;
    if(c.pause>0){ c.pause-=dt; }
    else {
      c.t += c.dir*(dt/c.len)*9.5;
      if(c.t>=1){ c.t=1; c.dir=-1; c.pause=5; }
      else if(c.t<=0){ c.t=0; c.dir=1; c.pause=5; }
    }
    const p = SA.cablePos(c.t);
    c.group.position.set(p.x, p.y-6.1, p.z);
    c.group.rotation.y = c.dir>0?Math.PI:0;
    if(SA.ride){
      SA.ride.times += dt;
      player.x = c.group.position.x;
      player.z = c.group.position.z;
      player.y = c.group.position.y + 3.2;
      player.vy = 0;
      const r = SA.ride;
      if((r.from===0 && c.t>=1) || (r.from===1 && c.t<=0) || r.times>140) disembark();
    }
  });
  console.log('[SA] cable car built (base y', Math.round(gyB), 'top y', Math.round(gyT), ')');
});

/* ============================================================
   BUILD: Area 69 + Big Ear + Verdant Meadows
   ============================================================ */
SA.addBuild('military', ()=>{
  /* ---- Area 69 compound (pad y 40) ---- */
  const A = {x0:1000, x1:1360, z0:-2760, z1:-2450};
  const y = 40;
  /* perimeter wall */
  function wallSeg(x1,z1,x2,z2){
    const len=Math.hypot(x2-x1,z2-z1);
    const mx=(x1+x2)/2, mz=(z1+z2)/2;
    SA.ibAdd('conc', mx, y+2.1, mz, len, 4.2, .5, Math.atan2(-(z2-z1),(x2-x1)));
    addCollider({x0:Math.min(x1,x2)-.4,x1:Math.max(x1,x2)+.4,z0:Math.min(z1,z2)-.4,z1:Math.max(z1,z2)+.4,h:5,y0:y});
  }
  wallSeg(A.x0, A.z0, A.x1, A.z0);
  wallSeg(A.x0, A.z1, A.x1, A.z1);
  wallSeg(A.x0, A.z0, A.x0, A.z1);
  wallSeg(A.x1, A.z0, A.x1, A.z1);
  /* gate marker */
  SA.ibAdd('conc', 1080, y+2.6, A.z1, 5, 5.2, .8, 0);
  /* hangar */
  const hx=1220, hz=-2620;
  SA.ibAdd('wallD', hx, y+4.5, hz, 42, 9, 26, 0);
  addCollider({x0:hx-21,x1:hx+21,z0:hz-13,z1:hz+13,h:11,y0:y});
  const hroof = new THREE.Mesh(new THREE.CylinderGeometry(13.2,13.2,42,16,1,false,0,Math.PI), SA.MAT.conc);
  hroof.rotation.z = Math.PI/2;
  hroof.position.set(hx, y+9, hz);
  scene.add(hroof);
  /* barracks */
  SA.ibAdd('wallB', 1050, y+2, -2700, 18, 4, 9, 0);
  SA.ibAdd('roofB', 1050, y+4.3, -2700, 19.4, 1, 10.4, 0);
  addCollider({x0:1041,x1:1059,z0:-2705,z1:-2695,h:5,y0:y});
  SA.ibAdd('wallB', 1150, y+2, -2490, 18, 4, 9, 0);
  SA.ibAdd('roofB', 1150, y+4.3, -2490, 19.4, 1, 10.4, 0);
  addCollider({x0:1141,x1:1159,z0:-2495,z1:-2485,h:5,y0:y});
  /* guard towers */
  for(const [tx,tz] of [[1010,-2470],[1350,-2740]]){
    SA.ibAdd('conc', tx, y+5, tz, 1, 10, 1, 0);
    SA.ibAdd('wallD', tx, y+11, tz, 4, 3, 4, 0);
    SA.ibAdd('roofB', tx, y+12.8, tz, 4.6, .8, 4.6, 0);
  }
  /* small dish + masts */
  SA.ibAdd('cyl', 1300, y+4, -2500, .6, 8, .6, 0);
  SA.ibAdd('cyl', 1320, y+5, -2520, .6, 10, .6, 0);
  /* warning spot */
  SA.addSpot({x:1080, z:-2440, r:10, label:'Area 69 - KEEP OUT', fn:()=>SA.toast('A soldier glares at you...')});

  /* ---- Big Ear (radio telescope on pad y30) ---- */
  const bx=470, bz=-2350, by=30;
  SA.ibAdd('conc', bx, by+8, bz, 14, 16, 14, 0);
  addCollider({x0:bx-7,x1:bx+7,z0:bz-7,z1:bz+7,h:17,y0:by});
  const dish = new THREE.Mesh(new THREE.SphereGeometry(46, 26, 14, 0, Math.PI*2, 0, Math.PI/2), SA.MAT.dish);
  dish.position.set(bx, by+16, bz);
  dish.rotation.x = -Math.PI/2 + 0.42;
  scene.add(dish);
  const dishStrut = new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.6,20,8), SA.MAT.dark);
  dishStrut.position.set(bx, by+14, bz+8);
  scene.add(dishStrut);
  SA.addSpot({x:bx, z:bz+14, r:10, label:'Big Ear control', fn:()=>SA.toast('The giant ear listens to the stars...')});

  /* ---- Verdant Meadows (pad y 24) ---- */
  const vmY = 24;
  /* hangar */
  SA.ibAdd('wallC', 260, vmY+4, -2695, 30, 8, 20, 0);
  SA.ibAdd('roofB', 260, vmY+8.6, -2695, 31.6, 1.2, 21.6, 0);
  addCollider({x0:245,x1:275,z0:-2705,z1:-2685,h:10,y0:vmY});
  /* office shack */
  SA.addHouse(160, -2680, 9, 7, 3.6, 0, {wall:'wallC', flat:true});
  /* water tower */
  for(const [lx,lz] of [[-3,-3],[3,-3],[-3,3],[3,3]]) SA.ibAdd('cyl', 495+lx, vmY+5, -2680+lz, .4, 10, .4, 0);
  SA.ibAdd('drum', 495, vmY+11, -2680, 3.4, 3.4, 3.4, 0);
  addCollider({x0:488,x1:502,z0:-2687,z1:-2673,h:6,y0:vmY});
  /* fuel pumps */
  SA.ibAdd('box', 350, vmY+1.1, -2692, 1, 2.2, .8, 0);
  SA.ibAdd('box', 356, vmY+1.1, -2692, 1, 2.2, .8, 0);
  SA.addSpot({x:352, z:-2685, r:7, label:'Refuel aircraft ($50)', fn:()=>{
    const pc=cur();
    if(!pc){ SA.toast('Bring an aircraft here'); return; }
    if(pc.fuel!==undefined && pc.fuel<99){ if(cash>=50){cash-=50;pc.fuel=100;SA.toast('Refueled -$50');} else SA.toast('Not enough cash'); }
    else SA.toast('Tank is full');
  }});
  /* windsock (animated) */
  const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,6,6), SA.MAT.dark);
  sockPole.position.set(520, vmY+3, -2760);
  scene.add(sockPole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(.5,2.6,8), new THREE.MeshStandardMaterial({color:0xe07830, roughness:.9}));
  sock.rotation.z = Math.PI/2;
  sock.position.set(521.6, vmY+5.6, -2760);
  scene.add(sock);
  SA.addUpd(function(dt2){
    const w = 1 + Math.sin(SA.t*1.3)*.35;
    sock.rotation.z = Math.PI/2 + (w-1)*.5;
    sock.rotation.y = Math.sin(SA.t*.9)*.4;
  });
  /* flight school marker spot */
  SA.addSpot({x:260, z:-2660, r:9, label:'Verdant Meadows Flight School', fn:()=>{ if(SA.openFlightSchool) SA.openFlightSchool(); else SA.toast('Flight school coming soon'); }});

  console.log('[SA] military + airfield built');
});

/* ============================================================
   BUILD: cows (dynamic wanderers)
   ============================================================ */
SA.addBuild('cows', ()=>{
  const cowMat = new THREE.MeshStandardMaterial({color:0xe8e4dc, roughness:.9});
  const cowDark = new THREE.MeshStandardMaterial({color:0x3a3532, roughness:.9});
  SA.cows = [];
  const pen = {x0:-355, z0:-1635, x1:-245, z1:-1565};
  for(let i=0;i<7;i++){
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2,1.15,.95), cowMat); body.position.y=1.15; g.add(body);
    const patch = new THREE.Mesh(new THREE.BoxGeometry(.8,.7,.97), cowDark); patch.position.set(-.4,1.3,0); g.add(patch);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.7,.62,.55), cowMat); head.position.set(1.32,1.35,0); g.add(head);
    for(const [lx,lz] of [[-.7,-.32],[-.7,.32],[.75,-.32],[.75,.32]]){
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.2,.62,.2), cowDark); leg.position.set(lx,.31,lz); g.add(leg);
    }
    const x = pen.x0+3+Math.random()*(pen.x1-pen.x0-6);
    const z = pen.z0+3+Math.random()*(pen.z1-pen.z0-6);
    g.position.set(x, SA.terrainH(x,z), z);
    scene.add(g);
    SA.cows.push({g, dir:Math.random()*Math.PI*2, sp:rnd(.3,.7), t:rnd(1,4)});
  }
  SA.addUpd(function(dt){
    for(const c of SA.cows){
      c.t -= dt;
      if(c.t<=0){ c.t = rnd(2,5); c.dir = Math.random()*Math.PI*2; c.sp = Math.random()<.35?0:rnd(.25,.65); }
      const nx = c.g.position.x + Math.sin(c.dir)*c.sp*dt;
      const nz = c.g.position.z + Math.cos(c.dir)*c.sp*dt;
      if(nx>pen.x0+1.5&&nx<pen.x1-1.5&&nz>pen.z0+1.5&&nz<pen.z1-1.5){
        c.g.position.x = nx; c.g.position.z = nz;
        c.g.position.y = SA.terrainH(nx,nz);
      } else c.dir += 2.4;
      c.g.rotation.y = c.dir;

    }
  });
});

/* finalize instance buckets after all parts that use them (cities run later) */
(SA.hooks.afterBuild = SA.hooks.afterBuild || []).push(function(){
  SA.ibFlush();
  console.log('[SA] instances flushed:', Object.keys(SA.ib).length, 'buckets');
});
console.log('[SA] country part ready');
})();
