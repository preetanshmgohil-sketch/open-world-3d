/* ============================================================
   PART 17: EXTRAS
   Weapons 4-8 + spraycan, Ammu-Nation loadout, nitro (N),
   jetpack (J, after flight school), cheat codes, save/load,
   taxi and vigilante side jobs (E while driving).
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
if(!SA) return;

/* ============================================================
   A. WEAPON PACK (keys 4 5 6 7 8, spraycan on 0)
   ============================================================ */
const GUNS = {
  3:{name:'SMG',    rate:.075, dmg:6,  range:55,  spread:.045, wanted:.12, kick:.05},
  4:{name:'SHOTGUN',rate:.85,  dmg:8,  range:26,  spread:.11,  pellets:6, wanted:.5, kick:.11},
  5:{name:'AK-47',  rate:.12,  dmg:11, range:85,  spread:.05,  wanted:.3,  kick:.07},
  6:{name:'SNIPER', rate:1.15, dmg:90, range:320, spread:.003, wanted:.8,  kick:.16},
  7:{name:'ROCKET', rate:1.7,  dmg:0,  range:260, spread:.02,  rocket:true, wanted:1.2, kick:.2}
};
WEAPONS.push({name:'SMG',rate:GUNS[3].rate,range:GUNS[3].range});
WEAPONS.push({name:'SHOTGUN',rate:GUNS[4].rate,range:GUNS[4].range});
WEAPONS.push({name:'AK-47',rate:GUNS[5].rate,range:GUNS[5].range});
WEAPONS.push({name:'SNIPER',rate:GUNS[6].rate,range:GUNS[6].range});
WEAPONS.push({name:'ROCKET',rate:GUNS[7].rate,range:GUNS[7].range});
WEAPONS.push({name:'SPRAYCAN',rate:.4,range:3.4});

SA.wAmmo = {3:60, 4:0, 5:0, 6:0, 7:0};
const AMMO_FULL = {3:220, 4:80, 5:240, 6:24, 7:10};

SA.hooks.key.push(code=>{
  const M = {Digit4:3, Digit5:4, Digit6:5, Digit7:6, Digit8:7, Digit0:8};
  if(M[code] !== undefined && !SA.modalOpen){
    selectWeapon(M[code]);
    return true;
  }
  return false;
});

function rayOne(g){
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  dir.x += rnd(-g.spread,g.spread); dir.y += rnd(-g.spread,g.spread); dir.z += rnd(-g.spread,g.spread);
  dir.normalize();
  const ox=camera.position.x+dir.x*.6, oy=camera.position.y+dir.y*.6, oz=camera.position.z+dir.z*.6;
  let bestT=g.range, hit=null;
  for(const p of peds){
    if(p.state==='rag') continue;
    const pp=p.g.position;
    const dx=pp.x-ox, dy=pp.y+1.05-oy, dz=pp.z-oz;
    const t=dx*dir.x+dy*dir.y+dz*dir.z;
    if(t<0||t>bestT) continue;
    const px=ox+dir.x*t-pp.x, py=oy+dir.y*t-(pp.y+1.05), pz=oz+dir.z*t-pp.z;
    if(px*px+py*py+pz*pz < .6){ bestT=t; hit={type:'ped',obj:p}; }
  }
  for(const c of cars){
    const cs=c.circles();
    for(const q of cs){
      const dx=q.x-ox, dz=q.z-oz;
      const t=dx*dir.x+dz*dir.z;
      if(t<1||t>bestT) continue;
      const px=ox+dir.x*t-q.x, pz=oz+dir.z*t-q.z, py=oy+dir.y*t-.9;
      if(px*px+pz*pz<1.8 && Math.abs(py)<1.8){ bestT=t; hit={type:'car',obj:c}; }
    }
  }
  const bt=rayColHit(ox,oy,oz,dir.x,dir.y,dir.z,bestT);
  if(bt!==null && bt<bestT){ bestT=bt; hit={type:'wall'}; }
  const hx=ox+dir.x*bestT, hy=oy+dir.y*bestT, hz=oz+dir.z*bestT;
  tracer(ox-dir.x*.5, oy-.15, oz-dir.z*.5, hx, hy, hz);
  if(hit && hit.type==='ped'){
    hit.obj.hit(dir.x*9, dir.z*9);
    for(const p of peds){ if(p.state==='walk' && p.g.position.distanceTo(_v1.set(ox,1,oz))<14) p.panic=6; }
  } else if(hit && hit.type==='car'){
    damageCar(hit.obj, g.dmg||40, true);
    fxSparks(hx,hy,hz,9,5,1,.8,.35);
  } else if(hit){
    fxDust(hx,hy,hz,4,1.4,.7,.68,.6);
  } else {
    fxDust(hx,hy,hz,2,1,.8,.75,.7);
  }
  if(g.rocket) rocketBoom(hx,hy,hz);
  return true;
}

function rocketBoom(x,y,z){
  fxSparks(x,y,z,46,10,2.2,1.5,.55);
  fxDust(x,y,z,16,2.4,1.2,.8,.8);
  shake(.5);
  Audio.thud();
  for(const p of peds){
    if(p.state==='rag') continue;
    const dx=p.g.position.x-x, dz=p.g.position.z-z, d=Math.hypot(dx,dz);
    if(d<9) p.hit(dx*2.2, dz*2.2);
  }
  for(const c of cars){
    const d=Math.hypot(c.p.x-x, c.p.z-z);
    if(d<9) damageCar(c, 150, true);
  }
}

function gunShot(w){
  const g=GUNS[w];
  if((SA.wAmmo[w]|0) <= 0){
    Audio.punch();
    sub('Out of ammo — refill at Ammu-Nation ($600)');
    player.fireCd=.5;
    return;
  }
  SA.wAmmo[w]--;
  player.fireCd = g.rate;
  const pellets = g.pellets||1;
  for(let i=0;i<pellets;i++) rayOne(g);
  Audio.gun();
  if(w===4 || w===7) Audio.thud();
  wanted = Math.min(6, wanted + g.wanted);
  shake(.08 + g.kick);
  player.pitch -= g.kick*.35;
}

function spraycan(){
  player.fireCd = .4;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const ox = camera.position.x+dir.x*1.4, oz = camera.position.z+dir.z*1.4;
  fxDust(ox, camera.position.y+.4, oz, 6, 1.6, .9, .9, .5);
  Audio.tone(2600, 800, .28, .07, 'sine');
  let any=false;
  for(const p of peds){
    if(p.state==='rag') continue;
    const dx=p.g.position.x-ox, dz=p.g.position.z-oz, d=Math.hypot(dx,dz);
    if(d<4.5 && (dx*dir.x+dz*dir.z)>0){ p.panic=Math.max(p.panic,8); any=true; }
  }
  if(any){ wanted = Math.min(6, wanted+.02); shake(.04); }
}

const _origTryFire = window.tryFire;
window.tryFire = function(){
  const w = player.weapon|0;
  if(w < 3){ if(_origTryFire) return _origTryFire(); return; }
  if(player.frozen>0 || player.fireCd>0 || !started) return;
  if(w === 8){ spraycan(); return; }
  gunShot(w);
};

/* Ammu-Nation full-loadout spot (base shop adds pistol ammo + bat) */
SA.addBuild('ammo_shop', ()=>{
  if(typeof shopSpots !== 'undefined' && shopSpots.ammu){
    const a = shopSpots.ammu;
    SA.addSpot({ x:a.markerX+6, z:a.zMarker-4, r:7, label:'Ammu-Nation: full loadout ($600)', fn:()=>{
      if(cash < 600){ SA.toast('Need $600 for the full loadout.'); Audio.fail(); return; }
      cash -= 600;
      for(const k in AMMO_FULL) SA.wAmmo[k]=AMMO_FULL[k];
      player.ammo += 150;
      player.bat = true;
      Audio.money();
      SA.toast('Ammu-Nation: locked and loaded. -$600');
    }});
  }
});

/* weapon ammo on the HUD for guns 3-7 */
SA.addUpd(()=>{
  const w = player.weapon|0;
  if(w>=3 && w<=7){
    const el = document.getElementById('ammo');
    if(el){ const t='×'+(SA.wAmmo[w]|0); if(el.textContent!==t) el.textContent=t; }
  }
});

/* ============================================================
   B. NITRO (hold N in a car)
   ============================================================ */
SA.nitro = 100;
let nitroToastT = 0;
SA.addUpd(dt=>{
  const c = cur();
  const on = c && keys.KeyN && SA.nitro>0 && !SA.modalOpen;
  if(on){
    SA.nitro = Math.max(0, SA.nitro - 30*dt);
    const f = c.fwd();
    const cap = (c.d && c.d.maxS ? c.d.maxS : 40) * 1.35;
    if(Math.hypot(c.v.x, c.v.z) < cap){
      c.v.x += f.x*30*dt;
      c.v.z += f.z*30*dt;
    }
    c._nxT = (c._nxT||0) - dt;
    if(c._nxT <= 0){
      c._nxT = .07;
      const bl = (c.d && c.d.len ? c.d.len/2 : 2);
      fxDust(c.p.x - f.x*bl, .5, c.p.z - f.z*bl, 2, 1.1, .9, .9, .6);
    }
  } else {
    SA.nitro = Math.min(100, SA.nitro + 9*dt);
    if(SA.nitro <= .01 && keys.KeyN && c && nitroToastT<=0){
      nitroToastT = 4;
      SA.toast('Nitro empty — recharging…');
    }
  }
  if(nitroToastT > 0) nitroToastT -= dt;
});

/* ============================================================
   C. JETPACK (J, unlocked by finishing a flight school lesson)
   ============================================================ */
SA.jetOn = false;
SA.jetY = 0;
let jetVis = null;
function jetRig(){
  if(jetVis) return jetVis;
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({color:0x7d838a, roughness:.4, metalness:.7});
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.5,8), metal); t1.position.set(-.1,0,0); g.add(t1);
  const t2 = t1.clone(); t2.position.x=.1; g.add(t2);
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.14,8), metal); noz.position.set(0,-.3,0); g.add(noz);
  const fl = new THREE.Mesh(new THREE.ConeGeometry(.07,.34,8),
    new THREE.MeshBasicMaterial({color:0xffa030, transparent:true, opacity:.85}));
  fl.rotation.x = Math.PI; fl.position.set(0,-.52,0); g.add(fl);
  g.position.set(0,1.25,-.32);
  g.visible = false;
  pModel.g.add(g);
  jetVis = {g, fl};
  return jetVis;
}

SA.hooks.key.push(code=>{
  if(code !== 'KeyJ' || SA.modalOpen) return false;
  if(!SA.jetUnlocked){
    SA.toast('Jetpack: finish a flight school lesson at Verdant Meadows to unlock it.');
    return true;
  }
  if(player.car){ SA.toast('Exit the vehicle first (F), then press J.'); return true; }
  SA.jetOn = !SA.jetOn;
  if(SA.jetOn){
    SA.jetY = Math.max(player.y, SA.groundY(player.x, player.z, player.y) + 1.1);
    Audio.tone(300, 900, .25, .15, 'sawtooth');
    SA.toast('Jetpack on — SPACE up · SHIFT down · J off');
  } else {
    Audio.tone(700, 200, .2, .12, 'sawtooth');
  }
  return true;
});

SA.addUpd(dt=>{
  if(SA.jetOn && (player.car || player.deadT>0)) SA.jetOn = false;
  const on = SA.jetOn;
  const vis = jetVis || (on ? jetRig() : null);
  if(vis) vis.g.visible = on;
  if(!on) return;
  let hv = 0;
  if(keys.Space) hv += 9;
  if(keys.ShiftLeft || keys.ShiftRight) hv -= 9;
  SA.jetY += hv*dt;
  const gnd = SA.groundY(player.x, player.z, player.y) + 1.1;
  if(SA.jetY < gnd) SA.jetY = gnd;
  player.y = SA.jetY;
  player.vy = 0;
  if(vis){
    vis.fl.visible = Math.random()<.85;
    vis.fl.scale.y = .8 + Math.random()*.6;
  }
  if(hv!==0 && Math.random()<.25) fxDust(player.x, player.y-.5, player.z, 1, .5, .6, .55, .5);
});

/* ============================================================
   D. CHEAT CODES (type anywhere; listed in the pause menu)
   ============================================================ */
SA.cheats = [
  {code:'HESOYAM',       name:'health + armor + $250,000'},
  {code:'ASPIRINE',      name:'full health'},
  {code:'TURNUPTHEHEAT', name:'+2 wanted stars'},
  {code:'TURNDOWNTHEHEAT', name:'clear wanted level'},
  {code:'BRINGITON',     name:'six wanted stars'},
  {code:'FULLCLIP',      name:'infinite ammo'},
  {code:'GUNSGUNSGUNS',  name:'all weapons'},
  {code:'ROCKETMAN',     name:'jetpack'}
];
function doCheat(c){
  switch(c){
    case 'HESOYAM':
      player.hp = 100; SA.armor = 100; cash += 250000; Audio.money();
      SA.toast('HESOYAM — health, armor, $250,000'); break;
    case 'ASPIRINE':
      player.hp = 100; Audio.money(); SA.toast('ASPIRINE — full health'); break;
    case 'TURNUPTHEHEAT':
      wanted = Math.min(6,(wanted|0)+2); Audio.tone(500,200,.3,.2,'square');
      SA.toast('TURNUPTHEHEAT — heat is on'); break;
    case 'TURNDOWNTHEHEAT':
      wanted = 0; Audio.tone(300,900,.3,.2,'square');
      SA.toast('TURNDOWNTHEHEAT — heat cleared'); break;
    case 'BRINGITON':
      wanted = 6; Audio.tone(200,120,.5,.25,'sawtooth');
      SA.toast('BRINGITON — six stars'); break;
    case 'FULLCLIP':
      for(const k in SA.wAmmo) SA.wAmmo[k]=9999;
      player.ammo = 9999; SA.toast('FULLCLIP — infinite ammo'); break;
    case 'GUNSGUNSGUNS':
      for(const k in AMMO_FULL) SA.wAmmo[k]=9999;
      player.ammo = 9999; player.bat = true;
      SA.toast('GUNSGUNSGUNS — all weapons'); break;
    case 'ROCKETMAN':
      SA.jetUnlocked = true; SA.toast('ROCKETMAN — jetpack unlocked (press J)'); break;
  }
}
let cheatBuf = '', cheatBufT = 0;
window.addEventListener('keydown', e=>{
  if(SA.modalOpen) return;
  if(e.key && e.key.length===1 && /[a-zA-Z]/.test(e.key)){
    cheatBuf = (cheatBuf + e.key.toUpperCase()).slice(-16);
    cheatBufT = 2.5;
    for(const c of SA.cheats){
      if(cheatBuf.endsWith(c.code)){ cheatBuf=''; doCheat(c.code); break; }
    }
  }
});
SA.addUpd(dt=>{ if(cheatBufT>0){ cheatBufT-=dt; if(cheatBufT<=0) cheatBuf=''; } });

/* ============================================================
   E. SAVE / LOAD (menu + autosave call these)
   ============================================================ */
const SKEY = 'sa_index1_save';
SA.saveGame = function(silent){
  const d = {
    v:1, ts:Date.now(),
    x:+player.x.toFixed(1), z:+player.z.toFixed(1), y:+(player.y||0).toFixed(1),
    cash:Math.round(cash), wanted:+(wanted||0).toFixed(2),
    hp:Math.round(player.hp), armor:Math.round(SA.armor||0),
    weapon:player.weapon|0, ammo:player.ammo|0, bat:!!player.bat,
    wAmmo:Object.assign({}, SA.wAmmo),
    muscle:SA.muscle|0, respect:SA.respect|0, sexAppeal:SA.sexAppeal|0,
    outfit:SA.outfit|0, hair:SA.hair|0,
    story:(SA.story?SA.story.idx:0)|0,
    gangKills:SA.statGangKills|0,
    zones:(SA.ZONES||[]).map(z=>({n:z.name, g:z.gang})),
    radio:(SA.radio?SA.radio.idx:0)|0,
    nitro:Math.round(SA.nitro||100), jet:!!SA.jetUnlocked,
    drive:Math.round(SA.statDrive||0), foot:Math.round(SA.statFoot||0),
    t:Math.round(SA.t||0)
  };
  try{ localStorage.setItem(SKEY, JSON.stringify(d)); }
  catch(e){ SA.toast('Save failed (storage unavailable)'); return false; }
  SA.toast(silent ? 'Autosaved.' : 'Game saved.');
  return true;
};

SA.loadGame = function(){
  let d = null;
  try{ d = JSON.parse(localStorage.getItem(SKEY) || 'null'); }catch(e){}
  if(!d || d.v !== 1){ SA.toast('No save found — open the pause menu and save first.'); return false; }
  if(SA.mission || SA.trial){
    if(SA.cancelTrial) SA.cancelTrial();
    SA.mission = null; SA.gps = null;
  }
  if(player.car){ try{ toggleCar(); }catch(e){} }
  cash = d.cash||0; wanted = d.wanted||0;
  player.hp = d.hp==null?100:d.hp; SA.armor = d.armor||0;
  SA.muscle = d.muscle|0; SA.respect = d.respect|0; SA.sexAppeal = d.sexAppeal|0;
  if(SA.OUTFITS && d.outfit>=0 && d.outfit<SA.OUTFITS.length) SA.outfit = d.outfit|0;
  if(SA.HAIRCUTS && d.hair>=0 && d.hair<SA.HAIRCUTS.length) SA.hair = d.hair|0;
  player.ammo = d.ammo|0; player.bat = !!d.bat;
  if(d.weapon!==undefined) player.weapon = d.weapon|0;
  if(d.wAmmo) for(const k in d.wAmmo) SA.wAmmo[k] = d.wAmmo[k];
  if(SA.story) SA.story.idx = Math.min(d.story|0, 5);
  SA.statGangKills = d.gangKills|0;
  if(SA.ZONES && d.zones) for(const zz of d.zones){
    const z = SA.ZONES.find(q=>q.name===zz.n);
    if(z && zz.g) z.gang = zz.g;
  }
  if(SA.radio) SA.radio.idx = d.radio|0;
  SA.nitro = d.nitro==null?100:d.nitro;
  if(d.jet) SA.jetUnlocked = true;
  SA.statDrive = d.drive||0; SA.statFoot = d.foot||0;
  player.deadT = 0; player.frozen = 0; player.vy = 0;
  player.x = d.x||0; player.z = d.z||0; player.y = d.y||0;
  SA.jetOn = false;
  if(SA.applyLook) SA.applyLook();
  SA.toast('Game loaded.');
  return true;
};

/* armor absorbs damage before health */
const _origDamagePlayer = window.damagePlayer;
if(_origDamagePlayer){
  window.damagePlayer = function(v){
    if(SA.armor > 0 && player.deadT <= 0){
      const a = Math.min(SA.armor, v);
      SA.armor -= a; v -= a;
      if(SA.armor < 0) SA.armor = 0;
    }
    if(v > 0) _origDamagePlayer(v);
  };
}

/* ============================================================
   F. SIDE JOBS — taxi & vigilante (press E while driving)
   ============================================================ */
function roadPoint(minD){
  for(let i=0;i<40;i++){
    const R = pick(ROADS), off = Math.random()<.5?8:-8, t = rnd(-HALF+40, HALF-40);
    const axis = Math.random()<.5;
    const x = axis ? R+off : t, z = axis ? t : R+off;
    const d = Math.hypot(x-player.x, z-player.z);
    if(d > minD) return {x,z};
  }
  return {x:player.x+300, z:player.z};
}

SA.taxi = null; SA.vig = null;
function endTaxi(){
  if(!SA.taxi) return;
  SA.toast('Taxi shift ended — '+SA.taxi.fares+' fares delivered.');
  SA.taxi = null; SA.gps = null;
  if(SA.beaconHide) SA.beaconHide();
}
function endVig(){
  if(!SA.vig) return;
  SA.toast('Vigilante shift ended — '+SA.vig.kills+' suspects caught.');
  SA.vig = null; SA.gps = null;
  if(SA.beaconHide) SA.beaconHide();
}

SA.hooks.key.push(code=>{
  if(code !== 'KeyE' || SA.modalOpen || SA.trial || SA.mission) return false;
  const c = cur();
  if(!c) return false;
  if(c.type === 'taxi'){
    if(SA.taxi) endTaxi();
    else {
      SA.taxi = {fares:0, target:roadPoint(350)};
      SA.toast('Taxi shift started — pick up the fare on the map.');
      Audio.tone(600,900,.08,.15,'square');
    }
    return true;
  }
  if(c.cop){
    if(SA.vig) endVig();
    else {
      SA.vig = {kills:0, target:roadPoint(300), sus:null};
      SA.toast('Vigilante started — get to the crime scene!');
      Audio.tone(500,900,.08,.15,'square');
    }
    return true;
  }
  return false;
});

SA.addUpd(dt=>{
  if(SA.taxi){
    const c = cur();
    if(!c){ endTaxi(); }
    else {
      const t = SA.taxi;
      SA.gps = {x:t.target.x, z:t.target.z};
      if(SA.beaconShow) SA.beaconShow(t.target.x, t.target.z);
      if(Math.hypot(c.p.x-t.target.x, c.p.z-t.target.z) < 14){
        const pay = 80 + t.fares*40;
        cash += pay; Audio.money(); t.fares++;
        if(t.fares >= 8){
          cash += 500;
          SA.toast('Shift complete! 8 fares — $500 bonus.');
          endTaxi();
        } else {
          t.target = roadPoint(350);
          SA.toast('Fare delivered! +$'+pay+' — next pickup');
        }
      }
    }
  }
  if(SA.vig){
    const c = cur();
    if(!c){ endVig(); }
    else {
      const v = SA.vig;
      if(!v.sus){
        SA.gps = {x:v.target.x, z:v.target.z};
        if(SA.beaconShow) SA.beaconShow(v.target.x, v.target.z);
        if(Math.hypot(c.p.x-v.target.x, c.p.z-v.target.z) < 20){
          const p = new Ped();
          p.g.position.set(v.target.x, 0, v.target.z);
          p.g.rotation.y = Math.random()*6.28;
          p.missionTag = 'vig';
          peds.push(p);
          v.sus = p;
          SA.toast('Suspect spotted — take them down!');
          Audio.tone(900,1400,.1,.2,'square');
        }
      } else {
        const s = v.sus;
        SA.gps = {x:s.g.position.x, z:s.g.position.z};
        if(SA.beaconShow) SA.beaconShow(s.g.position.x, s.g.position.z);
        if(s.state === 'rag'){
          const pay = 200 + v.kills*50;
          v.kills++;
          cash += pay; Audio.money();
          SA.toast('Suspect down! +$'+pay);
          v.sus = null;
          if(v.kills >= 5){
            cash += 1000;
            SA.toast('Vigilante complete — $1000 bonus!');
            endVig();
          } else {
            v.target = roadPoint(300);
          }
        } else if(Math.hypot(s.g.position.x-c.p.x, s.g.position.z-c.p.z) > 600){
          v.sus = null;
          v.target = roadPoint(300);
        }
      }
    }
  }
});

/* ============================================================
   G. STATS ROWS
   ============================================================ */
SA.hooks.afterBuild = SA.hooks.afterBuild || [];
SA.hooks.afterBuild.push(()=>{
  SA.statsSections = SA.statsSections || [];
  SA.statsSections.push(()=>{
    let s = '';
    s += '<div class="mrow"><span>NITRO</span><span class="v">'+Math.round(SA.nitro||0)+'%</span></div>';
    s += '<div class="mrow"><span>JETPACK</span><span class="v">'+(SA.jetUnlocked?'UNLOCKED (J)':'locked')+'</span></div>';
    s += '<div class="mrow"><span>CHEATS</span><span class="v">'+(SA.cheats?SA.cheats.length:0)+' codes</span></div>';
    return s;
  });
});

console.log('[SA] extras ready (weapons, nitro, jetpack, cheats, save/load, taxi, vigilante)');
})();
