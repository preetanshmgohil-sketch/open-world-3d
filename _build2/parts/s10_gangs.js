/* ============================================================
   PART 10: GANGS & TURF
   Families / Ballas / Vagos with gang peds, turf zones,
   recruiting (G), gang wars and turf takeover.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
if(!SA) return;

/* ---------- gangs ---------- */
const GANGS = {
  fam:{ name:'Grove Street Families', color:0x2e9e46, fill:'rgba(46,158,70,.19)', line:'rgba(46,158,70,.62)' },
  bal:{ name:'Ballas',               color:0x7b3fa0, fill:'rgba(123,63,160,.19)', line:'rgba(123,63,160,.62)' },
  vag:{ name:'Los Santos Vagos',     color:0xd4b02a, fill:'rgba(212,176,42,.19)', line:'rgba(212,176,42,.62)' }
};
SA.GANGS = GANGS;

/* ---------- turf zones over the core city ---------- */
const ZONES = [
  {name:'Grove Street', gang:'fam', x0:-470, z0:-470, x1:-160, z1:-190},
  {name:'Glen Park',    gang:'fam', x0:-470, z0:-140, x1:-200, z1: 230},
  {name:'Idlewood',     gang:'bal', x0:-160, z0:-470, x1: 140, z1:-190},
  {name:'Jefferson',    gang:'bal', x0: 140, z0:-470, x1: 470, z1:-190},
  {name:'East Beach',   gang:'vag', x0: 160, z0:-150, x1: 470, z1: 230},
  {name:'El Corona',    gang:'vag', x0: 160, z0: 260,  x1: 470, z1: 470}
];
SA.ZONES = ZONES;
const zoneAt = (x,z) => ZONES.find(zo => x>=zo.x0 && x<=zo.x1 && z>=zo.z0 && z<=zo.z1) || null;

SA.gangHeat = 0;
SA.zoneKills = {};
SA.statGangKills = 0;
SA.gangPeds = [];
SA.recruits = [];

/* ---------- gang member ---------- */
let GPID = 0;
class GangPed{
  constructor(gang, x, z){
    this.id = ++GPID;
    this.gang = gang;
    this.home = {x, z};
    this.hp = 100;
    this.state = 'walk';
    this.panic = 0; this.provoked = 0; this.missionTag = null;
    this.rec = false;
    this.sp = rnd(1.2,1.7);
    this.ph = Math.random()*6;
    this.dir = Math.random()*6.28;
    this.t = 0;
    this.fireCd = rnd(.6,1.8);
    this.spread = rnd(.7,1.2);
    const g = this.g = new THREE.Group();
    const col = GANGS[gang].color;
    const cl = new THREE.MeshStandardMaterial({color:col, roughness:.9});
    const pa = new THREE.MeshStandardMaterial({color:new THREE.Color(col).multiplyScalar(.42), roughness:.95});
    const sk = new THREE.MeshStandardMaterial({color:pick(skins), roughness:.85});
    const sc = rnd(.94,1.06); g.scale.set(sc,sc,sc);
    const torso = pedBox(.5,.72,.3, cl, 1.26); g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.2,10,8), sk); head.position.y = 1.82; head.castShadow = true; g.add(head);
    if(Math.random()<.65){
      const hm = new THREE.MeshStandardMaterial({color:new THREE.Color(col).multiplyScalar(1.25), roughness:.9});
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.13,10), hm); hat.position.y = 1.97; g.add(hat);
    }
    this.legs = [-1,1].map(s=>{const p=new THREE.Group(); p.position.set(s*.13,.9,0);
      p.add(pedBox(.18,.85,.2, pa, -.42)); g.add(p); return p});
    this.arms = [-1,1].map(s=>{const p=new THREE.Group(); p.position.set(s*.34,1.56,0);
      p.add(pedBox(.13,.64,.16, cl, -.3)); g.add(p); return p});
    g.position.set(x, 0, z);
    scene.add(g);
  }
  /* ---- base-compatible damage entry ---- */
  hit(vx, vz){
    if(this.state==='rag') return;
    const power = Math.hypot(vx||0, vz||0);
    const dmg = power>8 ? 45 : (power>5 ? 28 : 18);
    this.hp -= dmg;
    this.provoked = 11;
    this.panic = 4;
    fxBlood(this.g.position.x, 1.2, this.g.position.z, (vx||0)*.3, (vz||0)*.3);
    Audio.punch();
    if(this.hp<=0) this.rag(vx, vz, true);
  }
  damage(v, byFriendlies){
    if(this.state==='rag') return;
    this.hp -= v;
    fxBlood(this.g.position.x, 1.2, this.g.position.z, rnd(-.4,.4), rnd(-.4,.4));
    this.provoked = 11;
    if(this.hp<=0) this.rag(rnd(-4,4), rnd(-4,4), !byFriendlies);
  }
  rag(vx, vz, byPlayer){
    if(this.state==='rag') return;
    this.state='rag'; this.hitT=0;
    this.rv = new THREE.Vector3((vx||0)*.9+rnd(-1,1), rnd(4,7), (vz||0)*.9+rnd(-1,1));
    this.spin = rnd(-6,6);
    for(const o of peds){ if(o!==this && o.g && o.g.position.distanceTo(this.g.position)<14) o.panic=Math.max(o.panic,6); }
    SA.gangDown(this, byPlayer);
  }
  walkTo(dt, tx, tz, run){
    const p = this.g.position;
    const dx = tx-p.x, dz = tz-p.z, d = Math.hypot(dx,dz)||1;
    this.dir = Math.atan2(dx,dz);
    const spd = this.sp * (run||1);
    p.x += dx/d * spd * dt; p.z += dz/d * spd * dt;
    this.g.rotation.y = this.dir;
    this.ph += spd*dt*4.6;
    const sw = Math.sin(this.ph)*.7*(run>1.5?1.35:1);
    if(this.legs){ this.legs[0].rotation.x=sw; this.legs[1].rotation.x=-sw;
      this.arms[0].rotation.x=-sw*.8; this.arms[1].rotation.x=sw*.8; }
    if(this.spread>.5) this.spread-=.02;
  }
  idle(dt){
    if(this.spread<1.35) this.spread+=.02;
    this.ph += dt*1.6;
    const sw=Math.sin(this.ph)*.12*this.spread;
    if(this.legs){ this.legs[0].rotation.x=sw; this.legs[1].rotation.x=-sw; }
    if(this.arms){ this.arms[0].rotation.x=-sw; this.arms[1].rotation.x=sw; }
  }
  combat(dt, px, pz, dP, playerY){
    const p = this.g.position;
    this.dir = Math.atan2(px-p.x, pz-p.z);
    this.g.rotation.y = this.dir;
    if(dP>12) this.walkTo(dt, px, pz, 1.55);
    else this.idle(dt);
    this.fireCd -= dt;
    if(this.fireCd<=0 && dP<30){
      this.fireCd = rnd(1.0,1.75);
      const mz = {x:p.x+Math.sin(this.dir)*.6, y:1.4, z:p.z+Math.cos(this.dir)*.6};
      const hitchance = dP<14 ? .5 : (dP<22 ? .3 : .16);
      const ty = playerY + rnd(-.35, .2);
      tracer(mz.x, mz.y, mz.z, px+rnd(-.6,.6), ty, pz+rnd(-.6,.6));
      fxSparks(mz.x, mz.y, mz.z, 4, 2.4, 1, .82, .45);
      Audio.gun();
      if(Math.random()<hitchance){
        const car = cur();
        if(car) damageCar(car, 4+rnd(0,3), true);
        else damagePlayer(3+rnd(0,3));
      }
    }
  }
  update(dt){
    const g=this.g, p=g.position;
    if(this.panic>0) this.panic-=dt;
    if(this.provoked>0) this.provoked-=dt;
    if(this.state==='rag'){
      this.hitT += dt;
      p.addScaledVector(this.rv, dt); this.rv.y -= 26*dt;
      if(p.y<=0){ p.y=0; this.rv.x*=.92; this.rv.z*=.92; this.rv.y=0;
        g.rotation.x += (-1.5-g.rotation.x)*Math.min(1,dt*10); }
      else { g.rotation.x += this.spin*dt; g.rotation.z += this.spin*.5*dt; }
      if(this.hitT>7){
        if(this.gone) return;
        this.gone=true;
        scene.remove(g);
        const i=peds.indexOf(this); if(i>=0)peds.splice(i,1);
        const j=SA.gangPeds.indexOf(this); if(j>=0)SA.gangPeds.splice(j,1);
        const r=SA.recruits.indexOf(this); if(r>=0)SA.recruits.splice(r,1);
      }
      return;
    }
    const car = cur();
    const px = car ? car.p.x : player.x, pz = car ? car.p.z : player.z;
    const dx = px-p.x, dz = pz-p.z, dP = Math.hypot(dx,dz);
    /* --- recruited homie --- */
    if(this.rec){
      if(dP>60){ p.set(px+rnd(-5,5), 0, pz+rnd(-5,5)); this.ph=0; return; }
      /* engage rival gang near us */
      let tgt=null, td=26;
      for(const o of SA.gangPeds){
        if(o.gang==='fam'||o.state==='rag'||o.gone) continue;
        const d=Math.hypot(o.g.position.x-p.x, o.g.position.z-p.z);
        if(d<td){ td=d; tgt=o; }
      }
      this.fireCd -= dt;
      if(tgt && this.fireCd<=0){
        this.fireCd = rnd(.9,1.6);
        const ty = 1.35;
        tracer(p.x+Math.sin(this.dir)*.6, 1.4, p.z+Math.cos(this.dir)*.6,
          tgt.g.position.x+rnd(-.5,.5), ty, tgt.g.position.z+rnd(-.5,.5));
        Audio.gun();
        if(Math.random()<.55) tgt.damage(18+rnd(0,10), true);
      }
      if(dP>3.4) this.walkTo(dt, px, pz, dP>12?2.6:(dP>6?1.9:1.35));
      else this.idle(dt);
      return;
    }
    /* --- enemy / provoked behaviour --- */
    const hostile = dP<42 && (this.provoked>0 || (this.gang!=='fam' && SA.gangHeat>0));
    if(hostile){
      const pY = car ? .9 : 1.1;
      this.combat(dt, px, pz, dP, pY);
      return;
    }
    /* --- wander around home --- */
    this.t -= dt;
    if(this.t<=0){ this.t = rnd(1.5,4); this.dir += (Math.random()-.5)*2.4; }
    if(Math.hypot(p.x-this.home.x, p.z-this.home.z) > 55)
      this.dir = Math.atan2(this.home.x-p.x, this.home.z-p.z);
    const spd = this.sp * (this.panic>0?2.4:1);
    p.x += Math.sin(this.dir)*spd*dt;
    p.z += Math.cos(this.dir)*spd*dt;
    p.x = clamp(p.x, -470, 470); p.z = clamp(p.z, -470, 470);
    g.rotation.y = this.dir;
    this.ph += spd*dt*4.4;
    const sw = Math.sin(this.ph)*.7*(this.panic>0?1.3:1);
    if(this.legs){ this.legs[0].rotation.x=sw; this.legs[1].rotation.x=-sw;
      this.arms[0].rotation.x=-sw*.8; this.arms[1].rotation.x=sw*.8; }
  }
}

/* ---------- death bookkeeping / turf takeover ---------- */
SA.gangDown = function(ped, byPlayer){
  if(ped._down) return;
  ped._down = true;
  if(byPlayer){
    SA.statGangKills++;
    if(ped.gang!=='fam') SA.gangHeat = Math.max(SA.gangHeat, 6.5);
  }
  const z = zoneAt(ped.g.position.x, ped.g.position.z);
  if(z && byPlayer && z.gang!=='fam' && ped.gang!=='fam'){
    SA.zoneKills[z.name] = (SA.zoneKills[z.name]||0)+1;
    if(SA.zoneKills[z.name]>=4){
      z.gang = 'fam';
      SA.zoneKills[z.name] = 0;
      SA.toast('Turf taken: '+z.name+' is Families turf now!');
      for(let i=0;i<3;i++) spawnInZone(z, true);
    }
  }
  if(ped.rec){
    ped.rec=false;
    const r=SA.recruits.indexOf(ped); if(r>=0)SA.recruits.splice(r,1);
    SA.toast('Your homie went down!');
  }
};

/* ---------- spawning ---------- */
function spawnInZone(z, isFam){
  for(let a=0;a<12;a++){
    const x = rnd(z.x0+30, z.x1-30), zz = rnd(z.z0+30, z.z1-30);
    let busy=false;
    nearBoxes(x, zz, 4, b=>{ if(!busy && b.x0<x+3 && b.x1>x-3 && b.z0<zz+3 && b.z1>zz-3) busy=true; });
    if(busy) continue;
    const ped = new GangPed(isFam?'fam':z.gang, x, zz);
    peds.push(ped);
    SA.gangPeds.push(ped);
    return ped;
  }
  return null;
}

SA.addBuild('gangs', ()=>{
  for(const z of ZONES) for(let i=0;i<5;i++) spawnInZone(z);
  console.log('[SA] gangs: '+SA.gangPeds.length+' members across '+ZONES.length+' turfs');
});

/* ---------- recruits, heat decay, zone refill ---------- */
let tickT = 0;
SA.addUpd(dt=>{
  if(SA.gangHeat>0) SA.gangHeat = Math.max(0, SA.gangHeat - dt*.22);
  /* G: recruit / dismiss */
  const gHeld = !!keys.KeyG;
  if(gHeld && !SA._gHeld && !SA.uiOpen && !cur() && player.frozen<=0){
    let best=null, bd=4.6;
    for(const gp of SA.gangPeds){
      if(gp.gang!=='fam'||gp.rec||gp.state==='rag') continue;
      const d = Math.hypot(gp.g.position.x-player.x, gp.g.position.z-player.z);
      if(d<bd){ bd=d; best=gp; }
    }
    if(best && SA.recruits.length<3){
      best.rec = true;
      SA.recruits.push(best);
      Audio.tone(500,900,.08,.15,'square');
      SA.toast('Homie recruited ('+SA.recruits.length+'/3) — respect +');
    } else if(SA.recruits.length>0){
      let d0=null, dd=4.6;
      for(const r of SA.recruits){
        const d=Math.hypot(r.g.position.x-player.x, r.g.position.z-player.z);
        if(d<dd){ dd=d; d0=r; }
      }
      if(d0){ d0.rec=false; SA.recruits.splice(SA.recruits.indexOf(d0),1); SA.toast('Homie dismissed'); }
      else SA.toast('Find a homie nearby to recruit (G)');
    } else {
      SA.toast(best?'You already roll 3 deep':'Recruit Families members in their turf (G)');
    }
  }
  SA._gHeld = gHeld;
  /* refill zones every ~8s */
  tickT += dt;
  if(tickT>8){
    tickT = 0;
    if(SA.gangPeds.length < 46){
      for(const z of ZONES){
        let n=0;
        for(const gp of SA.gangPeds){
          if(gp.gone||gp.state==='rag') continue;
          const p=gp.g.position;
          if(p.x>=z.x0-20&&p.x<=z.x1+20&&p.z>=z.z0-20&&p.z<=z.z1+20&&gp.gang===z.gang) n++;
        }
        if(n<4){ spawnInZone(z, z.gang==='fam'); break; }
      }
    }
  }
});

/* ---------- minimap + big map turf overlay ---------- */
SA.turfDraw = function(mc, px, pz, S2){
  for(const z of ZONES){
    const x0=95+(z.x0-px)*S2, x1=95+(z.x1-px)*S2, z0=95+(z.z0-pz)*S2, z1=95+(z.z1-pz)*S2;
    if(x1<0||x0>190||z1<0||z0>190) continue;
    mc.fillStyle = GANGS[z.gang].fill;
    mc.fillRect(x0, z0, x1-x0, z1-z0);
    mc.strokeStyle = GANGS[z.gang].line; mc.lineWidth = 1;
    mc.strokeRect(x0, z0, x1-x0, z1-z0);
  }
};
SA.turfDrawMap = function(g, W2PX, s){
  for(const z of ZONES){
    g.fillStyle = GANGS[z.gang].fill;
    g.fillRect(W2PX(z.x0), W2PX(z.z0), W2PX(z.x1)-W2PX(z.x0), W2PX(z.z1)-W2PX(z.z0));
  }
};

/* gang members on the maps */
if(SA.blipFns) SA.blipFns.push(cb=>{
  for(const gp of SA.gangPeds){
    if(gp.gone||gp.state==='rag') continue;
    const p = gp.g.position;
    if(Math.abs(p.x-player.x)>300||Math.abs(p.z-player.z)>300) continue;
    cb(p.x, p.z, gp.rec?'#ffffff':GANGS[gp.gang].cssBlip||('#'+new THREE.Color(GANGS[gp.gang].color).getHexString()), gp.rec?5:4);
  }
});

console.log('[SA] gangs part ready');
})();
