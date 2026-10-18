/* ============================================================
   PART 13: ACTIVITIES
   Trial runner (checkpoints/GPS/beacon) + flight school,
   street races, courier deliveries, rampages, kill feed.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
if(!SA) return;

/* ---------- trial HUD element ---------- */
const th = document.createElement('div');
th.id = 'trialhud';
th.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:rgba(10,14,18,.78);'+
 'border:1px solid rgba(255,255,255,.16);color:#ffd76a;font:600 13px/1.45 system-ui,Segoe UI,sans-serif;'+
 'padding:6px 16px;border-radius:9px;letter-spacing:.4px;display:none;z-index:39;text-shadow:0 1px 3px #000;text-align:center';
document.body.appendChild(th);

/* ---------- kill feed (rampages) ---------- */
const killFns = [];
function pedKilled(){ for(let i=0;i<killFns.length;i++){ try{ killFns[i](); }catch(e){} } }
const basePedHit = Ped.prototype.hit;
Ped.prototype.hit = function(vx,vz){
  const was = this.state;
  basePedHit.call(this, vx, vz);
  if(was!=='rag' && this.state==='rag') pedKilled();
};
if(SA.gangDown){
  const baseGangDown = SA.gangDown;
  SA.gangDown = function(ped, byPlayer){
    baseGangDown(ped, byPlayer);
    if(ped.state==='rag') pedKilled();
  };
}

/* ---------- checkpoint beacon ---------- */
let checkMesh = null;
function makeCheck(){
  if(checkMesh) return checkMesh;
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 90, 18, 1, true),
    new THREE.MeshBasicMaterial({color:0xffd24a, transparent:true, opacity:.33, side:THREE.DoubleSide,
      depthWrite:false, blending:THREE.AdditiveBlending}));
  m.position.y = 45;
  scene.add(m);
  checkMesh = m;
  return m;
}
function placeCheck(x, z){
  const m = makeCheck();
  m.position.x = x; m.position.z = z;
  m.position.y = (SA.terrainH ? SA.terrainH(x,z) : 0) + 45;
}
SA.beaconShow = placeCheck;
SA.beaconHide = removeCheck;
function removeCheck(){ if(checkMesh){ scene.remove(checkMesh); checkMesh = null; } }

/* ---------- trial runner ---------- */
SA.trial = null;
function trialHud(txt){ th.textContent = txt; th.style.display = 'block'; }
function fmt(s){ s = Math.max(0, Math.ceil(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }

SA.startTrial = function(o){
  if(SA.trial){ SA.toast('Finish the current challenge first!'); return; }
  SA.trial = {
    name:o.name, checks:o.checks||null, i:0, t:0, time:o.time||180,
    reward:o.reward||500, needCar:!!o.needCar, needAir:!!o.needAir,
    kills:o.kills||0
  };
  const tr = SA.trial;
  if(tr.kills){
    trialHud(tr.name+' — '+tr.kills+' targets');
    SA.toast(tr.name+' — hit the streets!');
  } else {
    SA.gps = {x:tr.checks[0].x, z:tr.checks[0].z};
    placeCheck(tr.checks[0].x, tr.checks[0].z);
    trialHud(tr.name+' — checkpoint 1/'+tr.checks.length);
    SA.toast(tr.name+' — follow the gold marker!');
  }
  Audio.tone(600,900,.06,.2,'square');
};

function trialEnd(msg, cashWin){
  const tr = SA.trial;
  if(!tr) return;
  if(cashWin){
    cash += tr.reward; Audio.money();
    SA.respect = (SA.respect||0) + Math.round(tr.reward/100);
    SA.toast(tr.name+' complete! +$'+tr.reward);
    if(tr.name.indexOf('Flight') === 0 && !SA.jetUnlocked){
      SA.jetUnlocked = true;
      SA.toast('Jetpack unlocked! Press J while on foot.');
      Audio.tone(500,1500,.15,.25,'square');
    }
  } else {
    SA.toast(msg || 'Challenge failed.');
  }
  SA.trial = null;
  SA.gps = null;
  th.style.display = 'none';
  removeCheck();
}

SA.cancelTrial = ()=>trialEnd('Challenge over.');

SA.addUpd(dt=>{
  const tr = SA.trial;
  if(!tr) return;
  tr.t += dt;
  if(player.deadT>0){ trialEnd('You went down — challenge failed.'); return; }
  if(tr.t > tr.time){ trialEnd('Time\'s up — challenge failed.'); return; }
  const pc = cur();
  if(tr.kills){
    let need = tr.kills - (tr._k||0);
    trialHud(tr.name+' — '+Math.max(0,need)+' left · '+fmt(tr.time-tr.t));
    return;
  }
  const px = pc ? pc.p.x : player.x, pz = pc ? pc.p.z : player.z;
  const c = tr.checks[tr.i];
  const d = Math.hypot(px-c.x, pz-c.z);
  if(tr.needCar && !pc && d < 90){
    trialHud(tr.name+' — GET A VEHICLE! · '+fmt(tr.time-tr.t));
    return;
  }
  if(tr.needAir && pc && pc.py===undefined && d < 220){
    trialHud(tr.name+' — TAKE OFF! (you need an aircraft) · '+fmt(tr.time-tr.t));
  } else {
    trialHud(tr.name+' — checkpoint '+(tr.i+1)+'/'+tr.checks.length+' · '+fmt(tr.time-tr.t));
  }
  if(d < (c.r||16)){
    Audio.tone(800,1200,.05,.15,'square');
    tr.i++;
    if(tr.i >= tr.checks.length){ trialEnd('', true); return; }
    SA.gps = {x:tr.checks[tr.i].x, z:tr.checks[tr.i].z};
    placeCheck(tr.checks[tr.i].x, tr.checks[tr.i].z);
  }
});

/* rampage kill counting */
killFns.push(()=>{
  const tr = SA.trial;
  if(!tr || !tr.kills) return;
  tr._k = (tr._k||0) + 1;
  Audio.tone(300+((tr._k)%10)*40, 200, .04, .1, 'sawtooth');
  if(tr._k >= tr.kills) trialEnd('', true);
});

/* gold checkpoint blip on minimaps */
SA.blipFns = SA.blipFns || [];
SA.blipFns.push(cb=>{
  if(SA.gps) cb(SA.gps.x, SA.gps.z, '#ffd700', 6);
});

/* ============================================================
   ACTIVITY: FLIGHT SCHOOL (Verdant Meadows)
   ============================================================ */
SA.openFlightSchool = function(){
  SA.openPanel(
    '<h2>Verdant Meadows Flight School</h2>'+
    '<div class="msub">Aircraft: plane + chopper on the apron · Fly through the gold beacons</div>'+
    '<div class="btns">'+
    '<button data-a="fs1">LESSON 1 — VALLEY RUN ($900 · 4 min)</button>'+
    '<button data-a="fs2">LESSON 2 — CITY CIRCLE ($700 · 2.5 min)</button>'+
    '<button data-a="fs3" class="alt">LEAVE</button>'+
    '</div>'+
    '<div class="note">Lesson 1: Verdant Meadows → the bay → Mount Chiliad → home.<br>'+
    'Lesson 2: Los Santos airport → downtown → the hills → back.</div>');
  SA.actions.fs1 = () => { SA.closeModal(); SA.startTrial({
    name:'Flight: Valley Run', time:240, reward:900, needAir:true,
    checks:[{x:330,z:-2790,r:70},{x:-500,z:-1600,r:100},{x:-1750,z:-2900,r:110},{x:330,z:-2790,r:70}]
  }); };
  SA.actions.fs2 = () => { SA.closeModal(); SA.startTrial({
    name:'Flight: City Circle', time:150, reward:700, needAir:true,
    checks:[{x:60,z:-950,r:70},{x:-60,z:0,r:80},{x:-900,z:-400,r:90},{x:60,z:-950,r:70}]
  }); };
  SA.actions.fs3 = () => SA.closeModal();
};

/* ============================================================
   ACTIVITY: STREET RACES
   ============================================================ */
SA.addSpot({x:-300, z:-500, r:8, label:'Grove Street Circuit ($1500)', fn:()=>SA.startTrial({
  name:'Race: Grove Circuit', time:150, reward:1500, needCar:true,
  checks:[{x:-330,z:-560,r:18},{x:330,z:-540,r:18},{x:430,z:180,r:20},{x:-40,z:430,r:20},{x:-430,z:180,r:20},{x:-300,z:-500,r:18}]
})});
SA.addSpot({x:1810, z:-1950, r:8, label:'The Strip Sprint ($2000)', fn:()=>SA.startTrial({
  name:'Race: The Strip', time:170, reward:2000, needCar:true,
  checks:[{x:1445,z:-2085,r:20},{x:2260,z:-2090,r:22},{x:2230,z:-2620,r:22},{x:1450,z:-2600,r:20},{x:1810,z:-1950,r:18}]
})});
SA.addSpot({x:-2800, z:-1300, r:8, label:'Bay Loop ($1600)', fn:()=>SA.startTrial({
  name:'Race: Bay Loop', time:170, reward:1600, needCar:true,
  checks:[{x:-2950,z:-1800,r:22},{x:-2700,z:-2150,r:22},{x:-2450,z:-1850,r:22},{x:-2800,z:-1300,r:18}]
})});

/* courier deliveries */
SA.addSpot({x:-320, z:-540, r:7, label:'Courier job ($600)', fn:()=>SA.startTrial({
  name:'Courier: LS deliveries', time:150, reward:600,
  checks:[{x:-60,z:420,r:16},{x:400,z:-300,r:16},{x:-420,z:260,r:16},{x:160,z:-560,r:16}]
})});

/* rampages */
SA.addSpot({x:-200, z:-320, r:6, label:'Rampage: 12 in 90s ($600)', fn:()=>SA.startTrial({
  name:'RAMPAGE', kills:12, time:90, reward:600
})});
SA.addSpot({x:-2700, z:-1600, r:6, label:'Rampage: 10 in 90s ($600)', fn:()=>SA.startTrial({
  name:'RAMPAGE', kills:10, time:90, reward:600
})});

console.log('[SA] activities ready (flight school, races, courier, rampages)');
})();
