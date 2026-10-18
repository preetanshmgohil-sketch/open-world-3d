/* ============================================================
   PART 19: CAMERA PATCH
   Ground-relative chase cam (hills/mainland) + aircraft cam.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
if(!SA) return;

window.updateCamera = function(dt){
  const pc = cur();
  if(shakeT>0){shakeT-=dt;if(shakeT<=0)shakeA=0}
  if(pc){
    camOff*=Math.exp(-(drag||locked?.8:1.6)*dt);
    let d=pc.psi+camOff-ca;d=Math.atan2(Math.sin(d),Math.cos(d));
    ca+=d*Math.min(1,dt*4);
    const sp=Math.abs(pc.vfS||0);
    const flying = pc.py!==undefined;
    const py = flying ? pc.py : (pc._gy||0);
    if(flying){
      const dist=16+sp*.07;
      _v1.set(pc.p.x-Math.sin(ca)*dist, py+4.8+sp*.015, pc.p.z-Math.cos(ca)*dist);
      camera.position.lerp(_v1,1-Math.exp(-4.5*dt));
      const f=pc.fwd();
      camera.lookAt(pc.p.x+f.x*12, py+1.1, pc.p.z+f.z*12);
      if(camera.position.y<py+1.4)camera.position.y=py+1.4;
      camera.fov+=(62+sp*.38-camera.fov)*Math.min(1,dt*3);
    }else{
      const dist=8.5+sp*.05;
      _v1.set(pc.p.x-Math.sin(ca)*dist, py+3.8+sp*.02, pc.p.z-Math.cos(ca)*dist);
      camera.position.lerp(_v1,1-Math.exp(-9*dt));
      const f=pc.fwd();
      camera.lookAt(pc.p.x+f.x*5, py+1.4, pc.p.z+f.z*5);
      if(camera.position.y<py+1.4)camera.position.y=py+1.4;
      camera.fov+=(62+sp*.55-camera.fov)*Math.min(1,dt*3);
    }
    camera.updateProjectionMatrix();
  }else{
    camera.fov+=(62-camera.fov)*Math.min(1,dt*4);
    camera.updateProjectionMatrix();
    const cp=Math.cos(player.pitch),sp2=Math.sin(player.pitch);
    const fx=-cp*Math.sin(player.yaw),fy=sp2,fz=-cp*Math.cos(player.yaw);
    if(player.view===1){
      const hx=player.x,hy=player.y+1.55,hz=player.z,dist=5.4;
      _v1.set(hx-fx*dist,Math.max(.7,hy-fy*dist+.9),hz-fz*dist);
      camera.position.lerp(_v1,1-Math.exp(-16*dt));
      camera.lookAt(hx+fx*6,hy+fy*6-.25,hz+fz*6);
    }else{
      camera.position.set(player.x,player.y+1.65,player.z);
      camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
    }
    ca=player.yaw;
  }
  if(shakeA){
    camera.position.x+=rnd(-1,1)*shakeA*.4;
    camera.position.y+=rnd(-1,1)*shakeA*.3;
  }
  if(camera.position.y<.6)camera.position.y=.6;
};
console.log('[SA] camera patch ready (ground-relative + aircraft)');
})();
