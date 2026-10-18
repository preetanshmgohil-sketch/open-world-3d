/* ============================================================
   PART 03: ROADS / HIGHWAYS / BRIDGES
   Builds all new road ribbons from SA.roads data: highways,
   country routes, dirt trails, city grids, street furniture
   (lights, traffic signals), guard barriers, Julius Thruway
   viaduct and the Gant suspension bridge.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
SA.roadMap = SA.roadMap || {};

/* ---------- materials ---------- */
const dirtTex = canvasTex(96,96,(g,w,h)=>{
  g.fillStyle='#6b5a41';g.fillRect(0,0,w,h);
  for(let i=0;i<900;i++){const v=Math.random()*40|0;g.fillStyle='rgba('+(90+v)+','+(76+v)+','+(54+v)+',.5)';g.fillRect(Math.random()*w,Math.random()*h,2,2)}
  for(let i=0;i<40;i++){g.fillStyle='rgba(60,50,36,.35)';g.beginPath();g.ellipse(Math.random()*w,Math.random()*h,rnd(3,9),rnd(2,5),0,0,7);g.fill()}
},[6,6]);
const dirtMat = new THREE.MeshStandardMaterial({map:dirtTex,roughness:1});
const barrierMat = new THREE.MeshStandardMaterial({color:0xb9bcbd,roughness:.85,side:THREE.DoubleSide});
const towerMat = new THREE.MeshStandardMaterial({color:0x9b5244,roughness:.8});
const cableMat = new THREE.MeshStandardMaterial({color:0x51555a,roughness:.55,metalness:.5});
const poleMat2 = new THREE.MeshStandardMaterial({color:0x3d4145,roughness:.8});
const tlPoleMat = new THREE.MeshStandardMaterial({color:0x2f3336,roughness:.8});

/* ---------- ribbon geometry ---------- */
function ribbonGeo(pts, ys, w, vUnit, yAdd, uScale){
  const pos=[],uv=[],idx=[];
  let vAcc=0, base=0;
  for(let i=0;i<pts.length-1;i++){
    const x1=pts[i][0],z1=pts[i][1],y1=ys[i]+(yAdd||0);
    const x2=pts[i+1][0],z2=pts[i+1][1],y2=ys[i+1]+(yAdd||0);
    const dx=x2-x1,dz=z2-z1,L=Math.hypot(dx,dz);
    if(L<1e-4) continue;
    const nx=-dz/L,nz=dx/L,hw=w/2;
    pos.push(x1+nx*hw,y1,z1+nz*hw,  x1-nx*hw,y1,z1-nz*hw,  x2+nx*hw,y2,z2+nz*hw,  x2-nx*hw,y2,z2-nz*hw);
    const u0=uScale?uScale[0]:0, u1=uScale?uScale[1]:1;
    const v0=vAcc/vUnit, v1=(vAcc+L)/vUnit;
    uv.push(u0,v0, u1,v0, u0,v1, u1,v1);
    idx.push(base,base+2,base+1, base+1,base+2,base+3);
    base+=4; vAcc+=L;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function wallGeo(pts, ys, off, h){
  /* vertical ribbon: off = signed lateral offset */
  const pos=[],uv=[],idx=[];
  let vAcc=0,base=0;
  for(let i=0;i<pts.length-1;i++){
    const x1=pts[i][0],z1=pts[i][1],y1=ys[i];
    const x2=pts[i+1][0],z2=pts[i+1][1],y2=ys[i+1];
    const dx=x2-x1,dz=z2-z1,L=Math.hypot(dx,dz);
    if(L<1e-4) continue;
    const nx=-dz/L,nz=dx/L;
    const ax=x1+nx*off,az=z1+nz*off, bx=x2+nx*off,bz=z2+nz*off;
    pos.push(ax,y1,az, ax,y1+h,az, bx,y2,bz, bx,y2+h,bz);
    uv.push(0,vAcc/6, 1,vAcc/6, 0,(vAcc+L)/6, 1,(vAcc+L)/6);
    idx.push(base,base+2,base+1, base+1,base+2,base+3);
    base+=4; vAcc+=L;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function resample(pts, step, yAdd){
  const out=[],ys=[];
  for(let i=0;i<pts.length-1;i++){
    const x1=pts[i][0],z1=pts[i][1],x2=pts[i+1][0],z2=pts[i+1][1];
    const dx=x2-x1,dz=z2-z1,L=Math.hypot(dx,dz);
    const n=Math.max(1,Math.round(L/step));
    for(let k=0;k<n;k++){
      const t=k/n,x=x1+dx*t,z=z1+dz*t;
      out.push([x,z]); ys.push(SA.terrainH(x,z)+(yAdd||.12));
    }
  }
  const lx=pts[pts.length-1][0],lz=pts[pts.length-1][1];
  out.push([lx,lz]); ys.push(SA.terrainH(lx,lz)+(yAdd||.12));
  return {pts:out,ys};
}
function ptAt(pts,ys,dist){
  let acc=0;
  for(let i=0;i<pts.length-1;i++){
    const dx=pts[i+1][0]-pts[i][0],dz=pts[i+1][1]-pts[i][1],L=Math.hypot(dx,dz);
    if(acc+L>=dist){
      const t=(dist-acc)/Math.max(L,1e-4);
      const nx=-dz/L,nz=dx/L;
      return {x:pts[i][0]+dx*t,z:pts[i][1]+dz*t,y:ys[i]+(ys[i+1]-ys[i])*t,nx,nz};
    }
    acc+=L;
  }
  return null;
}
function roadLen(pts){
  let s=0;
  for(let i=0;i<pts.length-1;i++)s+=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);
  return s;
}

/* ---------- street furniture collectors ---------- */
const poles=[],heads=[],pools=[];
function addLight(x,y,z,nx,nz){
  const px=x+nx*1.2,pz=z+nz*1.2;
  poles.push([px,y+4.3,pz]);
  heads.push([px-nx*.7,y+8.62,pz-nz*.7]);
  pools.push([px-nx*1.6,y+.32,pz-nz*1.6]);
}
const tlPoles=[],tlHeads=[],tlBulbs=[];
function addTrafficLight(x,y,z,sx,sz){
  tlPoles.push([x,y+3.2,z]);
  tlHeads.push([x+sx*.5,y+6.6,z+sz*.5]);
  tlBulbs.push([x+sx*.5,y+7.05,z+sz*.5],[x+sx*.5,y+6.55,z+sz*.5],[x+sx*.5,y+6.05,z+sz*.5]);
}
const pillars=[];
function addPillar(x,ytop,z,rad){
  const bot=SA.terrainH(x,z)-1.2;
  const h=Math.max(1,ytop-bot);
  pillars.push([x,bot+h/2,z,rad||1,h,rad||1]);
}

/* ---------- build ---------- */
SA.addBuild('roads', ()=>{
  const hwyRib=[];    /* merged geometry buckets per material */
  const posIdx=0;
  for(let i=0;i<SA.roads.length;i++){
    const r=SA.roads[i];
    SA.roadMap[r.name]=r;
    let pts=r.pts, ys=r.ys, yAdd=.05+ (i%4)*.012;
    if(r.drape){ const rs=resample(r.pts,12,.13); pts=rs.pts; ys=rs.ys; yAdd=0; }
    const isDirt=r.kind==='dirt';
    const mat=r.bridge?roadMat:(isDirt?dirtMat:roadMat);
    const mesh=new THREE.Mesh(ribbonGeo(pts,ys,r.w,55,yAdd),mat);
    mesh.receiveShadow=true;
    mesh.userData.road=r;
    scene.add(mesh);
    if(r.bridge) SA.props.bridges=(SA.props.bridges||[]).concat([r]);
    /* guard barriers on highways + bridges */
    if(r.kind==='hwy'||r.bridge){
      if(r.name!=='LS Runway'&&r.name!=='VM Runway'){
        const wl=new THREE.Mesh(wallGeo(pts,ys.map(y=>y+yAdd), r.w/2+.42, .8),barrierMat);
        const wr=new THREE.Mesh(wallGeo(pts,ys.map(y=>y+yAdd),-(r.w/2+.42), .8),barrierMat);
        scene.add(wl);scene.add(wr);
      }
      /* supports: viaduct/bridge pillars */
      if(r.bridge||r.name.includes('Julius')){
        const L=roadLen(r.pts);
        for(let d=28;d<L-20;d+=52){
          const p=ptAt(r.pts,r.ys,d);
          if(p) addPillar(p.x,p.y-.55,p.z,r.bridge?1.25:1.0);
        }
      }
      /* street lights */
      const L=roadLen(pts);
      let side=1;
      for(let d=40;d<L-20;d+=88){
        const p=ptAt(pts,ys,d);
        if(p){ addLight(p.x,p.y,p.z,p.nx*side,p.nz*side); side*=-1; }
      }
    }else if(r.kind==='street'&&(r.w>=8)){
      const L=roadLen(pts);
      let side=1;
      for(let d=70;d<L-30;d+=140){
        const p=ptAt(pts,ys,d);
        if(p){ addLight(p.x,p.y,p.z,p.nx*side,p.nz*side); side*=-1; }
      }
    }
  }
  /* instanced furniture */
  inst(new THREE.CylinderGeometry(.13,.17,8.6,6),poleMat2,poles);
  inst(new THREE.BoxGeometry(1.5,.32,.55),lampHeadMat,heads);
  inst(new THREE.PlaneGeometry(11,11).rotateX(-Math.PI/2),poolMat,pools);
  inst(new THREE.CylinderGeometry(1.05,1.35,1,10),new THREE.MeshStandardMaterial({color:0x9096a0,roughness:.9}),pillars);
  /* city traffic lights (LV + SF grid crossings) */
  for(let xi=0;xi<9;xi++)for(let zi=0;zi<7;zi++){
    const x=990+xi*110, z=-2410+zi*130;
    if(x<960||x>2140)continue;
    addTrafficLight(x-9,12,z-9,-1,-1);
    addTrafficLight(x+9,12,z+9,1,1);
  }
  for(let xi=0;xi<8;xi++)for(let zi=0;zi<9;zi++){
    const x=-3360+xi*110, z=-1240+zi*110;
    const h=SA.terrainH(x,z);
    if(h<2)continue;
    addTrafficLight(x-8,h,z-8,-1,-1);
    addTrafficLight(x+8,h,z+8,1,1);
  }
  inst(new THREE.CylinderGeometry(.12,.16,6.4,6),tlPoleMat,tlPoles);
  inst(new THREE.BoxGeometry(.46,1.9,.34),darkMat,tlHeads);
  inst(new THREE.BoxGeometry(.2,.2,.14),bulbG,tlBulbs.filter((_,i)=>i%3===0));
  inst(new THREE.BoxGeometry(.2,.2,.14),bulbA,tlBulbs.filter((_,i)=>i%3===1));
  inst(new THREE.BoxGeometry(.2,.2,.14),bulbR,tlBulbs.filter((_,i)=>i%3===2));
  /* intersection asphalt + sidewalks for the two new city grids */
  const crossA=[],slabs=[];
  for(let xi=0;xi<9;xi++)for(let zi=0;zi<7;zi++){
    const x=990+xi*110, z=-2410+zi*130;
    if(x<960||x>2140)continue;
    crossA.push([x,12.06,z]);
  }
  for(let xi=0;xi<8;xi++)for(let zi=0;zi<9;zi++){
    const x=-3360+xi*110, z=-1240+zi*110;
    const h=SA.terrainH(x,z);
    if(h<2)continue;
    crossA.push([x,h+.06,z]);
  }
  inst(new THREE.BoxGeometry(11,.02,11),asphalt,crossA);
  /* sidewalks along the SF/LV street grids */
  const walk=[];
  for(let xi=0;xi<9;xi++){
    const x=990+xi*110;
    if(x<960||x>2140)continue;
    walk.push([x-6.4,12.18,-2000,2.4,1,880]);
    walk.push([x+6.4,12.18,-2000,2.4,1,880]);
  }
  for(let zi=0;zi<7;zi++){
    const z=-2410+zi*130;
    walk.push([1550,12.18,z-6.4,1180,1,2.4]);
    walk.push([1550,12.18,z+6.4,1180,1,2.4]);
  }
  for(let xi=0;xi<8;xi++){
    const x=-3360+xi*110;
    if(x<-2850&&false)continue;
    const h1=SA.terrainH(x,-1250),h2=SA.terrainH(x,-2140);
    if(h1<2&&h2<2)continue;
    walk.push([x-6.0,(h1+h2)/2+.18,-1695,2.2,1,900]);
    walk.push([x+6.0,(h1+h2)/2+.18,-1695,2.2,1,900]);
  }
  inst(new THREE.BoxGeometry(1,.3,1),slabMat,walk);
  console.log('[SA] roads built:', SA.roads.length);
});

/* ---------- the two signature bridges ---------- */
SA.addBuild('bridges', ()=>{
  function buildBridge(name, opts){
    const r=SA.roadMap[name]; if(!r) return;
    const pts=r.pts, ys=r.ys;
    /* deck already drawn by roads stage; add railings + pillars handled there.
       Here: gant towers + cables + hangers. */
    if(!opts.towers) return;
    const L=roadLen(pts);
    const towerDs=[L*.33, L*.66];
    const tops=[];
    for(const td of towerDs){
      const p=ptAt(pts,ys,td); if(!p)continue;
      const topY=p.y+42;
      const tw=new THREE.Mesh(new THREE.BoxGeometry(7,46,7),towerMat);
      tw.position.set(p.x, p.y-4+23, p.z);
      tw.castShadow=true;
      scene.add(tw);
      /* cross braces */
      const br=new THREE.Mesh(new THREE.BoxGeometry(9.4,2.2,2.2),towerMat);
      br.position.set(p.x,topY-3,p.z); br.rotation.y=Math.atan2(-p.nz,p.nx);
      scene.add(br);
      const br2=new THREE.Mesh(new THREE.BoxGeometry(9.4,1.6,1.6),towerMat);
      br2.position.set(p.x,p.y+16,p.z); br2.rotation.y=Math.atan2(-p.nz,p.nx);
      scene.add(br2);
      tops.push({d:td, x:p.x, z:p.z, top:topY, nx:p.nx, nz:p.nz});
    }
    if(tops.length<2) return;
    /* anchor points at deck ends */
    const a0=ptAt(pts,ys,4), a1=ptAt(pts,ys,L-4);
    /* cables: two sides */
    for(const side of[-1,1]){
      const keyPts=[];
      const start=ptAt(pts,ys,2);
      const end=ptAt(pts,ys,L-2);
      const off=side*(r.w/2+.3);
      keyPts.push(new THREE.Vector3(start.x+start.nx*off, start.y+1, start.z+start.nz*off));
      for(const t of tops) keyPts.push(new THREE.Vector3(t.x+t.nx*off, t.top, t.z+t.nz*off));
      keyPts.push(new THREE.Vector3(end.x+end.nx*off, end.y+1, end.z+end.nz*off));
      const curve=new THREE.CatmullRomCurve3(keyPts,false,'catmullrom',.1);
      const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,40,.2,5,false),cableMat);
      scene.add(tube);
      /* hangers */
      for(let d=18;d<L-18;d+=14){
        const p=ptAt(pts,ys,d); if(!p)continue;
        /* cable height: piecewise with sag */
        let cy=null;
        if(d<tops[0].d){
          const t=d/tops[0].d;
          cy=lerp(a0.y+1,tops[0].top,t) - Math.sin(t*Math.PI)*5.2;
        }else{
          const t=(d-tops[0].d)/(L-tops[0].d);
          cy=lerp(tops[0].top,a1.y+1,t) - Math.sin(t*Math.PI)*4.2;
          if(d<tops[1].d){
            const t2=(d-tops[0].d)/(tops[1].d-tops[0].d);
            cy=lerp(tops[0].top,tops[1].top,t2) - Math.sin(t2*Math.PI)*3.1;
          }
        }
        if(cy===null)continue;
        const hgt=Math.max(.6,cy-(p.y+1));
        const hg=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,1,4),cableMat);
        hg.position.set(p.x+p.nx*off, p.y+1+hgt/2, p.z+p.nz*off);
        hg.scale.y=hgt;
        scene.add(hg);
      }
    }
  }
  buildBridge('Gant Bridge',{towers:true});
  console.log('[SA] bridges built');
});

/* shared geometry helpers for later parts (fields, pads, walls) */
SA.ribbonGeo=ribbonGeo; SA.wallGeo=wallGeo; SA.resample=resample;
SA.roadLen=roadLen; SA.ptAt=ptAt;
})();
