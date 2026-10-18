/* ============================================================
   PART 05: LAS VENTURAS  (neon city on the existing LV street
   grid: 9 x-streets, 7 z-streets, pad y12) + casinos + strip.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
const M = SA.MAT;
const ibGeo = SA.ibGeo;

/* ---- city materials / textures ---- */
const twrTex = canvasTex(128,256,(g,w,h)=>{
  g.fillStyle='#f2f2f2';g.fillRect(0,0,w,h);
  for(let y=10;y<h-6;y+=11){
    for(let x=6;x<w-6;x+=12){
      const lit=Math.random()<.10;
      g.fillStyle= lit ? '#ffe9a8' : (Math.random()<.5?'#2c3947':'#3a4a5a');
      g.fillRect(x,y,8,7);
    }
  }
  g.fillStyle='rgba(0,0,0,.14)';
  for(let y=0;y<h;y+=64) g.fillRect(0,y,w,2);
},[1,1]);
M.twrA = new THREE.MeshStandardMaterial({map:twrTex, color:0xd4dade, roughness:.6, metalness:.15});
M.twrB = new THREE.MeshStandardMaterial({map:twrTex, color:0x7fa3bd, roughness:.4, metalness:.35});
M.twrC = new THREE.MeshStandardMaterial({map:twrTex, color:0xded0ae, roughness:.7});
M.twrD = new THREE.MeshStandardMaterial({map:twrTex, color:0x51636f, roughness:.45, metalness:.3});
M.towerRoof = new THREE.MeshStandardMaterial({color:0x3b4046, roughness:.9});
M.neonP = new THREE.MeshStandardMaterial({color:0xcc3388, emissive:0xd0408c, emissiveIntensity:.9, roughness:.5});
M.neonY = new THREE.MeshStandardMaterial({color:0xd8b23a, emissive:0xe8c040, emissiveIntensity:.9, roughness:.5});
M.neonB = new THREE.MeshStandardMaterial({color:0x2e7fd0, emissive:0x3a90e8, emissiveIntensity:.9, roughness:.5});
M.neonG = new THREE.MeshStandardMaterial({color:0x38b060, emissive:0x40c868, emissiveIntensity:.9, roughness:.5});
M.goldGlass = new THREE.MeshStandardMaterial({color:0xc9a43a, emissive:0x6a5210, emissiveIntensity:.25, roughness:.25, metalness:.6});
M.palm = new THREE.MeshStandardMaterial({color:0x4a7a3a, roughness:1});
M.palmTrunk = new THREE.MeshStandardMaterial({color:0x8a7a5a, roughness:1});
M.castle = new THREE.MeshStandardMaterial({color:0xe8e4dc, roughness:.8});
M.castleRed = new THREE.MeshStandardMaterial({color:0xa8322e, roughness:.8});
M.domeSkin = new THREE.MeshStandardMaterial({color:0xb8c4cc, roughness:.35, metalness:.4});
SA.ibShape('twrA','box',M.twrA,false); SA.ibShape('twrB','box',M.twrB,false);
SA.ibShape('twrC','box',M.twrC,false); SA.ibShape('twrD','box',M.twrD,false);
SA.ibShape('towerRoof','box',M.towerRoof,false);
SA.ibShape('neonP','box',M.neonP,false); SA.ibShape('neonY','box',M.neonY,false);
SA.ibShape('neonB','box',M.neonB,false); SA.ibShape('neonG','box',M.neonG,false);
SA.ibShape('palmTrunk','box',M.palmTrunk,true);
SA.ibShape('palmCrown','leafA',M.palm,true);

const TWR=['twrA','twrB','twrC','twrD'];
let seed=1234;
function rr(){ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; }
function tower(x,z,w,d,h,bk,ry){
  const gy=SA.terrainH(x,z);
  const b=bk||TWR[(rr()*4)|0];
  SA.ibAdd(b, x, gy+h/2, z, w,h,d, ry||0);
  SA.ibAdd('towerRoof', x, gy+h+.45, z, w*1.06,1,d*1.06, ry||0);
  if(h>40 && rr()<.6){
    SA.ibAdd('towerRoof', x+w*.2, gy+h+2.2, z+d*.15, 3,3.4,3, 0);
    SA.ibAdd('towerRoof', x-w*.22, gy+h+1.5, z-d*.2, 2.4,2,2.4, 0);
  }
  const cs=Math.abs(Math.cos(ry||0)), sn=Math.abs(Math.sin(ry||0));
  const ex=(w*cs+d*sn)/2, ez=(w*sn+d*cs)/2;
  addCollider({x0:x-ex,x1:x+ex,z0:z-ez,z1:z+ez,h:h+2,y0:gy});
  return gy;
}
function palm(x,z,s){
  s=s||1;
  const gy=SA.terrainH(x,z);
  SA.ibAdd('palmTrunk', x, gy+3.2*s, z, .5,6.4*s,.5, 0);
  SA.ibAdd('palmCrown', x, gy+6.6*s, z, 3.1*s,1.5*s,3.1*s, rr()*3);
  SA.ibAdd('palmCrown', x, gy+7.0*s, z, 2.2*s,1.1*s,2.2*s, rr()*3);
}
SA.cityTower = tower; SA.cityPalm = palm; SA.cityRR = rr;

SA.addBuild('las venturas', ()=>{
  const XS=[990,1120,1250,1380,1510,1640,1790,1930,2070];
  const ZS=[-2410,-2280,-2150,-2020,-1890,-1760,-1630];
  /* ---------- generic blocks ---------- */
  SA.cityBlocks = SA.cityBlocks || [];
  const RESV=[
    [1370,1520,-2160,-2010],   /* pyramid */
    [1390,1500,-2265,-2165],   /* castle */
    [1660,1760,-1995,-1895],   /* pagoda */
    [1650,1770,-2140,-2030],   /* dome */
    [1835,1885,-1720,-1670],   /* needle tower */
    [975,1045,-2465,-2435]     /* welcome arch */
  ];
  function inResv(x0,x1,z0,z1,m){
    m=m||0;
    for(const r of RESV){ if(!(x1<r[0]-m||x0>r[1]+m||z1<r[2]-m||z0>r[3]+m)) return true; }
    return false;
  }
  for(let i=0;i<XS.length-1;i++){
    for(let j=0;j<ZS.length-1;j++){
      const bx0=XS[i]+14, bx1=XS[i+1]-14, bz0=ZS[j]+14, bz1=ZS[j+1]-14;
      const cxm=(bx0+bx1)/2, czm=(bz0+bz1)/2;
      const onStrip = (XS[i]===1380&&XS[i+1]===1510)||(XS[i]===1510&&XS[i+1]===1640);
      const midZ = (ZS[j]===-2150||ZS[j]===-2020||ZS[j]===-1890);
      SA.cityBlocks.push({x0:bx0-10,x1:bx1+10,z0:bz0-10,z1:bz1+10,c:'#42474e'});
      if(onStrip && midZ) continue;   /* reserved plazas around casinos */
      /* 2-4 buildings per block */
      const n=2+((rr()*3)|0);
      for(let k=0;k<n;k++){
        const w=18+rr()*26, d=16+rr()*24;
        const x=bx0+w/2+rr()*Math.max(1,(bx1-bx0-w));
        const z=bz0+d/2+rr()*Math.max(1,(bz1-bz0-d));
        if(inResv(x-w/2,x+w/2,z-d/2,z+d/2,2)) continue;
        const dist=Math.abs((XS[i]+XS[i+1])/2-1510);
        let h; 
        if(dist>240) h=14+rr()*22;              /* outskirts */
        else if(dist>110) h=20+rr()*45;
        else h=30+rr()*70;                      /* near strip */
        if(rr()<.18) h=8+rr()*6;                /* low shop */
        tower(x,z,w,d,h);
      }
    }
  }
  /* ---------- the four signature properties ---------- */
  /* 1. Pyramid casino (gold glass pyramid) */
  (function(){
    const x=1445,z=-2085,gy=12;
    const base=new THREE.CylinderGeometry(0.001,66,58,4,1);
    const pyramid=new THREE.Mesh(base, M.goldGlass);
    pyramid.rotation.y=Math.PI/4; pyramid.position.set(x, gy+29, z);
    scene.add(pyramid);
    SA.ibAdd('conc', x, gy+.6, z, 130, 1.2, 130, 0);
    addCollider({x0:x-66,x1:x+66,z0:z-66,z1:z+66,h:60,y0:gy});
    /* entrance sphinx-ish block */
    SA.ibAdd('twrC', x, gy+6, z+72, 26, 12, 10, 0);
    addCollider({x0:x-13,x1:x+13,z0:z+67,z1:z+77,h:13,y0:gy});
    SA.ibAdd('neonY', x, gy+7.8, z+77.5, 24, .9, .4, 0);
    SA.ibAdd('neonY', x-28, gy+9, z+70, .5, 8, .5, 0);
    SA.ibAdd('neonY', x+28, gy+9, z+70, .5, 8, .5, 0);
    palm(x-80,z+60,1.3); palm(x+80,z+60,1.3); palm(x-80,z-60,1.3); palm(x+80,z-60,1.3);
  })();
  /* 2. Camelot castle casino */
  (function(){
    const x=1445,z=-2215,gy=12;
    SA.ibAdd('castle', x, gy+13, z, 92, 26, 78, 0);
    addCollider({x0:x-46,x1:x+46,z0:z-39,z1:z+39,h:34,y0:gy});
    /* 4 corner towers */
    for(const [tx,tz] of [[-46,-39],[46,-39],[-46,39],[46,39]]){
      SA.ibAdd('castle', x+tx, gy+19, z+tz, 16, 38, 16, 0);
    }
    const cone=new THREE.ConeGeometry(9.5,16,10);
    for(const [tx,tz] of [[-46,-39],[46,-39],[-46,39],[46,39]]){
      const c=new THREE.Mesh(cone, M.castleRed);
      c.position.set(x+tx, gy+46, z+tz); scene.add(c);
      SA.ibAdd('neonP', x+tx, gy+30, z+tz+8.2, 1.2, 12, .4, 0);
    }
    /* gate */
    SA.ibAdd('castle', x, gy+8, z+42, 18, 16, 8, 0);
    SA.ibAdd('neonP', x, gy+12, z+46.4, 16, 1.2, .5, 0);
  })();
  /* 3. Four Dragons pagoda */
  (function(){
    const x=1710, z=-1945, gy=12;
    for(let t=0;t<4;t++){
      const w=74-t*16, h=14, y=gy+t*14;
      SA.ibAdd('twrC', x, y+h/2, z, w, h, w*.9, 0);
      SA.ibAdd('roofC', x, y+h+3.4, z, w*1.24, 6.8, w*1.14, 0);
    }
    addCollider({x0:x-37,x1:x+37,z0:z-33,z1:z+33,h:58,y0:gy});
    SA.ibAdd('neonG', x, gy+57, z, 2, 10, 2, 0);
    SA.ibAdd('neonG', x-30, gy+30, z+34, 4, .8, .3, 0);
    SA.ibAdd('neonG', x+30, gy+30, z+34, 4, .8, .3, 0);
    palm(x-52,z+40,1.2); palm(x+52,z+40,1.2);
  })();
  /* 4. The Dome arena */
  (function(){
    const x=1710, z=-2085, gy=12;
    SA.ibAdd('twrA', x, gy+7, z, 96, 14, 88, 0);
    addCollider({x0:x-48,x1:x+48,z0:z-44,z1:z+44,h:16,y0:gy});
    const dome=new THREE.Mesh(new THREE.SphereGeometry(48,24,12,0,Math.PI*2,0,Math.PI/2), M.domeSkin);
    dome.position.set(x,gy+14,z);
    scene.add(dome);
    SA.ibAdd('neonB', x, gy+15.5, z+45, 30, 1.4, .5, 0);
    SA.ibAdd('neonB', x-49, gy+9, z, .5, 10, 12, 0);
    SA.ibAdd('neonB', x+49, gy+9, z, .5, 10, 12, 0);
  })();
  /* 5. Stratosphere-style needle tower */
  (function(){
    const x=1860, z=-1695, gy=12;
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(7,10,132,12), M.twrA);
    shaft.position.set(x, gy+66, z); scene.add(shaft);
    const pod=new THREE.Mesh(new THREE.CylinderGeometry(17,13,12,12), M.twrB);
    pod.position.set(x, gy+112, z); scene.add(pod);
    const spike=new THREE.Mesh(new THREE.CylinderGeometry(.6,2.4,34,8), M.towerRoof);
    spike.position.set(x, gy+148, z); scene.add(spike);
    addCollider({x0:x-11,x1:x+11,z0:z-11,z1:z+11,h:150,y0:gy});
    SA.ibAdd('neonP', x, gy+121, z, 34, 1, 1, 0);
    SA.ibAdd('neonY', x, gy+119, z, 1, 1, 34, 0);
  })();
  /* ---------- welcome arch + strip palms ---------- */
  (function(){
    const gy1=SA.terrainH(1010,-2450);
    SA.ibAdd('conc', 984, gy1+9, -2452, 3, 18, 3, 0);
    SA.ibAdd('conc', 1038, gy1+9, -2452, 3, 18, 3, 0);
    SA.ibAdd('conc', 1011, gy1+18.5, -2452, 58, 3, 3, 0);
    SA.ibAdd('neonY', 1011, gy1+16.4, -2452, 54, .8, .4, 0);
    addCollider({x0:982,x1:986,z0:-2454,z1:-2450,h:20,y0:gy1});
    addCollider({x0:1036,x1:1040,z0:-2454,z1:-2450,h:20,y0:gy1});
  })();
  function freePalm(x,z,s){
    if(inResv(x-4,x+4,z-4,z+4,2)) return;
    palm(x,z,s);
  }
  for(let z=-2390; z<-1600; z+=62){
    freePalm(1436, z, 1.15); freePalm(1584, z, 1.15);
  }
  for(let x=1030; x<2100; x+=60){
    if(Math.abs(x-1510)<70) continue;
    freePalm(x, -1720, .95); freePalm(x, -2340, .95);
  }
  /* ---------- registry hooks for later parts ---------- */
  SA.casinoList = [
    {name:'The Pyramid',        x:1445, z:-2085, kind:'pyramid'},
    {name:'Camelot Castle',     x:1445, z:-2215, kind:'castle'},
    {name:'Four Dragons',       x:1710, z:-1945, kind:'pagoda'},
    {name:'The Big Dome',       x:1710, z:-2085, kind:'dome'},
  ];
  SA.shops = SA.shops || [];
  SA.shops.push({kind:'gym',      x:1860, z:-2205, name:'Las Venturas Boxing Gym'});
  SA.shops.push({kind:'clothes',  x:1315, z:-1825, name:'Zip Department Store'});
  SA.shops.push({kind:'gun',      x:1180, z:-2340, name:'LV Ammunation'});
  SA.shops.push({kind:'barber',   x:1050, z:-2080, name:'Old Venturas Barbers'});
  SA.shops.push({kind:'food',     x:1250, z:-1630, name:'Burger Shot LV'});
  SA.shops.push({kind:'food',     x:1660, z:-2280, name:'Cluckin Bell LV'});
  SA.hospitals = SA.hospitals || [];
  SA.hospitals.push({x:1120, z:-1955, name:'Las Venturas Hospital', respawn:true});
  SA.safehouses = SA.safehouses || [];
  SA.safehouses.push({x:1990, z:-1700, name:'Rockshore West Safehouse', price:35000, city:'Las Venturas'});
  /* casino door spots (s14 wires the actual gambling) */
  const DOOR={pyramid:78, castle:52, pagoda:44, dome:46};
  for(const c of SA.casinoList){
    SA.addSpot({x:c.x, z:c.z+DOOR[c.kind], r:9, label:'Enter '+c.name, fn:()=>{
      if(SA.openCasino) SA.openCasino(c); else SA.toast(c.name+' opens soon');
    }});
  }
  console.log('[SA] Las Venturas built');
});
console.log('[SA] LV part ready');
})();
