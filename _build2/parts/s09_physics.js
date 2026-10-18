/* ============================================================
   PART 09: PHYSICS & WORLD BOUNDS
   - removes the base ±500 clamps (player + cars)
   - ground-follows on the full terrain (pads, hills, bridges)
   - swimming with stamina/breath
   - road-following traffic AI across the new road network
   - cops spawn near the player anywhere; wanted can reach 6 stars
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
if(!SA){ console.error('[SA] s09: core missing'); return; }

/* ---------- road geometry helpers ---------- */
SA.roadProj = function(R, x, z){
  const pts=R.pts, ys=R.ys||[];
  let total=0; const lens=[];
  for(let i=0;i<pts.length-1;i++){ const L=Math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]); lens.push(L); total+=L; }
  let best={d2:1e18,t:0,y:0,x:0,z:0,seg:0,segT:0,total};
  if(total<1e-6) return best;
  let acc=0;
  for(let i=0;i<pts.length-1;i++){
    const x1=pts[i][0],z1=pts[i][1],dx=pts[i+1][0]-x1,dz=pts[i+1][1]-z1;
    const L2=dx*dx+dz*dz||1e-9;
    let t=((x-x1)*dx+(z-z1)*dz)/L2; t=Math.max(0,Math.min(1,t));
    const px=x1+dx*t, pz=z1+dz*t;
    const d2=(x-px)*(x-px)+(z-pz)*(z-pz);
    if(d2<best.d2){
      const yA=ys[i]!==undefined?ys[i]:0, yB=ys[i+1]!==undefined?ys[i+1]:yA;
      best={d2, t:(acc+lens[i]*t)/total, y:yA+(yB-yA)*t, x:px, z:pz, seg:i, segT:t, total};
    }
    acc+=lens[i];
  }
  return best;
};
SA.ptOnRoad = function(R, s){
  const pts=R.pts; let total=0; const lens=[];
  for(let i=0;i<pts.length-1;i++){ const L=Math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]); lens.push(L); total+=L; }
  let target=Math.max(0,Math.min(1,s))*total, acc=0;
  for(let i=0;i<pts.length-1;i++){
    if(acc+lens[i]>=target||i===pts.length-2){
      const L=lens[i]||1, t=Math.min(1,Math.max(0,(target-acc)/L));
      const x1=pts[i][0],z1=pts[i][1],x2=pts[i+1][0],z2=pts[i+1][1];
      return {x:x1+(x2-x1)*t, z:z1+(z2-z1)*t, fx:(x2-x1)/L, fz:(z2-z1)/L};
    }
    acc+=lens[i];
  }
  const p=pts[pts.length-1]; return {x:p[0], z:p[1], fx:0, fz:1};
};

/* ---------- ground height incl. bridge decks ---------- */
SA._decks = null;
function decks(){
  if(!SA._decks){
    SA._decks = SA.roads.filter(r=>r.bridge).map(r=>({R:r, hw:(r.w||12)/2+1.8, bb:(function(){
      let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
      for(const p of r.pts){ if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0]; if(p[1]<z0)z0=p[1]; if(p[1]>z1)z1=p[1]; }
      return [x0,x1,z0,z1];
    })()}));
  }
  return SA._decks;
}
SA.groundY = function(x, z, refY){
  let g = SA.terrainH(x, z);
  for(const d of decks()){
    const bb=d.bb;
    if(x<bb[0]-16||x>bb[1]+16||z<bb[2]-16||z>bb[3]+16) continue;
    const pr=SA.roadProj(d.R, x, z);
    if(pr.d2 > d.hw*d.hw) continue;
    if(refY!==undefined && refY < pr.y - 2.4) continue;   /* travelling under the deck */
    if(pr.y > g) g = pr.y;
  }
  return g;
};

/* ---------- player on foot: terrain follow + swim, no ±500 clamp ---------- */
SA.swim = 0;
SA.underwater = 0;
window.updatePlayerOnFoot = function(dt){
  const f={x:-Math.sin(player.yaw),z:-Math.cos(player.yaw)},r={x:Math.cos(player.yaw),z:-Math.sin(player.yaw)};
  let mx=(keys.KeyW?1:0)-(keys.KeyS?1:0),mz=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  const l=Math.hypot(mx,mz)||1;
  const moving=(mx!==0||mz!==0);
  const px0=player.x, pz0=player.z;
  let gy=SA.groundY(px0,pz0, player.y+2.6);
  const deep = SA.terrainH(px0,pz0) < SA.WATER_Y-1.2;
  const inWater = deep && player.y < SA.WATER_Y+1.6;

  if(inWater || SA.swim){
    /* ================= swimming ================= */
    SA.swim = 1;
    const sp = (keys.ShiftLeft?7.2:4.4) * ((SA.stamina===undefined?100:SA.stamina)>8?1:.6);
    if(moving){
      const nx=player.x+(f.x*mx+r.x*mz)/l*sp*dt, nz=player.z+(f.z*mx+r.z*mz)/l*sp*dt;
      const g2=SA.groundY(nx,nz, player.y+2.6);
      if(g2 < SA.WATER_Y+0.05 || g2 <= player.y+0.9){ player.x=nx; player.z=nz; }
    }
    const g2=SA.groundY(player.x,player.z, player.y+2.6);
    if(g2 > SA.WATER_Y-.45) SA.swim=0;
    player.y += (SA.WATER_Y-.55+Math.sin(T*2.1)*.07 - player.y)*Math.min(1,dt*5);
    player.vy=0;
    const depth = SA.WATER_Y - SA.terrainH(player.x,player.z);
    SA.underwater = depth>7 ? 1 : 0;
    if(SA.underwater){ SA.breath -= dt*4.5; if(SA.breath<=0) damagePlayer(7*dt); }
    else SA.breath = Math.min(100, SA.breath + dt*18);
    const drain = moving ? dt*(keys.ShiftLeft?2.4:.8) : -dt*.6;
    SA.stamina = Math.max(0, Math.min(100, (SA.stamina===undefined?100:SA.stamina) - drain));
    pModel.ph += (moving?6:0)*dt;
    pModel.legs[0].rotation.x=Math.sin(pModel.ph)*.35;
    pModel.legs[1].rotation.x=-Math.sin(pModel.ph)*.35;
    pModel.arms[0].rotation.x=-Math.sin(pModel.ph)*.5;
    pModel.arms[1].rotation.x=Math.sin(pModel.ph)*.5;
    player.cd-=dt;
    player.hp=Math.min(100,player.hp+1*dt);
    player.x=clamp(player.x,-3550,3550); player.z=clamp(player.z,-3550,3550);
    return;
  }
  /* ================= on land ================= */
  SA.underwater = 0;
  SA.breath = Math.min(100, SA.breath + dt*14);
  const stam = SA.stamina===undefined?100:SA.stamina;
  let sp=keys.ShiftLeft?9:5;
  if(stam<12) sp*=.72;
  if(moving){
    const nx=player.x+(f.x*mx+r.x*mz)/l*sp*dt, nz=player.z+(f.z*mx+r.z*mz)/l*sp*dt;
    /* block climbing crazy cliffs */
    const g2=SA.groundY(nx,nz, player.y+2.6);
    if(g2 <= player.y+2.1){ player.x=nx; player.z=nz; }
  }
  player.vy-=24*dt;player.y+=player.vy*dt;
  gy=SA.groundY(player.x,player.z, player.y+2.6);
  if(player.y<gy){ player.y=gy; player.vy=0; }
  SA.stamina = Math.max(0, Math.min(100, stam + (moving&&keys.ShiftLeft? -dt*7 : dt*11)));
  player.x=clamp(player.x,-3550,3550);
  player.z=clamp(player.z,-3550,3550);
  nearBoxes(player.x,player.z,.5,b=>{const h=circleBox(player.x,player.z,.45,b);if(h){player.x+=h.nx*h.pen;player.z+=h.nz*h.pen}});
  player.cd-=dt;
  for(const c of cars){
    const sp2=Math.hypot(c.v.x,c.v.z);
    for(const q of c.circles()){
      const dx=player.x-q.x,dz=player.z-q.z,d=Math.hypot(dx,dz);
      if(d<1.7&&d>1e-4){
        player.x+=dx/d*(1.7-d);player.z+=dz/d*(1.7-d);
        if(sp2>4&&player.cd<=0){damagePlayer(sp2*2);player.cd=.8;player.vy=5}
      }
    }
    if(c.cop&&Math.hypot(c.p.x-player.x,c.p.z-player.z)<5&&wanted>0)damagePlayer(10*dt);
  }
  player.hp=Math.min(100,player.hp+2*dt);
  const amp=moving?.62:0;
  pModel.ph+=(moving?(keys.ShiftLeft?11:7):0)*dt;
  pModel.legs[0].rotation.x=Math.sin(pModel.ph)*amp;
  pModel.legs[1].rotation.x=-Math.sin(pModel.ph)*amp;
  pModel.arms[0].rotation.x=-Math.sin(pModel.ph)*amp*.8;
  pModel.arms[1].rotation.x=Math.sin(pModel.ph)*amp*.8;
};

/* jump from any ground height (base only allowed y<=0.01) */
addEventListener('keydown', e=>{
  if(e.code!=='Space'||e.repeat) return;
  if(SA.uiOpen||SA.ride) return;
  if(cur()||player.frozen>0||player.deadT>0||SA.swim) return;
  const gy=SA.groundY(player.x,player.z, player.y+2.6);
  if(player.vy<=.05 && player.y<=gy+.09) player.vy=8.5;
}, true);

/* ---------- car physics: keep base, drop clamp, add water block ---------- */
Car.prototype.step=function(dt,thr,steer,brake,hand){
  if(this.dead){thr=0;steer=0;brake=1;hand=false}
  const D=this.d;
  const f0=this.fwd(),vf0=this.v.x*f0.x+this.v.z*f0.z;
  const dl=steer*.6/(1+Math.abs(vf0)*.045);
  this.steerA+=(dl-this.steerA)*Math.min(1,dt*10);
  this.psi+=vf0/2.9*Math.tan(this.steerA)*(hand?1.5:1)*dt;
  const f=this.fwd(),r={x:-f.z,z:f.x};
  let vf=this.v.x*f.x+this.v.z*f.z,vl=this.v.x*r.x+this.v.z*r.z;
  const maxS=D.maxS;
  if(thr>0&&vf<maxS)vf+=thr*(vf<0?30:D.acc-vf*.28)*dt;
  else if(thr<0)vf+=(vf>1?-36:thr*12)*dt;
  if(vf<-14)vf=-14;
  vf-=vf*.08*dt+Math.sign(vf)*Math.min(Math.abs(vf),1.2*dt);
  if(brake)vf-=Math.sign(vf)*Math.min(Math.abs(vf),30*dt);
  if(hand)vf-=Math.sign(vf)*Math.min(Math.abs(vf),8*dt);
  vl*=Math.exp(-(hand?1.1:7)*dt);
  this.v.x=f.x*vf+r.x*vl;this.v.z=f.z*vf+r.z*vl;
  const ox=this.p.x, oz=this.p.z;
  this.p.x+=this.v.x*dt;this.p.z+=this.v.z*dt;
  if(this.p.x<-3550||this.p.x>3550){this.p.x=clamp(this.p.x,-3550,3550);this.v.x*=-.2}
  if(this.p.z<-3550||this.p.z>3550){this.p.z=clamp(this.p.z,-3550,3550);this.v.z*=-.2}
  if(!this.boat){
    const gNew=SA.groundY(this.p.x,this.p.z,(this._gy||0)+2.4);
    if(gNew < SA.WATER_Y-.55){
      const gOld=SA.groundY(ox,oz,(this._gy||0)+2.4);
      if(gNew <= gOld+0.02){   /* only block going deeper; allow escape toward shore */
        this.p.x=ox; this.p.z=oz;
        this.v.x*=.25; this.v.z*=.25;
        vf*=.25;
      }
    }
  }
  const ap=(vf-this.vf)/Math.max(dt,1e-3);this.vf=vf;
  this.pitch+=(clamp(ap*.0035,-.06,.06)-this.pitch)*Math.min(1,dt*8);
  this.roll+=(clamp(-vl*.025-this.steerA*vf*.01,-.1,.1)-this.roll)*Math.min(1,dt*8);
  this.vfS=vf;this.vlS=vl;
  this.braking=!!brake||(thr<0&&vf>1);
};
Car.prototype.sync=function(t){
  const g=this.g;
  const gy=this.boat?SA.WATER_Y:(SA.groundY(this.p.x,this.p.z,(this._gy||0)+2.4));
  this._gy=gy;
  g.position.set(this.p.x,gy,this.p.z);g.rotation.y=this.psi;
  this.body.rotation.x=this.pitch;this.body.rotation.z=this.roll;this.body.position.y=.05;
  const sp=this.vfS||0;
  for(const w of this.wheels){w.w.rotation.x+=sp*.016/.38;if(w.front)w.pv.rotation.y=this.steerA}
  this.tailM.emissiveIntensity=this.braking?1.8:.4;
  this.headM.emissiveIntensity=.3+nightK*1.8;
  if(this.cop){const on=Math.floor(t*6)%2;
   this.red.material.emissiveIntensity=on?1.7:.15;
   this.blue.material.emissiveIntensity=on?.15:1.7}
};

/* ---------- 6-star wanted cap ---------- */
window.damageCar=function(c,dmg,byPlayer){
  if(c.dead)return;
  c.hp-=dmg;
  if(byPlayer&&c.cop)wanted=Math.min(6,wanted+.4);
  if(c.hp<=0){c.hp=0;c.dead=true}
};
window.pedCarCollisions=function(){
  for(const c of cars){
    const sp=Math.hypot(c.v.x,c.v.z);
    if(sp<2.5)continue;
    const cs=c.circles();
    for(const p of peds){
      if(p.state==='rag')continue;
      const pp=p.g.position;
      if(Math.abs(pp.x-c.p.x)>4||Math.abs(pp.z-c.p.z)>4)continue;
      let hitDone=false;
      for(const q of cs){
        if(hitDone)break;
        if(Math.hypot(pp.x-q.x,pp.z-q.z)<1.7){
          p.hit(c.v.x,c.v.z);
          hitDone=true;
          if(c===cur()){wanted=Math.min(6,wanted+.7);cash+=25;Audio.money()}
        }
      }
    }
  }
};
window.meleeHit=function(w){
  const range=WEAPONS[w].range,dmg=w===1?9:4;
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);
  const ax=camera.position.x,ay=camera.position.y,az=camera.position.z;
  let got=false;
  for(const p of peds){
    if(p.state==='rag')continue;
    const pp=p.g.position,dx=pp.x-ax,dz=pp.z-az,dy=pp.y+1.1-ay;
    const d=Math.hypot(dx,dz);
    if(d>range+.7)continue;
    const dot=(dx*dir.x+dz*dir.z)/(d||1);
    if(dot<.3)continue;
    p.hit(dir.x*7,dir.z*7);
    if(p.missionTag)onTargetKilled(p);
    wanted=Math.min(6,wanted+.15);
    got=true;break}
  if(!got)for(const c of cars){
    const dx=c.p.x-ax,dz=c.p.z-az,d=Math.hypot(dx,dz);
    if(d>range+1.2)continue;
    const dot=(dx*dir.x+dz*dir.z)/(d||1);
    if(dot<.3)continue;
    damageCar(c,dmg,true);
    fxSparks(c.p.x,.9,c.p.z,7,3,1,.85,.4);
    Audio.thud();got=true;break}
  if(!got)Audio.punch();else Audio.punch();
  shake(.05);
};
window.pistolShot=function(){
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);
  const ox=camera.position.x+dir.x*.6,oy=camera.position.y+dir.y*.6,oz=camera.position.z+dir.z*.6;
  let bestT=WEAPONS[2].range,hit=null;
  for(const p of peds){
    if(p.state==='rag')continue;
    const pp=p.g.position;
    const dx=pp.x-ox,dy=pp.y+1.05-oy,dz=pp.z-oz;
    const t=dx*dir.x+dy*dir.y+dz*dir.z;
    if(t<0||t>bestT)continue;
    const px=ox+dir.x*t-pp.x,py=oy+dir.y*t-(pp.y+1.05),pz=oz+dir.z*t-pp.z;
    if(px*px+py*py+pz*pz<.5){bestT=t;hit={type:'ped',obj:p}}
  }
  for(const c of cars){
    const cs=c.circles();
    for(const q of cs){
      const dx=q.x-ox,dz=q.z-oz;
      const t=dx*dir.x+dz*dir.z;
      if(t<1||t>bestT)continue;
      const px=ox+dir.x*t-q.x,pz=oz+dir.z*t-q.z,py=oy+dir.y*t-.9;
      if(px*px+pz*pz<1.7&&Math.abs(py)<1.7){bestT=t;hit={type:'car',obj:c}}
    }
  }
  const bt=rayColHit(ox,oy,oz,dir.x,dir.y,dir.z,bestT);
  if(bt!==null&&bt<bestT){bestT=bt;hit={type:'wall'}}
  const hx=ox+dir.x*bestT,hy=oy+dir.y*bestT,hz=oz+dir.z*bestT;
  tracer(ox-dir.x*.5,oy-.15,oz-dir.z*.5,hx,hy,hz);
  if(hit){
    if(hit.type==='ped'){
      hit.obj.hit(dir.x*9,dir.z*9);
      if(hit.obj.missionTag)onTargetKilled(hit.obj);
      wanted=Math.min(6,wanted+.35);
    }else if(hit.type==='car'){
      damageCar(hit.obj,9,true);
      fxSparks(hx,hy,hz,9,5,1,.8,.35);
    }else{
      fxDust(hx,hy,hz,4,1.4,.7,.68,.6);
    }
  }else{
    fxDust(hx,hy,hz,2,1,.8,.75,.7);
  }
  for(const p of peds){if(p.state==='walk'&&p.g.position.distanceTo(_v1.set(ox,1,oz))<14)p.panic=6}
  Audio.gun();
  player.pitch-=clamp(.02,.0,.02);
  shake(.08);
};
window.toggleCar=function(){
  const c=cur();
  if(c){
    const f=c.fwd();
    player.x=c.p.x+(-f.z)*2.7;player.z=c.p.z+f.x*2.7;
    nearBoxes(player.x,player.z,.8,b=>{const h=circleBox(player.x,player.z,.5,b);if(h){player.x+=h.nx*h.pen;player.z+=h.nz*h.pen}});
    player.y=SA.groundY(player.x,player.z);player.vy=0;player.car=null;
    $('mode').textContent='On Foot';
    Audio.tone(320,180,.1,.18,'square');
    return}
  let best=null,bd=7;
  for(const k of cars){
    const d=Math.hypot(k.p.x-player.x,k.p.z-player.z);
    if(d<bd&&!k.dead){bd=d;best=k}}
  if(best){
    player.car=best;
    if(best.ai||best.cop)wanted=Math.min(6,wanted+.8);
    best.ai=false;best.park=false;
    $('mode').textContent='In Vehicle';
    Audio.tone(180,340,.12,.2,'square');
    if(M.mode==='steal'&&best===M.tcar)stealPhase2();
  }
};

/* ---------- road-following traffic AI ---------- */
SA.roadAI=function(c,dt){
  const rd=c._rd, R=SA.roads[rd.ri];
  if(!R){c._rd=null;return {thr:0,steer:0,brake:true,hand:false}}
  const pr=SA.roadProj(R,c.p.x,c.p.z);
  rd.s=pr.t;
  const total=pr.total||1;
  const sA=Math.max(0,Math.min(1,rd.s+(rd.dir>0?13/total:-13/total)));
  const pt=SA.ptOnRoad(R,sA);
  const tfx=pt.fx*rd.dir, tfz=pt.fz*rd.dir;
  const tx=pt.x+(-tfz)*3.6, tz=pt.z+(tfx)*3.6;
  const fw=c.fwd(), ex=tx-c.p.x, ez=tz-c.p.z, cr=fw.x*ez-fw.z*ex, L=Math.hypot(ex,ez)||1;
  let st=clamp(cr/L*-2.2,-1,1);
  const spd=Math.hypot(c.v.x,c.v.z);
  const cruise=rd.cruise||12;
  let thr=0,brake=false;
  if(spd<cruise) thr=.75;
  if(spd>cruise*1.15) brake=true;
  for(const o of cars){if(o===c)continue;
   const dx=o.p.x-c.p.x,dz=o.p.z-c.p.z,a=dx*fw.x+dz*fw.z,l=dx*-fw.z+dz*fw.x;
   if(a>0&&a<13&&Math.abs(l)<2.6){brake=true;thr=0}}
  for(const pd of peds){const dx=pd.g.position.x-c.p.x,dz=pd.g.position.z-c.p.z,a=dx*fw.x+dz*fw.z,l=dx*-fw.z+dz*fw.x;
   if(a>0&&a<10&&Math.abs(l)<2.4){brake=true;thr=0}}
  if(rd.dir>0&&rd.s>0.985)rd.dir=-1;
  else if(rd.dir<0&&rd.s<0.015)rd.dir=1;
  return {thr,steer:st,brake,hand:false};
};
const baseAi=Car.prototype.ai_;
Car.prototype.ai_=function(dt){
  if(this._rd) return SA.roadAI(this,dt);
  return baseAi.call(this,dt);
};

/* ---------- traffic spawner for the whole map ---------- */
SA.spawnRoadTraffic=function(){
  const cands=[];
  for(let i=0;i<SA.roads.length;i++){
    const R=SA.roads[i];
    if(R.bridge||R.drape) continue;
    for(const p of R.pts){
      const d=Math.hypot(p[0]-player.x,p[1]-player.z);
      if(d>90&&d<640){ cands.push(i); break; }
    }
  }
  if(!cands.length) return null;
  const ri=cands[(Math.random()*cands.length)|0], R=SA.roads[ri];
  const s=.08+Math.random()*.84;
  const pt=SA.ptOnRoad(R,s);
  const dir=Math.random()<.5?1:-1;
  const tfx=pt.fx*dir, tfz=pt.fz*dir;
  const x=pt.x+(-tfz)*3.6, z=pt.z+(tfx)*3.6;
  if(SA.terrainH(x,z)<SA.WATER_Y-.4) return null;
  const color=new THREE.Color().setHSL(Math.random(),.6,Math.random()<.4?.12:.45).getHex();
  const c=new Car(x, SA.groundY(x,z), z, pick(TRAFFIC_TYPES), color, true, false);
  c.p.x=x; c.p.z=z;
  c.psi=Math.atan2(tfx,tfz);
  c.dir={x:tfx,z:tfz};
  c.v.x=c.v.z=0; c.stuck=0; c.lastTurn=-1;
  c._rd={ri, dir, s, cruise: R.kind==='hwy'?19: R.kind==='dirt'?9:11};
  return c;
};
const basePlaceCar=window.placeCar;
window.placeCar=function(car,cop){
  if(car._rd){
    const R=SA.roads[car._rd.ri];
    if(R){
      const s=.1+Math.random()*.8, pt=SA.ptOnRoad(R,s);
      car._rd.s=s;
      car.p.x=pt.x; car.p.z=pt.z;
      car.psi=Math.atan2(pt.fx,pt.fz);
      car.v.x=0;car.v.z=0;car.stuck=0;
    }
    return;
  }
  if(cop&&(Math.abs(player.x)>640||Math.abs(player.z)>640)){
    const a=Math.random()*6.283, RR=150+Math.random()*90;
    let x=player.x+Math.cos(a)*RR, z=player.z+Math.sin(a)*RR;
    let best=null,bd=1e9;
    for(const R of SA.roads){
      if(R.bridge) continue;
      const pr=SA.roadProj(R,x,z);
      if(pr.d2<bd){bd=pr.d2;best=pr}
    }
    if(best&&bd<9000){ x=best.x; z=best.z; }
    car.p.x=x;car.p.z=z;
    const dx=player.x-x,dz=player.z-z,dd=Math.hypot(dx,dz)||1;
    car.dir={x:dx/dd,z:dz/dd};
    car.psi=Math.atan2(car.dir.x,car.dir.z);
    car.v.x=0;car.v.z=0;car.stuck=0;car.lastTurn=-1;
    return;
  }
  basePlaceCar(car,cop);
};

/* traffic maintenance (runs ~3Hz) */
SA.addSlow(function(){
  for(let i=cars.length-1;i>=0;i--){
    const c=cars[i];
    if(!c._rd||c===cur()) continue;
    const d=Math.hypot(c.p.x-player.x,c.p.z-player.z);
    if(d>1700){ scene.remove(c.g); cars.splice(i,1); }
  }
  const inLS=Math.abs(player.x)<640&&Math.abs(player.z)<640;
  const want=inLS?2:9;
  let n=0;
  for(const c of cars) if(c._rd&&Math.hypot(c.p.x-player.x,c.p.z-player.z)<700) n++;
  for(let k=0;k<2&&n<want;k++){ if(SA.spawnRoadTraffic()) n++; }
});

/* ---------- respawn at nearest hospital ---------- */
if(!SA.hospitals) SA.hospitals=[];
SA.hospitals.push({x:0, z:-20, name:'All Saints Hospital (Los Santos)'});
SA.hospitals.push({x:915, z:-1745, name:'Palomino Creek Clinic'});
SA.respawnPoint=function(){
  let best=null,bd=1e18;
  for(const h of SA.hospitals){
    const d=(h.x-player.x)*(h.x-player.x)+(h.z-player.z)*(h.z-player.z);
    if(d<bd){bd=d;best=h}
  }
  return best;
};
console.log('[SA] physics ready (bounds free, swimming, road traffic)');
})();
