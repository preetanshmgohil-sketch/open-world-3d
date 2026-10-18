/* ============================================================
   PART 12: 6-STAR POLICE ESCALATION
   Fix: player position tracks the driven car (cop AI + minimap).
   Stars escalate: police > SWAT vans > FBI > Army, + roadblocks.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
if(!SA) return;

/* keep player.x/z tracking the car so all base AI targets the car */
SA.addUpd(()=>{
  const c = cur();
  if(c){ player.x = c.p.x; player.z = c.p.z; }
});

/* ---------- cop spawner ---------- */
function spawnCop(kind){
  const specs = {
    police:{types:['sedan','sedan','taxi'], color:0x111111, hp:100},
    swat:  {types:['van'],                  color:0x14161a, hp:160},
    fbi:   {types:['sports'],               color:0x0c0c10, hp:135},
    army:  {types:['truck'],                color:0x39412d, hp:300}
  };
  const sp = specs[kind] || specs.police;
  const c = new Car(0, 0, 0, pick(sp.types), sp.color, true, true);
  c.copKind = kind;
  c.hp = sp.hp;
  c.shootT = rnd(.5,1.2);
  if(kind==='fbi') c.d = Object.assign({}, c.d, {maxS:74, acc:44});
  if(kind==='army') c.d = Object.assign({}, c.d, {maxS:30});
  placeCar(c, true);
  return c;
}
SA.spawnCop = spawnCop;

/* ---------- roadblock ahead of the player at 4+ stars ---------- */
function roadblock(f, pxx, pzz, stars){
  const bx = pxx + f.x*135, bz = pzz + f.z*135;
  const perpX = -f.z, perpZ = f.x;
  const n = stars>=5 ? 3 : 2;
  for(let i=0;i<n;i++){
    const off = (i-(n-1)/2)*7.5;
    const kind = (stars>=6 && i===1) ? 'army' : 'police';
    const c = new Car(bx+perpX*off, bz+perpZ*off, Math.atan2(perpX,perpZ), kind==='army'?'truck':'sedan',
      kind==='army'?0x39412d:0x111111, true, true);
    c.copKind = kind;
    c.hp = kind==='army'?300:100;
    c.shootT = rnd(.6,1.4);
  }
}
SA.roadblockNow = roadblock;

/* ---------- replacement copUpdate ---------- */
let rbT = 10;
window.copUpdate = function(dt){
  const stars = Math.min(6, Math.floor(wanted));
  const cops = cars.filter(c=>c.cop);
  copTimer -= dt;
  const want = stars;
  if(cops.length < want && copTimer <= 0){
    let kind = 'police';
    if(stars>=6 && !cops.some(c=>c.copKind==='army') && Math.random()<.75) kind='army';
    else if(stars>=5 && !cops.some(c=>c.copKind==='fbi') && Math.random()<.65) kind='fbi';
    else if(stars>=4 && !cops.some(c=>c.copKind==='swat') && Math.random()<.7) kind='swat';
    else if(cops.filter(c=>c.copKind==='police').length < 1) kind='police';
    else kind = Math.random()<.5 ? 'police' : (stars>=4? (cops.some(c=>c.copKind==='swat')?'swat':'fbi') : 'police');
    spawnCop(kind);
    copTimer = Math.max(1.3, 3.1 - stars*.35);
  }
  /* trim distant surplus */
  if(cops.length > want+2){
    let far=null, fd=-1;
    for(const c of cops){
      const d = Math.hypot(c.p.x-player.x, c.p.z-player.z);
      if(d>fd){ fd=d; far=c; }
    }
    if(far && fd > 220){ scene.remove(far.g); cars.splice(cars.indexOf(far),1); }
  }
  if(wanted < .5 && cops.length > 0){
    const k = cops[0];
    scene.remove(k.g); cars.splice(cars.indexOf(k),1);
  }
  let near = 1e9;
  const pc = cur();
  const tx0 = pc ? pc.p.x : player.x, tz0 = pc ? pc.p.z : player.z;
  for(const c of cops){
    const d = Math.hypot(tx0-c.p.x, tz0-c.p.z);
    if(d < near) near = d;
    if(d > 420) placeCar(c, true);
    c.shootT -= dt;
    const dmgK = c.copKind==='swat' ? 1.7 : (c.copKind==='fbi' ? 1.5 : (c.copKind==='army' ? 2.4 : 1));
    const range = c.copKind==='army' ? 38 : 32;
    if(c.shootT<=0 && d<range && wanted>=1){
      c.shootT = c.copKind==='fbi' ? rnd(.8,1.5) : (c.copKind==='army' ? rnd(1.4,2.4) : rnd(1.1,2.2));
      const tx = tx0+rnd(-.9,.9), ty = (pc?1.2:player.y+1.1)+rnd(-.2,.5), tz = tz0+rnd(-.9,.9);
      tracer(c.p.x, 1.1, c.p.z, tx, ty, tz);
      Audio.burst(.09,1500,.8,.16);
      if(Math.random() < (c.copKind==='army'?.7:.62)){
        if(pc) damageCar(pc, Math.round(4*dmgK), false);
        else damagePlayer(rnd(4,9)*dmgK);
      }
    }
  }
  /* roadblocks at 4+ stars while driving */
  if(stars>=4 && pc && Math.hypot(pc.v.x,pc.v.z)>7){
    rbT -= dt;
    if(rbT<=0){
      rbT = rnd(11,17);
      const f = pc.fwd();
      roadblock(f, pc.p.x, pc.p.z, stars);
    }
  }
  return near;
};

console.log('[SA] 6-star police escalation ready');
})();
