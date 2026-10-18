/* ============================================================
   PART 18: BOOT / INTEGRATION
   Runs the chunked world build, wraps the game loop, patches
   HUD + daylight + minimap, big map, pause menu, stats panel.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;

/* ---------- loop wrapper ---------- */
const _loop = window.loop;
SA.t = 0; SA._last = performance.now(); SA.dt = .016;
window.loop = function(now){
  if(now===undefined) now = performance.now();
  SA.dt = Math.min((now - SA._last)/1000, .05);
  SA._last = now; SA.t += SA.dt;
  SA.pre();
  _loop(now);
  SA.post();
};
SA.pre = function(){
  SA.zoneUpdate();
};
SA.post = function(){
  const dt = SA.dt;
  for(let i=0;i<SA.updates.length;i++){
    try{ SA.updates[i](dt); }
    catch(e){ console.error('[SA upd]',e); SA.updates.splice(i,1); i--; }
  }
  SA._slowT = (SA._slowT||0) + dt;
  if(SA._slowT > .34){
    SA._slowT = 0;
    for(const f of SA.slowUpd){ try{ f(); }catch(e){ console.error('[SA slow]',e); } }
    if(SA._mapOpen) SA.drawBigMap();
  }
  SA.deadCheck();
  SA.clouds(dt);
  SA.autosaveT = (SA.autosaveT||0) + dt;
  if(SA.autosaveT > 240){ SA.autosaveT = 0; if(started && !SA.modalOpen) SA.saveGame(true); }
  SA.hudExtras();
};

/* death -> respawn at safehouse/hospital */
SA._dead = false;
SA.deadCheck = function(){
  if(player.deadT > 0){ SA._dead = true; return; }
  if(!SA._dead) return;
  SA._dead = false;
  const rp = SA.respawnPoint ? SA.respawnPoint() : null;
  if(rp){
    player.x = rp.x; player.z = rp.z;
    player.y = SA.terrainH(rp.x, rp.z) + .05; player.vy = 0;
    camera.position.set(player.x, player.y + 7, player.z + 9);
  }
};

/* clouds follow the player (base loop keeps them near origin) */
SA.cloudOff = null;
SA.clouds = function(dt){
  if(!SA.cloudOff) SA.cloudOff = clouds.map(c=>c.position.x);
  const R = 950;
  for(let i=0;i<clouds.length;i++){
    SA.cloudOff[i] += dt * 3.2;
    let ox = SA.cloudOff[i] - player.x;
    ox = ((ox + R) % (2*R) + 2*R) % (2*R) - R;
    clouds[i].position.x = player.x + ox;
    let oz = clouds[i].position.z - player.z;
    oz = ((oz + R) % (2*R) + 2*R) % (2*R) - R;
    clouds[i].position.z = player.z + oz;
  }
};

/* zone splash */
SA.zoneUpdate = function(){
  const z = SA.zoneAt(player.x, player.z);
  if(z.n !== SA._zn){
    SA._zn = z.n;
    SA.zoneSplash(z.n);
    for(const f of (SA.zoneFns||[])){ try{ f(z); }catch(e){} }
  }
};

/* hud extras (wanted 6-star, vehicle name, underwater overlay) */
SA.hudExtras = function(){
  if(wanted !== SA._hw){
    SA._hw = wanted;
    const n = Math.ceil(Math.min(6, wanted));
    SA.$('want').textContent = (wanted > .05 && n >= 1) ? '★'.repeat(n) + '☆'.repeat(6 - n) : '-';
  }
  if(cash !== SA._hc){ SA._hc = cash; SA.$('cash').textContent = '$' + cash.toLocaleString('en-US'); }
  const pc = cur();
  const nm = pc ? (pc.displayName || '') : '';
  if(nm !== SA._hudVn){ SA._hudVn = nm; SA.hudRefs.vehname.textContent = nm; }
  SA.hudRefs.underw.style.display = SA.underwater ? 'block' : 'none';
};

/* ---------- patches ---------- */
const _tryFire = window.tryFire;
window.tryFire = function(){ if(SA.uiOpen) return; return _tryFire.apply(this, arguments); };

const _hudUpdate = window.hudUpdate;
window.hudUpdate = function(){
  _hudUpdate();
  const g = SA.hudRefs;
  g.armor.style.width = clamp(SA.armor, 0, 100) + '%';
  g.stamRow.style.display = (SA.stamina < 99.4) ? 'block' : 'none';
  g.stam.style.width = clamp(SA.stamina, 0, 100) + '%';
  g.breathRow.style.display = (SA.breath < 99.9 || SA.underwater) ? 'block' : 'none';
  g.breath.style.width = clamp(SA.breath, 0, 100) + '%';
};

const _daylight = window.daylight;
window.daylight = function(){
  _daylight();
  const alt = clamp((player.y - 60) / 220, 0, 1);
  scene.fog.near = lerp(lerp(140, 70, rainV), 55, alt);
  scene.fog.far  = lerp(lerp(2600, 950, rainV), 750, alt);
};

/* ---------- shared blip collection ---------- */
SA.blipFns = [];
SA.eachBlip = function(cb){
  for(const k in missionMarkers){ const m = missionMarkers[k]; if(m.mesh.visible) cb(m.x, m.z, '#ffd700', 6); }
  if(M.mode==='delivery') for(const c of M.cps) if(!c.done) cb(c.x, c.z, '#33ddff', 6);
  if(M.deliverMarker) cb(M.deliverMarker.x, M.deliverMarker.z, '#33ff88', 7);
  if(M.tcar && M.phase===1) cb(M.tcar.p.x, M.tcar.p.z, '#2f7fff', 7);
  if(M.target) cb(M.target.g.position.x, M.target.g.position.z, '#ff3030', 7);
  for(const g of garages) cb(g.markerX, g.z0, '#22cc55', 5);
  cb(shopSpots.ammu.markerX, shopSpots.ammu.zMarker, '#ff8080', 5);
  for(const c of cars){ if(c.cop) cb(c.p.x, c.p.z, '#40a0ff', 5); }
  for(let i=0;i<SA.blipFns.length;i++){ try{ SA.blipFns[i](cb); }catch(e){} }
};

/* ---------- minimap (baked world map + blips + GPS) ---------- */
SA.zoomLevels = [.42, .21, .10];
SA.miniS = .42;
window.minimap = function(){
  const pc = cur();
  const px = pc ? pc.p.x : player.x, pz = pc ? pc.p.z : player.z;
  const ang = pc ? pc.psi : player.yaw;
  const S2 = SA.miniS;
  mc.clearRect(0, 0, 190, 190);
  mc.save();
  mc.beginPath(); mc.arc(95, 95, 93, 0, 7); mc.clip();
  if(SA.mapCanvas){
    const msc = SA.mapCanvas.width / 7200;
    const cxp = (px + 3600) * msc, czp = (pz + 3600) * msc;
    const half = (95 / S2) * msc;
    mc.imageSmoothingEnabled = true;
    mc.drawImage(SA.mapCanvas, cxp - half, czp - half, half * 2, half * 2, 0, 0, 190, 190);
  } else {
    mc.fillStyle = '#2f5a35'; mc.fillRect(0, 0, 190, 190);
  }
  if(SA.turfDraw) SA.turfDraw(mc, px, pz, S2);
  const blip = (x, z, color, size) => {
    const bx = 95 + (x - px) * S2, bz = 95 + (z - pz) * S2;
    if(bx < 4 || bx > 186 || bz < 4 || bz > 186) return;
    mc.fillStyle = color; mc.fillRect(bx - size/2, bz - size/2, size, size);
  };
  SA.eachBlip(blip);
  /* GPS route line */
  if(SA.gps){
    const gx = 95 + (SA.gps.x - px) * S2, gz = 95 + (SA.gps.z - pz) * S2;
    const dx = gx - 95, dz = gz - 95, mag = Math.hypot(dx, dz);
    const k = Math.min(1, 216 / Math.max(mag, .001));
    mc.strokeStyle = '#ffd700'; mc.lineWidth = 2.4; mc.setLineDash([7, 6]);
    mc.beginPath(); mc.moveTo(95, 95); mc.lineTo(95 + dx * k, 95 + dz * k); mc.stroke();
    mc.setLineDash([]);
    const dist = Math.hypot(SA.gps.x - px, SA.gps.z - pz);
    mc.font = '700 10px Arial'; mc.textAlign = 'center';
    mc.strokeStyle = 'rgba(0,0,0,.8)'; mc.lineWidth = 3;
    const txt = Math.round(dist) + ' m';
    mc.strokeText(txt, 95, 181); mc.fillStyle = '#ffd700'; mc.fillText(txt, 95, 181);
  }
  mc.translate(95, 95);
  mc.rotate(-(ang) + Math.PI);
  mc.fillStyle = '#f33';
  mc.beginPath(); mc.moveTo(0, -9); mc.lineTo(6, 7); mc.lineTo(-6, 7); mc.closePath(); mc.fill();
  mc.restore();
};

/* ---------- big map (TAB) ---------- */
SA._mapOpen = false;
SA.toggleMap = function(){
  const w = SA.hudRefs.mapwrap;
  SA._mapOpen = w.style.display !== 'block';
  if(SA._mapOpen){
    try{ document.exitPointerLock(); }catch(e){}
    const cv = SA.$('bigmap');
    const s = Math.max(420, Math.min(innerWidth - 110, innerHeight - 110, 940));
    cv.width = s; cv.height = s;
    cv.style.width = s + 'px'; cv.style.height = s + 'px';
    w.style.display = 'block';
    SA.drawBigMap();
  } else {
    w.style.display = 'none';
  }
  SA.uiOpen = SA.modalOpen || SA._mapOpen;
};
SA.drawBigMap = function(){
  const cv = SA.$('bigmap');
  if(!cv || !SA._mapOpen) return;
  const g = cv.getContext('2d'); const s = cv.width;
  const W2PX = v => (v + 3600) / 7200 * s;
  g.clearRect(0, 0, s, s);
  if(SA.mapCanvas){ g.imageSmoothingEnabled = true; g.drawImage(SA.mapCanvas, 0, 0, s, s); }
  else { g.fillStyle = '#1a2c1e'; g.fillRect(0, 0, s, s); }
  if(SA.turfDrawMap) SA.turfDrawMap(g, W2PX, s);
  /* region labels */
  g.font = '700 13px Arial'; g.textAlign = 'center';
  const labels = [['LOS SANTOS',0,0],['SAN FIERRO',-2920,-1620],['LAS VENTURAS',1520,-2000],
    ['RED COUNTY',-320,-1800],['BONE COUNTY',1150,-2700],['MOUNT CHILIAD',-1750,-2980],
    ['FLINT COUNTY',-1950,-2300],['TIERRA ROBADA',-1050,-3150],['AREA 69',1165,-2600]];
  for(const L of labels){
    const X = W2PX(L[1]), Z = W2PX(L[2]);
    g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(L[0], X, Z);
    g.fillStyle = '#f2e9c8'; g.fillText(L[0], X, Z);
  }
  /* blips */
  SA.eachBlip((x, z, color, size) => {
    g.fillStyle = color;
    g.fillRect(W2PX(x) - size/2, W2PX(z) - size/2, size, size);
  });
  /* gps */
  const pc = cur();
  const px = pc ? pc.p.x : player.x, pz = pc ? pc.p.z : player.z;
  const ang = pc ? pc.psi : player.yaw;
  if(SA.gps){
    g.strokeStyle = '#ffd700'; g.lineWidth = 3; g.setLineDash([10, 8]);
    g.beginPath(); g.moveTo(W2PX(px), W2PX(pz)); g.lineTo(W2PX(SA.gps.x), W2PX(SA.gps.z)); g.stroke();
    g.setLineDash([]);
  }
  g.save();
  g.translate(W2PX(px), W2PX(pz));
  g.rotate(-(ang) + Math.PI);
  g.fillStyle = '#ff4444';
  g.beginPath(); g.moveTo(0, -11); g.lineTo(7, 8); g.lineTo(-7, 8); g.closePath(); g.fill();
  g.restore();
};

/* ---------- action registry for modal buttons ---------- */
SA.actions = {};
SA.bindModalButtons = function(){
  const btns = SA.$('modal').querySelectorAll('button[data-a]');
  for(const b of btns){
    b.onclick = () => { const f = SA.actions[b.dataset.a]; if(f) f(b); };
  }
};
SA.openPanel = function(html){ SA.openModal(html); SA.bindModalButtons(); };

/* ---------- pause menu (P) ---------- */
SA.menuSections = [];
SA.toggleMenu = function(){
  if(SA.modalOpen){ SA.closeModal(); return; }
  let sec = '';
  for(const s of SA.menuSections){ try{ sec += '<h2 style="font-size:14px;margin-top:14px">'+s.title+'</h2>'+(s.html?('<div class="note">'+s.html()+'</div>'):''); }catch(e){} }
  SA.openPanel(
    '<h2>SAN ANDREAS</h2><div class="msub">PAUSE MENU · '+SA.VER+'</div>'+
    '<div class="btns">'+
    '<button data-a="resume">RESUME</button>'+
    '<button data-a="save" class="alt">SAVE GAME</button>'+
    '<button data-a="load" class="alt">LOAD GAME</button>'+
    '<button data-a="stats" class="alt">STATS (T)</button>'+
    '<button data-a="map" class="alt">MAP (TAB)</button>'+
    '</div>'+ sec +
    '<div class="note"><b>CONTROLS</b><br>'+
    'WASD move/drive · SHIFT sprint/descend · SPACE jump/handbrake/ascend · F enter-exit vehicle · V camera view · C crouch · Q look back<br>'+
    'G recruit / dismiss gang · E start activity / talk · N nitro · J jetpack (after flight school) · R weather · M mute<br>'+
    '1 fists · 2 bat · 3 pistol · 4 SMG · 5 shotgun · 6 AK · 7 sniper · 8 rocket · 0 spraycan<br>'+
    'In car: ARROWS radio station · SPACE handbrake · SHIFT+SPACE hydraulics (lowriders) · E start taxi/vigilante/etc<br>'+
    'In plane: W/S pitch · A/D roll · SPACE throttle up · SHIFT throttle down · Q/E rudder · F exit (dangerous)<br>'+
    'In heli: W/S tilt · A/D yaw · SPACE up · SHIFT down · In boat: W/S throttle · A/D steer<br>'+
    'TAB map · T stats · Z minimap zoom · Cheat codes can be typed anytime (see below)</div>'+
    '<div class="note"><b>CHEAT CODES:</b> '+ (SA.cheats.length? SA.cheats.map(c=>c.code+' ('+c.name+')').join(' · ') : 'collect them...') +'</div>'
  );
  SA.actions.resume = () => SA.closeModal();
  SA.actions.save = () => { SA.saveGame(); SA.closeModal(); };
  SA.actions.load = () => { SA.loadGame(); SA.closeModal(); };
  SA.actions.stats = () => { SA.closeModal(); SA.toggleStats(); };
  SA.actions.map = () => { SA.closeModal(); SA.toggleMap(); };
};

/* ---------- stats panel (T) ---------- */
SA.statsSections = [];
SA.toggleStats = function(){
  if(SA.modalOpen){ SA.closeModal(); return; }
  let html = '<h2>CHARACTER</h2><div class="msub">'+SA.zoneAt(player.x,player.z).n+' · '+Math.floor((tod*24+6)%24)+':'+String(Math.floor(((tod*24+6)%24)%1*60)).padStart(2,'0')+'</div>';
  html += '<div class="cols"><div class="col">';
  html += '<div class="mrow"><span>MONEY</span><span class="v">$'+cash.toLocaleString('en-US')+'</span></div>';
  html += '<div class="mrow"><span>HEALTH</span><span class="v">'+Math.round(player.hp)+'</span></div>';
  html += '<div class="mrow"><span>ARMOR</span><span class="v">'+Math.round(SA.armor)+'</span></div>';
  for(const s of SA.statsSections){ try{ html += s(); }catch(e){} }
  html += '</div><div class="col">';
  html += '<div class="mrow"><span>POSITION</span><span class="v">'+Math.round(player.x)+' , '+Math.round(player.z)+'</span></div>';
  html += '<div class="mrow"><span>PLAYED</span><span class="v">'+Math.floor(SA.t/60)+' min</span></div>';
  html += '<div class="mrow"><span>DISTANCE DRIVEN</span><span class="v">'+Math.round((SA.statDrive||0)/1000)+' km</span></div>';
  html += '<div class="mrow"><span>DISTANCE ON FOOT</span><span class="v">'+Math.round((SA.statFoot||0)/1000)+' km</span></div>';
  html += '</div></div><div class="btns"><button data-a="resume2">RESUME</button></div>';
  SA.openPanel(html);
  SA.actions.resume2 = () => SA.closeModal();
};

/* distance stats */
SA.statDrive = 0; SA.statFoot = 0;
let lastPX = null, lastPZ = null;
SA.addUpd(function(){
  if(lastPX === null){ lastPX = player.x; lastPZ = player.z; return; }
  const d = Math.hypot(player.x - lastPX, player.z - lastPZ);
  if(d < 40){
    if(cur()) SA.statDrive += d; else SA.statFoot += d;
  }
  lastPX = player.x; lastPZ = player.z;
});

/* ---------- key routing for new hotkeys ---------- */
SA.hooks.key.push(code => {
  if(code === 'KeyZ'){
    SA.miniS = SA.zoomLevels[(SA.zoomLevels.indexOf(SA.miniS) + 1) % SA.zoomLevels.length];
    return true;
  }
  if(code === 'Tab'){ SA.toggleMap(); return true; }
  if(code === 'KeyP'){ SA.toggleMenu(); return true; }
  if(code === 'KeyT'){ SA.toggleStats(); return true; }
  return false;
});
SA.hooks.uiKey.push(code => {
  if(code === 'Tab'){ SA.toggleMap(); return true; }
  if(code === 'KeyP' || code === 'Escape'){ if(SA.modalOpen) SA.closeModal(); else if(SA._mapOpen) SA.toggleMap(); return true; }
  if(code === 'KeyT'){ SA.toggleStats(); return true; }
  return false;
});

/* welcome hint after the player clicks start */
(function(){
  const msg = document.getElementById('msg');
  if(msg) msg.addEventListener('click', () => {
    setTimeout(() => {
      if(!SA._greeted){
        SA._greeted = true;
        sub('Welcome to San Andreas! TAB = map · T = stats · P = menu', 6);
      }
    }, 900);
  });
})();

/* ---------- world build bootstrap ---------- */
SA.hooks.afterBuild = SA.hooks.afterBuild || [];
SA.addBuild('world map', () => SA.bakeMap());
setTimeout(() => {
  const msg = document.getElementById('msg');
  if(msg) msg.style.pointerEvents = 'none';
  console.log('[SA] building world...');
  SA.runBuild(() => {
    SA.buildDone = true;
    if(msg) msg.style.pointerEvents = '';
    SA.prog(false);
    for(const f of SA.hooks.afterBuild){ try{ f(); }catch(e){ console.error('[SA afterBuild]', e); } }
    console.log('[SA] world ready', SA.VER);
  });
}, 90);
console.log('[SA] boot ready');
})();
