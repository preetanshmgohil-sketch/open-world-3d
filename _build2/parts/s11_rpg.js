/* ============================================================
   PART 11: RPG STATS + SHOPS (gym / barber / clothes)
   Muscle, respect, outfit & haircut systems, shop modals.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
if(!SA) return;

/* ---------- stat state ---------- */
if(SA.muscle===undefined) SA.muscle = 0;        /* 0..100 */
if(SA.respect===undefined) SA.respect = 0;
if(SA.sexAppeal===undefined) SA.sexAppeal = 10;
if(SA.outfit===undefined) SA.outfit = 0;
if(SA.hair===undefined) SA.hair = 0;

const OUTFITS = [
  {name:'Street hoodie',   jacket:0x2b4a7a, pants:0x252e38, appeal:10},
  {name:'Families green',  jacket:0x1f7a3a, pants:0x24281f, appeal:16},
  {name:'Ballas purple',   jacket:0x6e3fa0, pants:0x1c1c22, appeal:14},
  {name:'Black suit',      jacket:0x191b20, pants:0x14161a, appeal:22},
  {name:'Beach cyan',      jacket:0x27b3c4, pants:0xd8d4c4, appeal:18}
];
const HAIRCUTS = [
  {name:'Crew cut',  color:0x2a2018},
  {name:'Dark fade', color:0x14120f},
  {name:'Brown mop', color:0x5a3d22},
  {name:'Blond tips',color:0xa88b4a}
];
SA.OUTFITS = OUTFITS; SA.HAIRCUTS = HAIRCUTS;

/* ---------- apply look to the player model ---------- */
function pMeshByBox(ws, hs){
  let found = null;
  pModel.g.traverse(o=>{
    if(found || !o.isMesh || !o.geometry || !o.geometry.parameters) return;
    const pp = o.geometry.parameters;
    if(o.geometry.type==='BoxGeometry' && Math.abs(pp.width-ws)<.02 && Math.abs(pp.height-hs)<.02) found = o;
  });
  return found;
}
SA.applyLook = function(){
  const o = OUTFITS[SA.outfit % OUTFITS.length];
  const torso = pMeshByBox(.62,.78);
  const arm   = pMeshByBox(.16,.66);
  const leg   = pMeshByBox(.2,.78);
  if(torso) torso.material.color.setHex(o.jacket);
  if(arm)   arm.material.color.setHex(o.jacket);
  if(leg)   leg.material.color.setHex(o.pants);
  SA.sexAppeal = o.appeal;
  /* hair */
  let hair=null;
  pModel.g.traverse(m=>{
    if(hair || !m.isMesh || !m.geometry.parameters) return;
    if(m.geometry.type==='SphereGeometry' && Math.abs(m.geometry.parameters.radius-.215)<.003) hair=m;
  });
  if(hair) hair.material.color.setHex(HAIRCUTS[SA.hair % HAIRCUTS.length].color);
};

/* ---------- custom melee damage scaled by muscle ---------- */
window.meleeHit = function(w){
  const range = WEAPONS[w].range;
  const dmg = (w===1?9:4) * (1 + (SA.muscle||0)/150);
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const ax=camera.position.x, ay=camera.position.y, az=camera.position.z;
  let got = false;
  for(const p of peds){
    if(p.state==='rag') continue;
    const pp=p.g.position, dx=pp.x-ax, dz=pp.z-az, dy=pp.y+1.1-ay;
    const d=Math.hypot(dx,dz);
    if(d>range+.7) continue;
    const dot=(dx*dir.x+dz*dir.z)/(d||1);
    if(dot<.3) continue;
    if(p.damage && p.gang) p.damage(dmg, false);
    else p.hit(dir.x*7, dir.z*7);
    if(p.missionTag) onTargetKilled(p);
    wanted=Math.min(5,wanted+.15);
    got=true; break;
  }
  if(!got) for(const c of cars){
    const dx=c.p.x-ax, dz=c.p.z-az, d=Math.hypot(dx,dz);
    if(d>range+1.2) continue;
    const dot=(dx*dir.x+dz*dir.z)/(d||1);
    if(dot<.3) continue;
    damageCar(c, dmg, true);
    fxSparks(c.p.x,.9,c.p.z,7,3,1,.85,.4);
    Audio.thud(); got=true; break;
  }
  if(!got) Audio.punch(); else Audio.punch();
  shake(.05);
};

/* ---------- shop spots (added at build time, after all shops register) ---------- */
const KIND_LABEL = {gym:'Gym — work out', barber:'Barber — haircut', clothes:'Clothes store — outfits'};
SA.addBuild('rpg_spots', ()=>{
  let n = 0;
  for(const s of (SA.shops||[])){
    if(!KIND_LABEL[s.kind]) continue;
    SA.addSpot({x:s.x, z:s.z, r:6, label:KIND_LABEL[s.kind], fn:()=>openShop(s)});
    n++;
  }
  console.log('[SA] shop spots added: '+n);
});

function money(n){
  if(cash < n){ SA.toast('Not enough money (need $'+n+')'); Audio.fail(); return false; }
  cash -= n; Audio.money(); return true;
}

function openShop(s){
  SA._shop = s;
  if(s.kind==='gym') return openGym(s);
  if(s.kind==='barber') return openBarber(s);
  if(s.kind==='clothes') return openClothes(s);
}

/* ---------- gym ---------- */
function openGym(s){
  const m = Math.round(SA.muscle);
  SA.openPanel(
    '<h2>'+s.name+'</h2><div class="msub">MUSCLE '+m+'/100 · STAMINA '+Math.round(SA.stamina||100)+'/100</div>'+
    '<div class="note">Train to build muscle. Muscle boosts your melee damage.</div>'+
    '<div class="btns">'+
    '<button data-a="gTread">TREADMILL ($10) — stamina</button>'+
    '<button data-a="gLift">WEIGHTS ($10) — muscle</button>'+
    '<button data-a="gBox">BOXING ($25) — muscle ++</button>'+
    '<button data-a="gClose" class="alt">LEAVE</button></div>');
  SA.actions.gTread = () => { if(!money(10)) return; SA.stamina = Math.min(100,(SA.stamina||100)+3); SA.toast('Cardio! Stamina up.'); openGym(SA._shop); };
  SA.actions.gLift  = () => { if(!money(10)) return; if(SA.muscle>=100){ SA.toast('You are already yoked.'); return openGym(SA._shop); }
    SA.muscle = Math.min(100, SA.muscle + 2.5); SA.toast('Pumping iron — muscle '+Math.round(SA.muscle)+'/100'); openGym(SA._shop); };
  SA.actions.gBox   = () => { if(!money(25)) return; if(SA.muscle>=100){ SA.toast('You are already yoked.'); return openGym(SA._shop); }
    SA.muscle = Math.min(100, SA.muscle + 5); SA.toast('Heavy bag session — muscle '+Math.round(SA.muscle)+'/100'); openGym(SA._shop); };
  SA.actions.gClose = () => SA.closeModal();
}

/* ---------- barber ---------- */
function openBarber(s){
  let btns='';
  HAIRCUTS.forEach((h,i)=>{ btns += '<button data-a="b'+i+'">'+h.name+' ($50)</button>'; });
  SA.openPanel(
    '<h2>'+s.name+'</h2><div class="msub">HAIRCUT: '+HAIRCUTS[SA.hair%HAIRCUTS.length].name+'</div>'+
    '<div class="btns">'+btns+'<button data-a="bClose" class="alt">LEAVE</button></div>');
  HAIRCUTS.forEach((h,i)=>{
    SA.actions['b'+i] = () => {
      if(!money(50)) return;
      SA.hair = i; SA.applyLook();
      SA.toast('Fresh cut: '+h.name); openBarber(SA._shop);
    };
  });
  SA.actions.bClose = () => SA.closeModal();
}

/* ---------- clothes ---------- */
function openClothes(s){
  let btns='';
  OUTFITS.forEach((o,i)=>{ btns += '<button data-a="o'+i+'">'+o.name+' ($150)'+(SA.outfit===i?' — wearing':'')+'</button>'; });
  SA.openPanel(
    '<h2>'+s.name+'</h2><div class="msub">WEARING: '+OUTFITS[SA.outfit%OUTFITS.length].name+' · SEX APPEAL '+SA.sexAppeal+'</div>'+
    '<div class="btns">'+btns+'<button data-a="oClose" class="alt">LEAVE</button></div>');
  OUTFITS.forEach((o,i)=>{
    SA.actions['o'+i] = () => {
      if(SA.outfit===i){ SA.toast('Already wearing that.'); return; }
      if(!money(150)) return;
      SA.outfit = i; SA.applyLook();
      SA.toast('Looking sharp: '+o.name); openClothes(SA._shop);
    };
  });
  SA.actions.oClose = () => SA.closeModal();
}

/* ---------- respect bookkeeping ---------- */
let lastKills = 0, lastFamZones = 0;
SA.addRespect = function(n){ SA.respect += n; };
SA.addUpd(dt=>{
  if((SA.statGangKills||0) !== lastKills){
    SA.respect += ((SA.statGangKills||0) - lastKills) * 2;
    lastKills = SA.statGangKills||0;
  }
  const famZones = SA.ZONES ? SA.ZONES.filter(z=>z.gang==='fam').length : 0;
  if(famZones !== lastFamZones){
    if(famZones > lastFamZones && lastFamZones>0) SA.respect += 10;
    lastFamZones = famZones;
  }
});

/* ---------- stat panel rows (after s18 init) + starter look ---------- */
SA.hooks.afterBuild = SA.hooks.afterBuild || [];
SA.hooks.afterBuild.push(()=>{
  try{ SA.applyLook(); }catch(e){ console.error('[SA look]',e); }
  SA.statsSections = SA.statsSections || [];
  SA.statsSections.push(()=>{
    const m = Math.round(SA.muscle);
    const mlabel = m<20?'Wimp':(m<45?'Average':(m<75?'Fit':'Ripped'));
    const famZones = SA.ZONES ? SA.ZONES.filter(z=>z.gang==='fam').length : 0;
    return '<div class="mrow"><span>MUSCLE</span><span class="v">'+m+' ('+mlabel+')</span></div>'+
      '<div class="mrow"><span>RESPECT</span><span class="v">'+Math.round(SA.respect)+'</span></div>'+
      '<div class="mrow"><span>SEX APPEAL</span><span class="v">'+SA.sexAppeal+'</span></div>'+
      '<div class="mrow"><span>GANG KILLS</span><span class="v">'+(SA.statGangKills||0)+'</span></div>'+
      '<div class="mrow"><span>TURFS OWNED</span><span class="v">'+famZones+'/'+(SA.ZONES?SA.ZONES.length:0)+'</span></div>';
  });
});

console.log('[SA] rpg stats + shops ready');
})();
