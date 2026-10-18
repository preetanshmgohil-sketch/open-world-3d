/* ============================================================
   PART 07: LOS SANTOS EXTRAS
   LS International Airport, Grove Street House,
   Ganton Gym shop, bay jetty near the airport coast.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
if(!SA) return;

SA.addBuild('ls_extra', ()=>{
  /* ================= LOS SANTOS INTERNATIONAL ================= */
  /* runway along x at z -950 (plane spawn row) */
  SA.ibAdd('conc', 60, 6.06, -950, 470, .12, 42, 0);
  for(let i=0;i<24;i++) SA.ibAdd('conc', -158+i*20, 6.14, -950, 8, .05, 1.1, 0);
  for(let i=0;i<20;i++){
    SA.ibAdd('drum', -158+i*24, 6.35, -973, 1.1, .45, 1.1, 0);
    SA.ibAdd('drum', -158+i*24, 6.35, -927, 1.1, .45, 1.1, 0);
  }
  /* taxiway between runway and apron */
  SA.ibAdd('conc', 60, 6.02, -875, 460, .1, 26, 0);
  /* hangars (west) + tower (east) */
  for(const hz of [-830,-1060]){
    SA.ibAdd('conc', -125, 11.4, hz, 66, 10.8, 54, 0);
    SA.ibAdd('roofA', -125, 17.1, hz, 70, 1.2, 58, 0);
    SA.ibAdd('box', -91, 9, hz, 2, 6, 46, 0);
    addCollider({x0:-159, x1:-91, z0:hz-27, z1:hz+27, h:17, y0:6});
  }
  SA.ibAdd('conc', 250, 14, -800, 12, 16, 12, 0);
  SA.ibAdd('wallB', 250, 24.3, -800, 18, 4.8, 18, 0);
  SA.ibAdd('roofC', 250, 26.9, -800, 20, .7, 20, 0);
  addCollider({x0:241, x1:259, z0:-809, z1:-791, h:27, y0:6});
  /* fuel drums + a wind sock */
  for(let i=0;i<6;i++) SA.ibAdd('drum', 180+i*5, 6.7, -1045, 1.4, 1.4, 1.4, 0);
  SA.ibAdd('post', 60, 8.2, -1005, .35, 4.4, .35, 0);
  SA.ibAdd('drum', 62.4, 9.6, -1005, .8, 2.4, .8, 0);
  /* apron markings in front of hangars */
  for(let i=0;i<4;i++) SA.ibAdd('conc', -55, 6.1, -870+i*35, 70, .04, 2, 0);
  /* perimeter fence posts along the south edge */
  for(let i=0;i<23;i++){
    SA.ibAdd('post', -170+i*20, 7.6, -1142, 1, 3, 1, 0);
    SA.ibAdd('rail', -170+i*20+10, 8.2, -1142, 20, .5, .4, 0);
  }
  SA.addSpot({x:60, z:-790, r:13, label:'Los Santos International',
    fn:()=>SA.toast('LS International — planes and a chopper are parked on the apron')});

  /* ================= GROVE STREET HOUSE ================= */
  let gx=-330, gz=-565, found=false;
  const offs=[[0,0],[-26,0],[26,0],[0,-26],[0,26],[-40,-26],[40,26],[52,0],[-52,0],[0,52]];
  for(const o of offs){
    const x=gx+o[0], z=gz+o[1];
    let hit=false;
    nearBoxes(x, z, 13, b=>{
      if(!hit && b.x0 < x+11 && b.x1 > x-11 && b.z0 < z+11 && b.z1 > z-11) hit=true;
    });
    if(!hit){ gx=x; gz=z; found=true; break; }
  }
  if(found){
    SA.addHouse(gx, gz, 15, 11, 4.6, 0, {wall:'wallC', flat:'roofA'});
    SA.addHouse(gx+28, gz+2, 13, 10, 4.2, Math.PI, {wall:'wallD', flat:'roofB'});
    for(let i=0;i<3;i++) SA.ibAdd('drum', gx-10+i*4, SA.terrainH(gx-10+i*4, gz+9)+.6, gz+9, 1.2, 1.2, 1.2, 0);
    SA.safehouses.push({x:gx, z:gz+9, name:'Grove Street House', price:0, city:'Los Santos'});
    SA.addSpot({x:gx, z:gz+9, r:8, label:'Grove Street House',
      fn:()=>SA.toast('Home sweet home, CJ. (Save & sleep coming soon)')});
    console.log('[SA] Grove Street house at '+gx.toFixed(0)+','+gz.toFixed(0));
  } else {
    SA.safehouses.push({x:-330, z:-565, name:'Grove Street House', price:0, city:'Los Santos'});
  }
  /* Ganton Gym */
  SA.shops.push({kind:'gym', x:-420, z:-330, name:'Ganton Gym'});

  /* ================= BAY JETTY (by the airport coast) ================= */
  SA.ibAdd('box', -40, 1.2, -1490, 6, .7, 80, 0);
  for(let i=0;i<6;i++){
    SA.ibAdd('post', -43.4, 1.9, -1455-i*14, 1, 1.1, 1, 0);
    SA.ibAdd('post', -36.6, 1.9, -1455-i*14, 1, 1.1, 1, 0);
  }
  SA.addSpot({x:-40, z:-1447, r:7, label:'Bay jetty',
    fn:()=>SA.toast('A nice spot to watch the ships')});
  SA.boatSpawns = SA.boatSpawns || [];
  SA.boatSpawns.push({x:-72, z:-1518, yaw:.35});
  SA.boatSpawns.push({x:-6, z:-1532, yaw:-.25});
  console.log('[SA] LS extras built');
});
console.log('[SA] LS extras part ready');
})();
