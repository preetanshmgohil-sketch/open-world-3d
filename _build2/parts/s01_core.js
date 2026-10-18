/* ============================================================
   SAN ANDREAS EXPANSION - PART 01: CORE
   Namespace / world registry / UI injection / key routing / saves
   Appended-only: the original script above is never modified.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA = window.SA || {};
SA.VER = 'SA-EXPANSION-1.0';

/* ---------- global constants ---------- */
SA.WATER_Y   = -2.6;          // ocean level (matches original water plane)
SA.SWIM_Y    = -2.6 + .55;    // buoyant player height
SA.WORLD     = 3550;          // hard movement bound
SA.ISLAND_R  = 1500;          // original island radius (terrain untouched inside)
SA.BOUND_LS  = 500;           // original play bound (kept for LS behaviour)

/* ---------- zones (name splash + region lookups). north = -z ---------- */
SA.zones = [
 {n:'Los Santos',               t:'city',    x0:-560, x1:560,  z0:-560,  z1:560 },
 {n:'Grove Street',             t:'city',    x0:-620, x1:-330, z0:-760,  z1:-540 },
 {n:'Los Santos International', t:'city',    x0:-180, x1:300,  z0:-1150, z1:-760 },
 {n:'Verona Beach',             t:'beach',   x0:-780, x1:-560, z0:-300,  z1:300 },
 {n:'Julius Thruway',           t:'bridge',  x0:-160, x1:80,   z0:-1560, z1:-1150 },
 {n:'Red County',               t:'country', x0:-1100,x1:700,  z0:-2150, z1:-1400 },
 {n:'Blueberry',                t:'town',    x0:-520, x1:-120, z0:-1900, z1:-1600 },
 {n:'Dillimore',                t:'town',    x0:220,  x1:520,  z0:-2050, z1:-1750 },
 {n:'Palomino Creek',           t:'country', x0:560,  x1:1000, z0:-1950, z1:-1550 },
 {n:'Flint County',             t:'forest',  x0:-2700,x1:-1150,z0:-2700, z1:-1750 },
 {n:'Back o Beyond',            t:'forest',  x0:-2500,x1:-1500,z0:-3300, z1:-2500 },
 {n:'Mount Chiliad',            t:'mountain',x0:-2300,x1:-1250,z0:-3350, z1:-2500 },
 {n:'San Fierro Bay',           t:'water',   x0:-2500,x1:-1950,z0:-1900, z1:-1150 },
 {n:'San Fierro',               t:'city',    x0:-3400,x1:-2350,z0:-2250, z1:-1150 },
 {n:'Doherty',                  t:'city',    x0:-3400,x1:-2700,z0:-1750, z1:-1200 },
 {n:'Calton Heights',           t:'city',    x0:-3050,x1:-2500,z0:-2000, z1:-1600 },
 {n:'Tierra Robada',            t:'desert',  x0:-1500,x1:-500, z0:-3500, z1:-2800 },
 {n:'Bone County',              t:'desert',  x0:0,    x1:2100, z0:-3200, z1:-2050 },
 {n:'Las Venturas',             t:'city',    x0:950,  x1:2150, z0:-2450, z1:-1550 },
 {n:'The Strip',                t:'city',    x0:1380, x1:1650, z0:-2450, z1:-1650 },
 {n:'Area 69',                  t:'desert',  x0:950,  x1:1400, z0:-2800, z1:-2400 },
 {n:'Verdant Meadows',          t:'desert',  x0:60,   x1:640,  z0:-2950, z1:-2500 },
 {n:'Big Ear',                  t:'desert',  x0:280,  x1:640,  z0:-2500, z1:-2200 },
 {n:'El Castillo del Diablo',   t:'desert',  x0:-500, x1:60,   z0:-3000, z1:-2600 },
];
SA.zoneAt = function(x,z){
  for(let i=0;i<SA.zones.length;i++){const s=SA.zones[i];
    if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1)return s}
  return {n:(Math.abs(x)>1350||Math.abs(z)>1350)?'San Andreas':'Los Santos',t:'wild'};
};

/* ---------- generic state containers ---------- */
SA.roads   = [];   // {pts:[[x,z],...], w, kind, ys:[], bridge, name}
SA.pads    = [];   // {x0,x1,z0,z1,y,edge,name}
SA.props   = {};   // per-part prop registries
SA.collectibles = []; // {kind,x,y,z,got,mesh}
SA.updates = [];   // per-frame updaters fn(dt)
SA.slowUpd = [];   // ~3Hz updaters
SA.hooks   = {save:[], load:[], key:[], click:[]};
SA.inside  = {ls:true};

SA.addUpd  = f => SA.updates.push(f);
SA.addSlow = f => SA.slowUpd.push(f);

/* ---------- HUD / CSS injection ---------- */
const css = document.createElement('style');
css.textContent = `
#armor{height:100%;width:0;background:#d8dee8}
#stam{height:100%;width:100%;background:#e8b93a}
#breath{height:100%;width:100%;background:#4fc3f7}
#vehname{font-weight:800;color:#ffd700;letter-spacing:1px;margin-top:2px;min-height:16px}
#radio{font-weight:800;color:#ffcf5e;letter-spacing:.5px;margin-top:2px;min-height:16px}
#radio .g{color:#9fb2c0;font-weight:600;font-size:11px}
#zones{position:absolute;left:0;right:0;bottom:176px;text-align:center;pointer-events:none;opacity:0;transition:opacity .6s;z-index:16}
#zones .zn{display:inline-block;font:800 26px Arial;color:#fff;text-shadow:0 2px 8px #000;letter-spacing:2px;padding:2px 16px;background:rgba(0,0,0,.35);border-bottom:2px solid #ffd700}
#mcard{position:absolute;right:18px;bottom:138px;background:rgba(30,10,50,.86);border-left:4px solid #c060ff;padding:8px 14px;text-align:right;display:none;z-index:16}
#mcard .mt{font:700 11px Arial;color:#c9a0ff;letter-spacing:2px}
#mcard .mn{font:800 17px Arial;color:#fff}
#dlg{position:absolute;left:0;right:0;bottom:124px;display:none;pointer-events:none;z-index:16}
#dlg .box{max-width:820px;margin:0 auto;background:rgba(0,0,0,.78);border-left:5px solid #ffd700;padding:10px 16px}
#dlg .who{font:800 13px Arial;color:#ffd700;letter-spacing:1px}
#dlg .txt{font:500 15px/1.35 Arial;color:#f2f2f2}
#acthud{position:absolute;left:50%;transform:translateX(-50%);bottom:152px;font:800 14px Arial;color:#7fe0ff;text-shadow:0 1px 2px #000;text-align:center;display:none;z-index:16}
#saprog{position:absolute;left:50%;transform:translateX(-50%);bottom:40px;width:420px;display:none;font:700 12px Arial;color:#ffe082;text-align:center;text-shadow:0 1px 2px #000;z-index:22;pointer-events:none}
#saprog .bar{height:6px;background:#222;border:1px solid #000;margin-top:5px}
#saprog .bar i{display:block;height:100%;width:0;background:#ffd700}
#modal{position:absolute;inset:0;display:none;background:rgba(4,6,10,.72);z-index:40}
#modal .win{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);min-width:420px;max-width:760px;max-height:86vh;overflow:auto;background:rgba(12,14,18,.96);border:2px solid #ffd700;border-radius:4px;padding:18px 22px;font-family:Arial;pointer-events:auto}
#modal h2{margin:0 0 4px;font:800 20px Arial;color:#ffd700;letter-spacing:1px}
#modal .msub{font:600 11px Arial;color:#9fb2c0;margin-bottom:12px;letter-spacing:1px}
#modal .mrow{display:flex;justify-content:space-between;gap:18px;padding:4px 2px;font:600 13px Arial;color:#e8e8e8;border-bottom:1px solid #23262c;align-items:center}
#modal .mrow .v{color:#ffd700;font-weight:800;white-space:nowrap}
#modal .bar2{flex:1;height:9px;background:#23262c;margin:0 8px;border-radius:2px;overflow:hidden;min-width:90px}
#modal .bar2 i{display:block;height:100%;background:#3fae5a}
#modal .btns{margin-top:14px;display:flex;flex-wrap:wrap;gap:8px}
#modal button{font:800 12px Arial;letter-spacing:1px;color:#101418;background:#ffd700;border:0;padding:9px 14px;cursor:pointer;border-radius:2px;pointer-events:auto}
#modal button.alt{background:#3a4048;color:#e8e8e8}
#modal button:disabled{background:#333;color:#777;cursor:default}
#modal button:hover:enabled{filter:brightness(1.12)}
#modal .note{font:600 11px Arial;color:#9fb2c0;margin-top:10px;line-height:1.6}
#modal .note b{color:#ffd700}
#modal .big{font:800 34px Arial;color:#fff;text-align:center;letter-spacing:2px;margin:6px 0}
#modal .cols{display:flex;gap:26px;flex-wrap:wrap}
#modal .col{flex:1;min-width:260px}
#mapwrap{position:absolute;inset:0;display:none;background:rgba(4,6,10,.85);z-index:38}
#bigmap{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:2px solid #ffd700;background:#10161c}
#reels{display:flex;gap:10px;justify-content:center;margin:14px 0}
#reels .re{width:74px;height:96px;background:#0b0e12;border:2px solid #ffd700;border-radius:4px;font:800 44px/96px Arial;color:#ffd700;text-align:center;overflow:hidden}
#roul{display:block;margin:8px auto}
.cheatItem{font:600 12px Arial;color:#9fb2c0;padding:2px 0}
.cheatItem b{color:#ffd700}
#underw{position:absolute;inset:0;background:rgba(10,50,90,.34);display:none;pointer-events:none;z-index:5}
.repRow{display:flex;align-items:center;gap:8px;font:700 12px Arial;color:#e8e8e8;padding:3px 0}
.repRow .dot{width:12px;height:12px;border-radius:2px}
#dlg .box.yt{border-left-color:#63e463}
#satoast{position:absolute;left:50%;transform:translateX(-50%);bottom:236px;background:rgba(0,0,0,.74);border-left:4px solid #7fe0ff;padding:6px 16px;font:700 13px Arial;color:#eaf6ff;display:none;z-index:17;pointer-events:none;max-width:560px;text-align:center}
`;
document.head.appendChild(css);

/* add rows into the original #ui (health bar style preserved) */
const ui = document.getElementById('ui');
function uiRow(html, id){
  const d = document.createElement('div');
  d.className = 'row sabar'; if(id) d.id = id;
  d.innerHTML = html; ui.appendChild(d); return d;
}
uiRow('<b>ARMOR</b><div class="bar"><div id="armor"></div></div>');
const stamRow = uiRow('<b>STA</b><div class="bar"><div id="stam"></div></div>','stamRow');
const breathRow = uiRow('<b>AIR</b><div class="bar"><div id="breath"></div></div>','breathRow');
stamRow.style.display = 'none';
breathRow.style.display = 'none';
const vnRow = uiRow('<div id="vehname"></div><div id="radio"></div>','vnRow');

function ov(id, parent, html){
  const e = document.createElement('div'); e.id = id;
  if(html!==undefined) e.innerHTML = html;
  (parent||document.body).appendChild(e); return e;
}
ov('underw');
ov('zones', document.body, '<div class="zn"></div>');
ov('mcard', document.body, '<div class="mt">MISSION</div><div class="mn"></div>');
ov('dlg', document.body, '<div class="box"><div class="who"></div><div class="txt"></div></div>');
ov('acthud');
ov('satoast');
ov('saprog', document.body, '<span class="cap">Building San Andreas...</span><div class="bar"><i></i></div>');
ov('mapwrap', document.body, '<canvas id="bigmap" width="760" height="700"></canvas>');
const modal = ov('modal', document.body, '<div class="win"></div>');

SA.$ = id => document.getElementById(id);
SA.hudRefs = {armor:SA.$('armor'), stamRow, breathRow, stam:SA.$('stam'), breath:SA.$('breath'),
 vehname:SA.$('vehname'), radio:SA.$('radio'), zones:SA.$('zones'), mcard:SA.$('mcard'),
 dlg:SA.$('dlg'), acthud:SA.$('acthud'), saprog:SA.$('saprog'), toast:SA.$('satoast'),
 modal, underw:SA.$('underw'), mapwrap:SA.$('mapwrap'), vnRow};

/* ---------- modal framework (menus / shops / casino) ---------- */
SA.uiOpen = false;
SA.modalOpen = false;
SA.openModal = function(html, onClose){
  modal.querySelector('.win').innerHTML = html;
  modal.style.display = 'block';
  SA.modalOpen = true; SA.uiOpen = true;
  try{document.exitPointerLock()}catch(e){}
  SA._modalClose = onClose || null;
};
SA.closeModal = function(){
  modal.style.display = 'none';
  SA.modalOpen = false;
  SA.uiOpen = SA.$('mapwrap').style.display === 'block';
  if(SA._modalClose){const f=SA._modalClose;SA._modalClose=null;f()}
};
modal.addEventListener('mousedown', e=>{ if(e.target===modal) SA.closeModal(); });

SA.toastRadio = function(text,genre){
  const r = SA.hudRefs.radio;
  r.innerHTML = text + (genre?'<div class="g">'+genre+'</div>':'');
  clearTimeout(SA._rt); SA._rt = setTimeout(()=>{r.innerHTML=''}, 3400);
};
SA.zoneSplash = function(name){
  if(SA._lastZone===name) return;
  SA._lastZone = name;
  const z = SA.hudRefs.zones;
  z.querySelector('.zn').textContent = name;
  z.style.opacity = 1;
  clearTimeout(SA._zt);
  SA._zt = setTimeout(()=>{z.style.opacity=0}, 2900);
};
SA.missionCard = function(name, on){
  const m = SA.hudRefs.mcard;
  if(on===false){m.style.display='none';return}
  m.querySelector('.mn').textContent = name;
  m.style.display = 'block';
  clearTimeout(SA._mct);
  SA._mct = setTimeout(()=>{m.style.display='none'}, 4600);
};
SA.dialog = function(who,text,dur){
  const d = SA.hudRefs.dlg;
  if(!who){d.style.display='none';return}
  d.querySelector('.who').textContent = who;
  d.querySelector('.txt').textContent = text;
  d.style.display = 'block';
  clearTimeout(SA._dt);
  if(dur) SA._dt = setTimeout(()=>{d.style.display='none'}, dur*1000);
};
SA.act = function(text, on){
  const a = SA.hudRefs.acthud;
  if(!text||on===false){a.style.display='none';return}
  a.innerHTML = text; a.style.display = 'block';
  a.dataset.owner = 'act';
};
SA.toast = function(text, dur){
  const t = SA.hudRefs.toast;
  t.textContent = text; t.style.display = 'block';
  clearTimeout(SA._tt);
  SA._tt = setTimeout(()=>{ t.style.display = 'none'; }, (dur||2.6)*1000);
};
SA.prog = function(label,frac){
  const p = SA.hudRefs.saprog;
  if(label===false){p.style.display='none';return}
  p.style.display='block';
  if(label) p.querySelector('.cap').textContent = label;
  p.querySelector('.bar i').style.width = Math.round(frac*100)+'%';
};

/* ---------- key routing (capture phase blocks base handler while UI is open) ---------- */
SA.cheatBuf = '';
SA.cheats = [];
SA.hooks.uiKey = [];
window.addEventListener('keydown', e=>{
  const k = e.code;
  if(SA.uiOpen){
    if(/^(Key|Digit|Space|Arrow|Tab|Escape|Shift|Control|Alt)/.test(k)){
      e.stopPropagation();
      for(const f of SA.hooks.uiKey){ if(f(k,e)===true){ e.preventDefault(); break; } }
    }
    return;
  }
  if(/^Key[A-Z]$/.test(k)) SA.cheatBuf = (SA.cheatBuf + k.slice(3)).slice(-26);
  else if(/^Digit[0-9]$/.test(k)) SA.cheatBuf = (SA.cheatBuf + k.slice(5)).slice(-26);
  for(const c of SA.cheats){ if(SA.cheatBuf.endsWith(c.code)){ SA.cheatBuf=''; c.run(); break } }
  for(const f of SA.hooks.key){ if(f(k,e)===true){ e.preventDefault(); break } }
}, true);
window.addEventListener('mousedown', e=>{
  if(!SA.uiOpen) for(const f of SA.hooks.click){ if(f(e)===true) break; }
}, true);
window.addEventListener('keydown', e=>{ if(e.code==='Tab') e.preventDefault(); }, true);

/* ---------- save / load ---------- */
SA.SAVEKEY = 'ow3d_sa_save_v1';
SA.buildSave = function(){
  const o = {v:1, t:Date.now(), base:{cash, wanted, tod, weather:weather.target,
    px:player.x, pz:player.z, py:player.y, hp:player.hp, ammo:player.ammo, bat:player.bat, weapon:player.weapon},
    sa:{}};
  for(const h of SA.hooks.save){ try{h(o.sa)}catch(err){console.warn('save hook',err)} }
  return o;
};
SA.applySave = function(o){
  if(!o||o.v!==1) return false;
  const b=o.base;
  cash=b.cash; wanted=b.wanted; tod=b.tod; weather.target=b.weather;
  if(!cur()){ player.x=b.px; player.z=b.pz; player.y=b.py||0; }
  player.hp=b.hp; player.ammo=b.ammo; player.bat=b.bat; player.weapon=b.weapon;
  for(const h of SA.hooks.load){ try{h(o.sa)}catch(err){console.warn('load hook',err)} }
  sub('Game loaded.'); return true;
};
SA.saveGame = function(quiet){
  try{
    localStorage.setItem(SA.SAVEKEY, JSON.stringify(SA.buildSave()));
    if(!quiet){ sub('Game saved.'); Audio.pick(); }
    return true;
  }catch(e){ sub('Save failed: '+e.message); return false }
};
SA.loadGame = function(){
  try{
    const raw = localStorage.getItem(SA.SAVEKEY);
    if(!raw){ sub('No save found.'); return false }
    return SA.applySave(JSON.parse(raw));
  }catch(e){ sub('Load failed: '+e.message); return false }
};
SA.hasSave = function(){ try{ return !!localStorage.getItem(SA.SAVEKEY) }catch(e){ return false } };

/* ---------- shared fx / world helpers (world part overrides groundY) ---------- */
SA.splash = function(x,y,z,n){ fxSparks(x,y,z,n,2.2,.75,.85,.95); };
SA.groundY = function(x,z){ return terrainH(x,z); };
SA.inWater = function(x,z){ return terrainH(x,z) < SA.WATER_Y - .35; };

/* ---------- misc shared state ---------- */
SA.crouch = false;
SA.stamina = 100;
SA.breath = 100;
SA.armor = 0;
SA.recruits = [];
SA.turf = {owned:0,total:0};
SA.buildDone = false;
console.log('[SA] core ready', SA.VER);
})();
