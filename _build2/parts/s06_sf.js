/* ============================================================
   PART 06: SAN FIERRO  (hillside city: Doherty warehouses,
   Calton row houses, Downtown towers, Juniper, Chinatown,
   Peak Park + marina piers)
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
const M = SA.MAT;
const tower = SA.cityTower, palm = SA.cityPalm, rr = SA.cityRR;
SA.ibShape('pine','cone',M.conif,true);
SA.ibShape('neonR','box',new THREE.MeshStandardMaterial({color:0xb03430, emissive:0xc04038, emissiveIntensity:.8, roughness:.6}),false);

SA.addBuild('san fierro', ()=>{
  const XS=[-3360,-3250,-3140,-3030,-2920,-2810,-2700,-2590];
  const ZS=[-1240,-1340,-1440,-1540,-1650,-1770,-1890,-2010,-2120];
  const WALLS=['wallA','wallB','wallC','wallD'];

  function district(x,z){
    if(x<-2980) return z>-1560 ? 'doherty' : 'juniper';
    if(z>-1560) return 'calton';
    if(z>-1960) return 'downtown';
    if(x>-2760) return 'peak';
    return 'chinatown';
  }
  function rowHouses(x0,x1,z,facing){
    /* narrow stepped row houses along a street edge */
    let x=x0+4;
    while(x<x1-4){
      const w=6.5+rr()*2, d=8+rr()*2, h=6+rr()*4.5;
      const zz=z + (facing>0? d/2 : -d/2);
      SA.addHouse(x+w/2, zz, w, d, h, 0, {wall:WALLS[(rr()*4)|0], flat:true, roofH:.3});
      x+=w+1.2;
    }
  }
  function warehouse(x,z,w,d,h){
    const gy=SA.terrainH(x,z);
    SA.ibAdd('wallD', x, gy+h/2, z, w, h, d, 0);
    SA.ibAdd('towerRoof', x, gy+h+.4, z, w*1.04, .9, d*1.04, 0);
    addCollider({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,h:h+1,y0:gy});
    if(rr()<.5) SA.ibAdd('box', x-w/2+3, gy+.6, z+d/2+2, 2, 1.2, 2, 0);
    if(rr()<.5) SA.ibAdd('box', x+w/2-3, gy+.6, z-d/2-2, 2, 1.2, 2, 0);
  }

  SA.cityBlocks = SA.cityBlocks || [];
  for(let i=0;i<XS.length-1;i++){
    for(let j=0;j<ZS.length-1;j++){
      const bx0=XS[i]+12, bx1=XS[i+1]-12, bz0=ZS[j]+12, bz1=ZS[j+1]-12;
      const cxm=(bx0+bx1)/2, czm=(bz0+bz1)/2;
      const dist=district(cxm,czm);
      SA.cityBlocks.push({x0:bx0-8,x1:bx1+8,z0:bz0-8,z1:bz1+8,c: dist==='downtown'?'#3c424a':(dist==='peak'?'#4a5748':'#454a50')});
      if(dist==='peak'){
        /* park: trees + benches */
        for(let k=0;k<7;k++){
          const px=bx0+6+rr()*(bx1-bx0-12), pz=bz0+6+rr()*(bz1-bz0-12);
          const s=.9+rr()*.7;
          SA.ibAdd('pine', px, SA.terrainH(px,pz)+2.2*s, pz, 2.2*s, 4.4*s, 2.2*s, 0);
        }
        SA.ibAdd('box', cxm-8, SA.terrainH(cxm-8,czm)+.6, czm, 4, 1.2, 1.2, 0);
        SA.ibAdd('box', cxm+8, SA.terrainH(cxm+8,czm)+.6, czm+4, 4, 1.2, 1.2, 0);
        continue;
      }
      if(dist==='doherty'){
        const n=2+((rr()*2)|0);
        for(let k=0;k<n;k++){
          const w=24+rr()*16, d=18+rr()*12;
          const x=bx0+w/2+rr()*Math.max(1,bx1-bx0-w), z=bz0+d/2+rr()*Math.max(1,bz1-bz0-d);
          warehouse(x,z,w,d, 8+rr()*7);
        }
        continue;
      }
      if(dist==='calton'){
        rowHouses(bx0,bx1,bz0,+1);
        rowHouses(bx0,bx1,bz1,-1);
        continue;
      }
      if(dist==='downtown'){
        const n=2+((rr()*2)|0);
        for(let k=0;k<n;k++){
          const w=17+rr()*20, d=15+rr()*18;
          const x=bx0+w/2+rr()*Math.max(1,bx1-bx0-w), z=bz0+d/2+rr()*Math.max(1,bz1-bz0-d);
          tower(x,z,w,d, 28+rr()*58);
        }
        continue;
      }
      if(dist==='juniper'){
        const n=2+((rr()*3)|0);
        for(let k=0;k<n;k++){
          const w=9+rr()*7, d=8+rr()*5, x=bx0+w/2+rr()*Math.max(1,bx1-bx0-w), z=bz0+d/2+rr()*Math.max(1,bz1-bz0-d);
          const tall=rr()<.3;
          SA.addHouse(x,z,w,d, tall? 16+rr()*8 : 6+rr()*3.5, 0, {wall:WALLS[(rr()*4)|0], flat:tall?true:false});
        }
        continue;
      }
      /* chinatown: mid-rise with signs */
      const n=2+((rr()*2)|0);
      for(let k=0;k<n;k++){
        const w=15+rr()*14, d=13+rr()*10;
        const x=bx0+w/2+rr()*Math.max(1,bx1-bx0-w), z=bz0+d/2+rr()*Math.max(1,bz1-bz0-d);
        const h=12+rr()*14;
        tower(x,z,w,d,h);
        if(rr()<.7){
          const c=['neonP','neonY','neonR','neonG'][(rr()*4)|0];
          SA.ibAdd(c, x, SA.terrainH(x,z)+h*.55, z+d/2+.2, Math.min(w*.6,10), 1.1, .4, 0);
        }
      }
    }
  }
  /* ---------- Chinatown gate (arches over the -2010 street, mid-block) ---------- */
  (function(){
    const gx=-2755, gz=-2010;
    const gy=SA.terrainH(gx,gz);
    /* pillars stand north and south of the roadway, not in it */
    SA.ibAdd('neonR', gx, gy+4.4, gz-7, 2.2, 8.8, 2.2, 0);
    SA.ibAdd('neonR', gx, gy+4.4, gz+7, 2.2, 8.8, 2.2, 0);
    SA.ibAdd('neonR', gx, gy+9.4, gz, 2.6, 1.6, 18, 0);
    SA.ibAdd('roofC', gx, gy+11.2, gz, 4.6, 3.2, 24, 0);
    SA.ibAdd('roofC', gx, gy+13.8, gz, 3.2, 2.4, 12, 0);
    addCollider({x0:gx-1.1,x1:gx+1.1,z0:gz-8.1,z1:gz-5.9,h:9,y0:gy});
    addCollider({x0:gx-1.1,x1:gx+1.1,z0:gz+5.9,z1:gz+8.1,h:9,y0:gy});
  })();
  /* ---------- Peak Park monument ---------- */
  (function(){
    const mx=-2650, mz=-2060, gy=SA.terrainH(mx,mz);
    SA.ibAdd('conc', mx, gy+2, mz, 10, 4, 10, 0);
    SA.ibAdd('twrA', mx, gy+16, mz, 3, 24, 3, 0);
    SA.ibAdd('neonB', mx, gy+29, mz, 3.4, 2, 3.4, 0);
    addCollider({x0:mx-5,x1:mx+5,z0:mz-5,z1:mz+5,h:6,y0:gy});
    SA.addSpot({x:mx, z:mz+9, r:9, label:'Peak Park viewpoint', fn:()=>SA.toast('You can see the whole bay from here!')});
    for(const [px,pz] of [[-2700,-2080],[-2690,-2030],[-2610,-2090],[-2600,-2020],[-2720,-2110]]){
      const s=1.1+rr()*.5;
      SA.ibAdd('pine', px, SA.terrainH(px,pz)+2.4*s, pz, 2.4*s, 4.8*s, 2.4*s, 0);
    }
  })();
  /* ---------- marina piers + boat spawns ---------- */
  SA.boatSpawns = SA.boatSpawns || [];
  (function(){
    /* waterfront quay at the bay shore (x ~ -2450) */
    SA.ibAdd('box', -2485, 1.0, -1700, 24, .6, 170, 0);
    for(const pz of [-1650,-1700,-1750]){
      SA.ibAdd('box', -2440, 1.2, pz, 50, .7, 2.6, 0);
      SA.ibAdd('post', -2417, 1.6, pz-1.2, 1,1,1,0);
      SA.ibAdd('post', -2417, 1.6, pz+1.2, 1,1,1,0);
      SA.boatSpawns.push({x:-2440, z:pz+2.9, yaw:Math.PI/2});
    }
    SA.addSpot({x:-2465, z:-1700, r:8, label:'Bay marina', fn:()=>SA.toast('Lovely spot for a boat ride')});
  })();
  /* ---------- cranes at Doherty docks ---------- */
  for(const [cx,cz] of [[-3330,-2130],[-3330,-2190]]){
    const gy=SA.terrainH(cx,cz);
    SA.ibAdd('conc', cx, gy+9, cz, 1.6, 18, 1.6, 0);
    SA.ibAdd('conc', cx+7, gy+17.2, cz, 16, 1.2, 1.2, 0);
    SA.ibAdd('conc', cx+10, gy+15.6, cz, .4, 3.2, .4, 0);
  }
  /* ---------- registry ---------- */
  SA.shops.push({kind:'gym',     x:-3300, z:-1700, name:'Juniper Gym'});
  SA.shops.push({kind:'barber',  x:-2900, z:-2050, name:'Chinatown Barbers'});
  SA.shops.push({kind:'clothes', x:-2700, z:-1300, name:'Calton Binco'});
  SA.shops.push({kind:'food',    x:-2810, z:-1890, name:'Downtown Pizza'});
  SA.shops.push({kind:'food',    x:-3030, z:-1440, name:'Doherty Burger'});
  SA.shops.push({kind:'gun',     x:-3140, z:-1770, name:'Juniper Ammunation'});
  SA.hospitals.push({x:-3010, z:-1360, name:'San Fierro Hospital', respawn:true});
  SA.safehouses.push({x:-3150, z:-1360, name:'Doherty Garage', price:20000, city:'San Fierro'});
  console.log('[SA] San Fierro built');
});
console.log('[SA] SF part ready');
})();
