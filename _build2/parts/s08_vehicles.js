/* ============================================================
   PART 08: NEW VEHICLES
   Bike / Boat / Plane / Helicopter (duck-typed into `cars`)
   sharing the base enter/exit/collide/sync pipeline.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
if(!SA) return;
const fwdOf=c=>({x:Math.sin(c.psi), z:Math.cos(c.psi)});

/* exclude flying vehicles from ground car-car collisions */
const baseCollide=Car.prototype.collide;
Car.prototype.collide=function(dt){
  if(this.flying) return;
  const cs=this.circles();
  for(const c of cs)nearBoxes(c.x,c.z,1.3,b=>{const h=circleBox(c.x,c.z,1.25,b);if(!h)return;
   this.p.x+=h.nx*h.pen;this.p.z+=h.nz*h.pen;
   const vn=this.v.x*h.nx+this.v.z*h.nz;
   if(vn<0){this.v.x-=1.3*vn*h.nx;this.v.z-=1.3*vn*h.nz;
    this.hit(-vn);this.v.x*=.9;this.v.z*=.9}});
  for(const o of cars){
   if(o===this||o.flying||cars.indexOf(o)<cars.indexOf(this))continue;
   if(Math.abs(o.p.x-this.p.x)>5.5||Math.abs(o.p.z-this.p.z)>5.5)continue;
   const oc=o.circles();let done=false;
   for(const a of cs)for(const b of oc){
    let dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
    if(d>=2.5||done)continue;
    done=true;d=d||1;dx/=d;dz/=d;
    const pen=2.5-d;
    this.p.x-=dx*pen/2;this.p.z-=dz*pen/2;o.p.x+=dx*pen/2;o.p.z+=dz*pen/2;
    const vr=(this.v.x-o.v.x)*dx+(this.v.z-o.v.z)*dz;
    if(vr>0){const j=vr*.85;
     this.v.x-=j*dx;this.v.z-=j*dz;o.v.x+=j*dx;o.v.z+=j*dz;
     this.hit(vr);if(!o.ai&&o!==cur())o.hit(vr*.5);
     o.psi+=(dx*Math.cos(o.psi)-dz*Math.sin(o.psi))*.01*vr}}
  }
};

/* ================= BIKE ================= */
class Bike extends Car{
  constructor(x,z,psi,color){
    super(x,z,psi||0,'sedan',color===undefined?0x1a1a1e:color,false,false);
    const self=this;
    this.kind='bike';
    this.d={len:2.6,wid:.9,ch:.5,cabW:.4,cabH:.4,cabL:.4,cabY:1,maxS:66,acc:46};
    this.hp=55;
    this.body.children.length=0;
    this.g.remove(this.wheels[0].pv); this.g.remove(this.wheels[3].pv);
    this.wheels=[this.wheels[1],this.wheels[2]];
    this.wheels[0].pv.position.set(0,.38,.92);
    this.wheels[1].pv.position.set(0,.38,-.92);
    const dk=new THREE.MeshStandardMaterial({color:0x2c2c30,roughness:.6,metalness:.5});
    const fr=new THREE.Mesh(new THREE.BoxGeometry(.3,.32,1.7),dk); fr.position.set(0,.8,0); this.body.add(fr);
    const tank=new THREE.Mesh(new THREE.BoxGeometry(.56,.3,.62),this.paintM); tank.position.set(0,1.06,.15); this.body.add(tank);
    const seat=new THREE.Mesh(new THREE.BoxGeometry(.46,.16,.75),dk); seat.position.set(0,.94,-.5); this.body.add(seat);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.7,.07,.07),dk); bar.position.set(0,1.3,.62); this.body.add(bar);
    const fk=new THREE.Mesh(new THREE.BoxGeometry(.09,.72,.09),dk); fk.position.set(0,.85,.88); fk.rotation.x=.28; this.body.add(fk);
    const hl=new THREE.Mesh(new THREE.BoxGeometry(.22,.22,.1),this.headM); hl.position.set(0,1.12,1.02); this.body.add(hl);
    const tl=new THREE.Mesh(new THREE.BoxGeometry(.2,.14,.08),this.tailM); tl.position.set(0,.98,-1.02); this.body.add(tl);
    const ex=new THREE.Mesh(new THREE.BoxGeometry(.72,.12,.12),dk); ex.position.set(0,.48,-.3); this.body.add(ex);
    this.body.traverse(o=>{if(o.isMesh)o.castShadow=true});
  }
  step(dt,thr,steer,brake,hand){
    if(this.dead){thr=0;steer=0;brake=1;hand=false}
    const D=this.d;
    const f0=this.fwd(),vf0=this.v.x*f0.x+this.v.z*f0.z;
    const dl=steer*.72/(1+Math.abs(vf0)*.05);
    this.steerA+=(dl-this.steerA)*Math.min(1,dt*9);
    this.psi+=vf0/2.05*Math.tan(this.steerA)*(hand?1.7:1)*dt;
    const f=this.fwd(),r={x:-f.z,z:f.x};
    let vf=this.v.x*f.x+this.v.z*f.z,vl=this.v.x*r.x+this.v.z*r.z;
    if(thr>0&&vf<D.maxS)vf+=thr*(vf<0?32:D.acc-vf*.24)*dt;
    else if(thr<0)vf+=(vf>1?-34:thr*13)*dt;
    if(vf<-12)vf=-12;
    vf-=vf*.075*dt+Math.sign(vf)*Math.min(Math.abs(vf),1.1*dt);
    if(brake)vf-=Math.sign(vf)*Math.min(Math.abs(vf),32*dt);
    if(hand)vf-=Math.sign(vf)*Math.min(Math.abs(vf),9*dt);
    vl*=Math.exp(-7*dt);
    this.v.x=f.x*vf+r.x*vl;this.v.z=f.z*vf+r.z*vl;
    const ox=this.p.x,oz=this.p.z;
    this.p.x+=this.v.x*dt;this.p.z+=this.v.z*dt;
    this.p.x=clamp(this.p.x,-3550,3550);this.p.z=clamp(this.p.z,-3550,3550);
    const gNew=SA.groundY(this.p.x,this.p.z,(this._gy||0)+2.4);
    if(gNew<SA.WATER_Y-.55){
      const gOld=SA.groundY(ox,oz,(this._gy||0)+2.4);
      if(gNew<=gOld+0.02){this.p.x=ox;this.p.z=oz;this.v.x*=.25;this.v.z*=.25;vf*=.25}
    }
    const ap=(vf-this.vf)/Math.max(dt,1e-3);this.vf=vf;
    this.pitch+=(clamp(ap*.003,-.05,.05)-this.pitch)*Math.min(1,dt*8);
    const lean=clamp(-this.steerA*Math.min(1,Math.abs(vf)/16)*.5-vl*.02,-.55,.55);
    this.roll+=(lean-this.roll)*Math.min(1,dt*7);
    this.vfS=vf;this.vlS=vl;
    this.braking=!!brake||(thr<0&&vf>1);
  }
}

/* ================= BOAT ================= */
class Boat extends Car{
  constructor(x,z,psi,color){
    super(x,z,psi||0,'van',color===undefined?0xe8e4da:color,false,false);
    this.kind='boat';
    this.boat=1;
    this.d={len:6.4,wid:2.5,ch:1.2,cabW:2,cabH:.6,cabL:1.5,cabY:1.9,maxS:36,acc:12};
    this.hp=130;
    this.body.children.length=0;
    for(const w of this.wheels) this.g.remove(w.pv);
    this.wheels=[];
    const hull=new THREE.Mesh(new THREE.BoxGeometry(2.5,.95,6.4),this.paintM); hull.position.y=.5; this.body.add(hull);
    const bow=new THREE.Mesh(new THREE.BoxGeometry(2.3,.8,1.5),this.paintM); bow.position.set(0,.55,3.3); bow.rotation.x=.22; this.body.add(bow);
    const deck=new THREE.Mesh(new THREE.BoxGeometry(2.15,.18,4.6),new THREE.MeshStandardMaterial({color:0xcabf9e,roughness:.9})); deck.position.set(0,1.02,-.4); this.body.add(deck);
    const wind=new THREE.Mesh(new THREE.BoxGeometry(1.7,.55,.1),glass); wind.position.set(0,1.45,-.5); this.body.add(wind);
    const seat=new THREE.Mesh(new THREE.BoxGeometry(1.5,.4,.65),new THREE.MeshStandardMaterial({color:0x9a3324,roughness:.8})); seat.position.set(0,1.12,-1.7); this.body.add(seat);
    this.body.traverse(o=>{if(o.isMesh)o.castShadow=true});
  }
  step(dt,thr,steer,brake,hand){
    const depth=SA.WATER_Y-SA.terrainH(this.p.x,this.p.z);
    if(depth<1.0&&!this.dead){ thr=0; brake=true; }
    Car.prototype.step.call(this,dt,thr,steer*.85,brake,hand);
    this.v.x*=Math.exp(-dt*.45); this.v.z*=Math.exp(-dt*.45);
    const sp=Math.hypot(this.v.x,this.v.z);
    this.wake=(this.wake||0)-dt;
    if(sp>7&&this.wake<=0){
      this.wake=.12;
      const f=fwdOf(this);
      fxDust(this.p.x+f.x*3.4,SA.WATER_Y+.15,this.p.z+f.z*3.4,2,1.7,.85,.88,.97);
    }
  }
  sync(t){
    const g=this.g;
    const gy=SA.WATER_Y-.55+Math.sin(t*1.3+this.p.x*.06)*.07;
    this._gy=gy;
    g.position.set(this.p.x,gy,this.p.z); g.rotation.y=this.psi;
    this.body.rotation.x=this.pitch+Math.sin(t*1.1)*.022;
    this.body.rotation.z=this.roll+Math.sin(t*1.4+1)*.022;
    this.body.position.y=.05;
    this.tailM.emissiveIntensity=this.braking?1.8:.4;
    this.headM.emissiveIntensity=.3+nightK*1.8;
  }
}

/* ================= PLANE + HELI ================= */
class Plane extends Car{
  constructor(x,z,psi,color,heli){
    super(x,z,psi||0,'sedan',color===undefined?0xd8dde2:color,false,false);
    this.kind=heli?'heli':'plane';
    this.heli=!!heli;
    this.d={len:heli?5:7,wid:heli?2:9.6,ch:.9,cabW:1,cabH:1,cabL:1.6,cabY:1.4,maxS:88,acc:26};
    this.hp=95;
    this.py=SA.groundY(x,z)+1.35;
    this.spd=0; this.vy=0; this.air=0; this.bank=0; this.tilt=0; this.lastSteer=0;
    this.body.children.length=0;
    const dk=new THREE.MeshStandardMaterial({color:0x2c2f33,roughness:.7});
    if(heli){
      const cab=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.3,3.4),this.paintM); cab.position.set(0,1.3,-.2); this.body.add(cab);
      const nose=new THREE.Mesh(new THREE.BoxGeometry(1.3,.9,1.2),glass); nose.position.set(0,1.25,1.8); this.body.add(nose);
      const boom=new THREE.Mesh(new THREE.BoxGeometry(.55,.5,3.4),this.paintM); boom.position.set(0,1.55,-3.4); this.body.add(boom);
      const fin=new THREE.Mesh(new THREE.BoxGeometry(.16,1.2,1),this.paintM); fin.position.set(0,2.2,-4.9); this.body.add(fin);
      const tailw=new THREE.Mesh(new THREE.BoxGeometry(2,.14,.7),this.paintM); tailw.position.set(0,1.6,-4.4); this.body.add(tailw);
      for(const s of[-1,1]){
        const sk=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,3.2),dk); sk.position.set(s*.95,.28,-.2); this.body.add(sk);
        const st=new THREE.Mesh(new THREE.BoxGeometry(.12,.6,.12),dk); st.position.set(s*.72,.6,.4); st.rotation.z=s*.4; this.body.add(st);
      }
      this.rotor=new THREE.Group(); this.rotor.position.set(0,2.6,0);
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.3,8),dk); this.rotor.add(hub);
      for(const a of[0,Math.PI/2]){ const bl=new THREE.Mesh(new THREE.BoxGeometry(5.6,.06,.22),dk); bl.rotation.y=a; this.rotor.add(bl); }
      this.body.add(this.rotor);
      this.trot=new THREE.Mesh(new THREE.BoxGeometry(.1,1.1,.1),dk); this.trot.position.set(0,1.7,-5.15); this.body.add(this.trot);
    }else{
      const fus=new THREE.Mesh(new THREE.CylinderGeometry(.8,.62,6.2,10).rotateX(Math.PI/2),this.paintM); fus.position.set(0,1.4,0); this.body.add(fus);
      const nose=new THREE.Mesh(new THREE.CylinderGeometry(.5,.42,1,10).rotateX(Math.PI/2),this.paintM); nose.position.set(0,1.4,3.3); this.body.add(nose);
      const cp=new THREE.Mesh(new THREE.BoxGeometry(1.2,.66,1.5),glass); cp.position.set(0,1.95,1.05); this.body.add(cp);
      const wing=new THREE.Mesh(new THREE.BoxGeometry(9.8,.2,1.6),this.paintM); wing.position.set(0,1.15,-.2); this.body.add(wing);
      const tw=new THREE.Mesh(new THREE.BoxGeometry(3.8,.16,1),this.paintM); tw.position.set(0,1.5,-2.9); this.body.add(tw);
      const fin=new THREE.Mesh(new THREE.BoxGeometry(.16,1.3,1.2),this.paintM); fin.position.set(0,2.2,-3); this.body.add(fin);
      this.rotor=new THREE.Group(); this.rotor.position.set(0,1.4,3.9);
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.4,8).rotateX(Math.PI/2),dk); this.rotor.add(hub);
      for(const a of[0,Math.PI/2]){ const bl=new THREE.Mesh(new THREE.BoxGeometry(.2,2.6,.1),dk); bl.rotation.z=a; this.rotor.add(bl); }
      this.body.add(this.rotor);
    }
    this.body.traverse(o=>{if(o.isMesh)o.castShadow=true});
    for(const w of this.wheels){ w.pv.position.y=.3; }
  }
  step(dt,thr,steer,brake,hand){
    const K=keys;
    if(this.dead){thr=0;steer=0}
    this.lastSteer=steer;
    if(this.heli){ this.heliStep(dt,thr,steer,hand); return; }
    const gy=SA.groundY(this.p.x,this.p.z,this.py+3);
    if(!this.air){
      let sp=this.spd;
      if(thr>0&&!this.dead) sp+=26*dt*(1-sp/88);
      sp-=sp*.16*dt;
      if(hand) sp-=Math.min(sp,26*dt);
      sp=Math.max(0,sp);
      this.spd=sp;
      this.psi+=steer*Math.min(1,sp/15)*1.15*dt;
      const f=fwdOf(this);
      const ox=this.p.x,oz=this.p.z;
      this.p.x+=f.x*sp*dt; this.p.z+=f.z*sp*dt;
      const g2=SA.groundY(this.p.x,this.p.z,this.py+3);
      if(g2<SA.WATER_Y-.55&&sp>2){ this.p.x=ox; this.p.z=oz; this.spd*=.3; }
      this.v.x=f.x*sp; this.v.z=f.z*sp;
      this.py=SA.groundY(this.p.x,this.p.z,this.py+3)+1.35;
      if(sp>30&&K.KeyW&&!this.dead){ this.air=1; this.vy=4.5; }
    }else{
      let sp=this.spd;
      if(thr>0&&!this.dead) sp+=24*dt;
      if(hand) sp-=20*dt;
      sp-=sp*.045*dt;
      sp=clamp(sp,0,88);
      this.spd=sp;
      const stall=sp<26;
      let tvy=(K.KeyW?8.5:0)+(K.KeyS?-16:0)+(stall?-(26-sp)*1.4-5:-2.2);
      this.vy+=(tvy-this.vy)*Math.min(1,dt*1.4);
      this.py+=this.vy*dt;
      if(this.py>620) this.py=620;
      const tb=steer*.62*(0.4+Math.min(1,sp/60)*.6);
      this.bank+=(tb-this.bank)*Math.min(1,dt*2.1);
      this.psi+=this.bank*1.5*dt;
      const f=fwdOf(this);
      this.v.x=f.x*sp; this.v.z=f.z*sp;
      this.p.x+=this.v.x*dt; this.p.z+=this.v.z*dt;
      /* building impact */
      nearBoxes(this.p.x,this.p.z,7,b=>{
        const top=(b.y0||0)+(b.h||12);
        if(this.py<top+1&&this.py>(b.y0||0)-1.5&&!this.dead){
          damageCar(this,60,false); this.spd*=.35; this.vy=Math.min(this.vy,0)-7;
        }
      });
      const g2=SA.groundY(this.p.x,this.p.z,this.py+3);
      if(this.py<=g2+1.3){
        const vv=this.vy;
        this.py=g2+1.3;
        if(vv<-15&&!this.dead) damageCar(this,60,false);
        this.vy=0;
        this.air=0;
        this.spd*=.8;
        this.bank*=.2;
      }
    }
    if(this.dead){ this.air=1; this.vy-=18*dt; this.py+=this.vy*dt;
      const g2=SA.groundY(this.p.x,this.p.z,this.py+3);
      if(this.py<=g2+1.3){ this.py=g2+1.3; this.vy=0; }
    }
    this.p.x=clamp(this.p.x,-3550,3550); this.p.z=clamp(this.p.z,-3550,3550);
    this.flying=this.air?1:0;
    this.vfS=this.spd*Math.sign(this.spd||1);
  }
  heliStep(dt,thr,steer,hand){
    const K=keys;
    this.psi-=steer*1.15*dt;
    this.tilt+=((thr*.42)-this.tilt)*Math.min(1,dt*1.5);
    const f=fwdOf(this);
    this.v.x+=(f.x*thr*22-this.v.x)*Math.min(1,dt*.9);
    this.v.z+=(f.z*thr*22-this.v.z)*Math.min(1,dt*.9);
    this.p.x+=this.v.x*dt; this.p.z+=this.v.z*dt;
    let tv=-2.5;
    if(K.Space) tv=8;
    if(K.ShiftLeft) tv=-10;
    this.vy+=(tv-this.vy)*Math.min(1,dt*1.6);
    this.py+=this.vy*dt;
    if(this.py>580) this.py=580;
    const gy=SA.groundY(this.p.x,this.p.z,this.py+3);
    if(this.py<=gy+1.2){
      this.py=gy+1.2;
      if(this.vy<-9&&!this.dead) damageCar(this,45,false);
      this.vy=0;
    }
    nearBoxes(this.p.x,this.p.z,6,b=>{
      const top=(b.y0||0)+(b.h||12);
      if(this.py<top+.8&&this.py>(b.y0||0)-1.5&&!this.dead){
        damageCar(this,55,false); this.vy=Math.min(this.vy,0)-5;
      }
    });
    this.p.x=clamp(this.p.x,-3550,3550); this.p.z=clamp(this.p.z,-3550,3550);
    this.flying=(this.py>gy+2.4)?1:0;
    this.vfS=Math.hypot(this.v.x,this.v.z);
  }
  sync(t){
    const g=this.g;
    this._gy=this.py;
    g.position.set(this.p.x,this.py,this.p.z); g.rotation.y=this.psi;
    if(this.heli){
      this.body.rotation.x=this.tilt*.55+Math.sin(t*9)*.004;
      this.body.rotation.z=clamp(-this.lastSteer*.22,-.3,.3);
      this.rotor.rotation.y=t*26;
      this.trot.rotation.x=t*38;
    }else{
      this.body.rotation.z=-this.bank*.95;
      this.body.rotation.x=clamp(-this.vy*.03,-.32,.38)+(this.air?0:0);
      this.rotor.rotation.z=t*34;
    }
    this.body.position.y=.05;
    this.tailM.emissiveIntensity=.4;
    this.headM.emissiveIntensity=.6+nightK*1.4;
  }
}

/* ================= SPAWNS ================= */
SA.addBuild('vehicles', ()=>{
  /* bikes */
  SA.bikeSpawns=[
    {x:-352,z:-565,psi:1.2},{x:150,z:-360,psi:2.4},
    {x:905,z:-1775,psi:3.1},{x:1420,z:-2140,psi:0}
  ];
  for(const s of SA.bikeSpawns){
    const b=new Bike(s.x,s.z,s.psi, [0x8a1f1f,0x1f4d8a,0x2d2d33,0xc9a227][(Math.random()*4)|0]);
    b.park=true;
  }
  /* boats at the marina + the bays */
  SA.boatSpawns=SA.boatSpawns||[];
  SA.boatSpawns.push({x:-40,z:-1490,yaw:0});
  SA.boatSpawns.push({x:760,z:-1180,yaw:0.6});
  const bcols=[0xe8e4da,0x33506a,0xb04040,0x40b070,0xe0e0e0];
  for(let i=0;i<SA.boatSpawns.length;i++){
    const s=SA.boatSpawns[i];
    const b=new Boat(s.x,s.z,s.yaw,bcols[i%bcols.length]);
    b.park=true;
  }
  /* aircraft */
  SA.aircraftSpawns=[
    {x:60,z:-950,psi:Math.PI/2,heli:false},
    {x:330,z:-2790,psi:Math.PI/2,heli:false},
    {x:-60,z:-880,psi:Math.PI/2,heli:true},
    {x:520,z:-2700,psi:Math.PI/2,heli:true}
  ];
  for(const s of SA.aircraftSpawns){
    const p=new Plane(s.x,s.z,s.psi,s.heli?0x2d4a2d:0xd8dde2,s.heli);
    p.park=true;
  }
  console.log('[SA] vehicles: bikes/boats/planes/heli spawned');
});
console.log('[SA] vehicle classes ready');
})();
