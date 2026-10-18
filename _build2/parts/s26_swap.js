/* ============================================================
   PART 26: REAL 3D MODELS — Quaternius CC0 packs + poly.pizza GLBs (payload in part 25)
   Cars, peds, gang peds, player, boats, planes, bikes and helicopters
   swap to real GLB models while every gameplay system (AI, physics,
   damage, lights, gang colours, LOD) keeps driving the original hidden geometry.
   Appends: window.SA.mdl3d
   ============================================================ */
(function () {
"use strict";
var SA = window.SA;
if (!SA) return;
var MDL = window.SA_MDL;
if (!MDL || !window.THREE || !THREE.GLTFLoader || !THREE.SkeletonUtils) return;

var SRGB = !!(SA.gfx && SA.gfx.enc === 'srgb');
function lin(hex) { var c = new THREE.Color(hex); if (SRGB) c.convertSRGBToLinear(); return c; }
function tagL(m) { if (m) { m.userData = m.userData || {}; m.userData.saC = 'lin'; } return m; }
function mkm(hex, rough, metal) {
  return tagL(new THREE.MeshStandardMaterial({ color: lin(hex), roughness: rough, metalness: metal }));
}
function emiss(hex, ehex, inten, rough) {
  return tagL(new THREE.MeshStandardMaterial({
    color: lin(hex), emissive: lin(ehex), emissiveIntensity: inten, roughness: rough || .3, metalness: .1
  }));
}

/* ---------- shared model materials ---------- */
var M_TIRE = mkm(0x14161a, .94, .02);
var M_RIM  = mkm(0xb9bec7, .30, .85);
var M_TRIMG = mkm(0x6d7278, .45, .40);
var M_LH = emiss(0xfff2d6, 0xffe9c0, .35, .22);
var M_LT = emiss(0x8c1616, 0xd42222, .30, .28);
var M_LB = emiss(0x2036cc, 0x2244ff, .70, .30);
var M_LW = emiss(0xeeeef6, 0xffffff, .45, .30);

/* ---------- payload decode ---------- */
function b64buf(d) {
  var i = d.indexOf(',') + 1, s = atob(d.slice(i)), u = new Uint8Array(s.length);
  for (var k = 0; k < s.length; k++) u[k] = s.charCodeAt(k);
  return u.buffer;
}

var T = { cars: {}, chars: [], planes: {}, ships: {}, bikes: {}, helis: {} };
var need = 0, done = 0, bad = [];
function parseGLB(b64, cb) {
  need++;
  try {
    new THREE.GLTFLoader().parse(b64buf(b64), '', function (g) {
      done++;
      try { cb(g.scene); } catch (e) { bad.push(String(e && e.message || e)); }
      step();
    }, function (e) {
      done++; bad.push(String(e && e.message || e));
      step();
    });
  } catch (e) {
    done++; bad.push(String(e && e.message || e));
    step();
  }
}
function step() { if (done >= need) queueInstall(); }

for (var ck in MDL.cars) (function (k) {
  parseGLB(MDL.cars[k].d, function (s) { T.cars[k] = s; });
})(ck);
for (var sk in MDL.chars) (function (k) {
  parseGLB(MDL.chars[k].d, function (s) { T.chars.push({ name: k, sex: MDL.chars[k].sex, scene: s }); });
})(sk);
for (var pk in MDL.planes) (function (k) {
  parseGLB(MDL.planes[k].d, function (s) { T.planes[k] = s; });
})(pk);
for (var bk in MDL.ships) (function (k) {
  parseGLB(MDL.ships[k].d, function (s) { T.ships[k] = s; });
})(bk);
if (MDL.bikes) for (var mbk in MDL.bikes) (function (k) {
  parseGLB(MDL.bikes[k].d, function (s) { T.bikes[k] = s; });
})(mbk);
if (MDL.helis) for (var mhk in MDL.helis) (function (k) {
  parseGLB(MDL.helis[k].d, function (s) { T.helis[k] = s; });
})(mhk);

/* ---------- character rig helpers ---------- */
function makeRig(root) {
  root.updateMatrixWorld(true);
  var rootQ = new THREE.Quaternion();
  root.getWorldQuaternion(rootQ);
  var b = {}, q0 = {};
  root.traverse(function (n) {
    if (!n.isBone) return;
    var nm = n.name.replace(/\./g, '');
    if (!b[nm]) { b[nm] = n; q0[nm] = n.quaternion.clone(); }
  });
  var cache = {};
  function axIn(name, axis) {
    var key = name + axis;
    if (cache[key]) return cache[key];
    var bone = b[name];
    if (!bone) return null;
    var qp = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootQ);
    var v = axis === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
    return cache[key] = v.applyQuaternion(qp).normalize();
  }
  var rig = { b: b, q0: q0, ax: {} };
  rig.ax.ulL = axIn('UpperLegL', 'x'); rig.ax.ulR = axIn('UpperLegR', 'x');
  rig.ax.llL = axIn('LowerLegL', 'x'); rig.ax.llR = axIn('LowerLegR', 'x');
  rig.ax.uaLx = axIn('UpperArmL', 'x'); rig.ax.uaRx = axIn('UpperArmR', 'x');
  rig.ax.uaLz = axIn('UpperArmL', 'z'); rig.ax.uaRz = axIn('UpperArmR', 'z');
  rig.ax.laLz = axIn('LowerArmL', 'z'); rig.ax.laRz = axIn('LowerArmR', 'z');
  return rig;
}

var _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
var DOWN_L = -1.25, DOWN_R = 1.25;

function setB(rig, name, axisV, ang) {
  var bone = rig.b[name];
  if (!bone || !axisV || !isFinite(ang)) return;
  _q2.setFromAxisAngle(axisV, ang);
  bone.quaternion.copy(rig.q0[name]).premultiply(_q2);
}
function poseRig(rig, thL, thR, arL, arR) {
  if (!rig) return;
  if (!isFinite(thL)) thL = 0;
  if (!isFinite(thR)) thR = 0;
  if (!isFinite(arL)) arL = 0;
  if (!isFinite(arR)) arR = 0;
  setB(rig, 'UpperLegL', rig.ax.ulL, thL);
  setB(rig, 'UpperLegR', rig.ax.ulR, thR);
  setB(rig, 'LowerLegL', rig.ax.llL, Math.max(0, -thL) * 1.05);
  setB(rig, 'LowerLegR', rig.ax.llR, Math.max(0, -thR) * 1.05);
  var bL = rig.b.UpperArmL, bR = rig.b.UpperArmR;
  if (bL) {
    bL.quaternion.copy(rig.q0.UpperArmL);
    _q1.setFromAxisAngle(rig.ax.uaLz || rig.ax.uaLx, DOWN_L);
    bL.quaternion.premultiply(_q1);
    _q1.setFromAxisAngle(rig.ax.uaLx || rig.ax.uaLz, arL * 1.35);
    bL.quaternion.premultiply(_q1);
  }
  if (bR) {
    bR.quaternion.copy(rig.q0.UpperArmR);
    _q1.setFromAxisAngle(rig.ax.uaRz || rig.ax.uaRx, DOWN_R);
    bR.quaternion.premultiply(_q1);
    _q1.setFromAxisAngle(rig.ax.uaRx || rig.ax.uaRz, arR * 1.35);
    bR.quaternion.premultiply(_q1);
  }
  var lbL = rig.b.LowerArmL, lbR = rig.b.LowerArmR;
  if (lbL && rig.ax.laLz) { _q1.setFromAxisAngle(rig.ax.laLz, -.14); lbL.quaternion.copy(rig.q0.LowerArmL).premultiply(_q1); }
  if (lbR && rig.ax.laRz) { _q1.setFromAxisAngle(rig.ax.laRz, .14); lbR.quaternion.copy(rig.q0.LowerArmR).premultiply(_q1); }
}

/* ---------- base-visual hiding ---------- */
function hideMeshes(root) {
  root.traverse(function (o) {
    if (o.isSprite) return;                 /* ped arrow / mission markers stay */
    if (o.isMesh || o.isSkinnedMesh) o.visible = false;
  });
}

/* ---------- cloth recolour ---------- */
function paintCloth(mesh, color) {
  var mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  var out = mats.map(function (m) {
    if (!m) return m;
    var mn = (m.name || '').toLowerCase();
    if (/skin|eye|brow|hair|lash|mouth|teeth|tongue/.test(mn)) return m;
    var m2 = m.clone();
    var c = m.color;
    var mean = c ? (c.r + c.g + c.b) / 3 : .7;
    var lum = Math.max(.35, Math.min(1.2, .35 + mean * .9));
    m2.color.copy(color).multiplyScalar(lum);
    tagL(m2);
    return m2;
  });
  mesh.material = Array.isArray(mesh.material) ? out : out[0];
}
function findCloth(g, player) {
  var res = { shirt: null, pants: null };
  g.traverse(function (o) {
    if (!(o.isMesh || o.isSkinnedMesh) || !o.geometry || !o.geometry.parameters) return;
    var gp = o.geometry.parameters, gt = o.geometry.type;
    if (gt !== 'BoxGeometry') return;
    if (!player) {
      if (!res.shirt && Math.abs((gp.height || 0) - .72) < .02) res.shirt = o.material;
      if (!res.pants && Math.abs((gp.height || 0) - .85) < .02) res.pants = o.material;
    } else {
      if (!res.shirt && Math.abs((gp.width || 0) - .62) < .03) res.shirt = o.material;
      if (!res.pants && Math.abs((gp.width || 0) - .2) < .03 && Math.abs((gp.height || 0) - .78) < .03) res.pants = o.material;
    }
  });
  return res;
}

/* ---------- ped retrofit ---------- */
function pickTpl(pref) {
  if (!T.chars.length) return null;
  var pool = [];
  for (var i = 0; i < T.chars.length; i++) if (!pref || T.chars[i].sex === pref) pool.push(T.chars[i]);
  if (!pool.length) pool = T.chars;
  return pool[(Math.random() * pool.length) | 0];
}
function retrofitPed(p, tpl) {
  if (!p || p._mdl3) return;
  var g = p.g;
  if (!g || !p.legs || !p.arms) return;
  var isPlayer = (p === pModel);
  if (!tpl) tpl = pickTpl(null);
  if (!tpl) return;
  var cloth = findCloth(g, isPlayer);
  var root = THREE.SkeletonUtils.clone(tpl.scene);
  if (!root) return;
  root.traverse(function (n) {
    if (n.isMesh || n.isSkinnedMesh) n.castShadow = true;
  });
  var shirt = cloth.shirt && cloth.shirt.color ? cloth.shirt.color : null;
  var pants = cloth.pants && cloth.pants.color ? cloth.pants.color : null;
  root.traverse(function (n) {
    if (!(n.isMesh || n.isSkinnedMesh)) return;
    var nm = n.name || '';
    if (/_body/i.test(nm) && shirt) paintCloth(n, shirt);
    else if (/_legs/i.test(nm) && pants) paintCloth(n, pants);
  });
  hideMeshes(g);
  g.add(root);
  p._saLook = true;                 /* block part 22 from adding box-era extras */
  p._mdl3 = { root: root, rig: makeRig(root), vis: true, tpl: tpl.name };
  PEDN++;
}

/* ---------- car retrofit ---------- */
function carTpl(c) {
  if (c.cop) return T.cars.Cop;
  switch (c.type) {
    case 'taxi': return T.cars.Taxi;
    case 'van': return T.cars.SUV;
    case 'truck': return T.cars.SUV;
    case 'sports': return Math.random() < .5 ? T.cars.SportsCar : T.cars.SportsCar2;
    default: return Math.random() < .5 ? T.cars.NormalCar1 : T.cars.NormalCar2;
  }
}
function retrofitCar(c) {
  if (!c || c._mdl3 || !c.body) return;
  if (c.kind === 'heli') { retrofitHeli(c); return; }
  var tpl = null, meta = null, isPlane = false, isBoat = false, isBike = false;
  if (c.kind === 'boat') { tpl = T.ships.boat; meta = MDL.ships.boat; isBoat = true; }
  else if (c.kind === 'plane') { tpl = T.planes.plane; meta = MDL.planes.plane; isPlane = true; }
  else if (c.kind === 'bike') { tpl = T.bikes.bike; meta = MDL.bikes.bike; isBike = true; }
  else if (c.kind === undefined) { tpl = carTpl(c); }
  if (!tpl) return;
  c._saLook = true;                 /* block part 22 box-era details */

  /* clearcoat paint (mirrors part 22 if its pass hasn't run yet) */
  if (!c.cop && c.paintM && !c.paintM._saPhys) {
    var oldP = c.paintM;
    var pm2 = new THREE.MeshPhysicalMaterial({
      color: oldP.color ? oldP.color.clone() : lin(0x9aa0a8),
      roughness: .30 + Math.random() * .10, metalness: .6,
      clearcoat: 1, clearcoatRoughness: .16
    });
    pm2.userData.saEnv = Math.min(1.7, ((SA.gfx && SA.gfx.env) || .45) * 3.6);
    pm2.envMapIntensity = pm2.userData.saEnv;
    oldP._saPhys = pm2;
    c.paintM = pm2;
  }

  var root = tpl.clone(true);
  root.traverse(function (n) { if (n.isMesh || n.isSkinnedMesh) { n.castShadow = true; } });

  /* orient: length along Z */
  root.updateMatrixWorld(true);
  var bb = new THREE.Box3().setFromObject(root);
  var sz = bb.getSize(new THREE.Vector3());
  if (sz.x > sz.z * 1.12) { root.rotation.y = Math.PI / 2; }
  if (meta && meta.yaw) root.rotation.y += meta.yaw;
  root.updateMatrixWorld(true);
  bb.setFromObject(root); bb.getSize(sz);

  /* scale to collision length */
  var sc = (c.d && c.d.len ? c.d.len : 4.4) / Math.max(sz.z, .01);
  if (c.type === 'truck') sc *= .84;
  root.scale.setScalar(sc);
  root.updateMatrixWorld(true);
  bb.setFromObject(root);
  root.position.y = -bb.min.y - (isBoat ? -.25 : .05);   /* ground it, cancel body lift */

  /* material rebind */
  var perCar = [];
  var copWhite = null;
  function darkPaint() {
    if (!c._mdl3dark) {
      c._mdl3dark = tagL(c.paintM.clone());
      c._mdl3dark.color = c.paintM.color.clone().multiplyScalar(.42);
      c._mdl3dark.roughness = Math.min(1, (c.paintM.roughness || .4) + .25);
      perCar.push(c._mdl3dark);
    }
    return c._mdl3dark;
  }

  /* bike: tint the fairing/tank 'Blue' material to the spawn colour */
  var bikeTint = null;
  if (isBike && c.paintM && c.paintM.color) {
    var blu = null;
    root.traverse(function (n) {
      if (blu || !(n.isMesh || n.isSkinnedMesh) || !n.material) return;
      if (/^blue$/i.test(n.material.name || '')) blu = n.material;
    });
    if (blu) {
      bikeTint = tagL(blu.clone());
      var bmAvg = blu.color ? (blu.color.r + blu.color.g + blu.color.b) / 3 : .6;
      bikeTint.color.copy(c.paintM.color).multiplyScalar(Math.max(.6, Math.min(1.5, .5 + bmAvg * .75)));
      perCar.push(bikeTint);
    }
  }

  root.traverse(function (n) {
    if (!(n.isMesh || n.isSkinnedMesh)) return;
    var m = n.material;
    if (!m) return;
    var nm = m.name || '';
    var mm = m;
    if (nm === 'Paint') {
      if (c.cop) {
        if (!copWhite) {
          copWhite = tagL(new THREE.MeshStandardMaterial({ color: lin(0xf0f0f2), roughness: .38, metalness: .25 }));
          perCar.push(copWhite);
        }
        mm = copWhite;
      } else {
        mm = c.paintM || m;
      }
    }
    else if (nm === 'PaintDark') mm = darkPaint();
    else if (nm === 'Glass' || nm === 'Windows') mm = (typeof glass !== 'undefined' ? glass : m);
    else if (nm === 'TrimBlack') mm = (typeof junkMat !== 'undefined' ? junkMat : m);
    else if (nm === 'TrimGrey') mm = M_TRIMG;
    else if (nm === 'LampHead') mm = c.headM || M_LH;
    else if (nm === 'LampTail') mm = c.tailM || M_LT;
    else if (nm === 'LampWhite') mm = (c.cop && c.red) ? c.red.material : M_LW;
    else if (nm === 'LampBlue') mm = (c.cop && c.blue) ? c.blue.material : M_LB;
    else if (nm === 'Tire') mm = M_TIRE;
    else if (nm === 'Rim') mm = M_RIM;
    else if (bikeTint && /^blue$/i.test(nm)) mm = bikeTint;
    if (mm !== m) { tagL(mm); n.material = mm; }
    else { tagL(m); }
  });

  /* hide original visuals */
  var kids = c.body.children;
  for (var i = 0; i < kids.length; i++) if (kids[i] !== root) kids[i].visible = false;
  if (c.wheels) for (var w = 0; w < c.wheels.length; w++) c.wheels[w].w.visible = false;

  /* wheel nodes (spin + steer) */
  var wn = {};
  root.traverse(function (n) {
    var nm = n.name || '';
    if (!/wheel/i.test(nm)) return;
    if (/frontleft/i.test(nm)) wn.fl = n;
    else if (/frontright/i.test(nm)) wn.fr = n;
    else if (/back/i.test(nm)) wn.bk = n;
  });
  var wheels = null;
  if (wn.fl || wn.fr || wn.bk) {
    wheels = { fl: wn.fl, fr: wn.fr, bk: wn.bk };
    if (wn.fl) wheels.flQ = wn.fl.quaternion.clone();
    if (wn.fr) wheels.frQ = wn.fr.quaternion.clone();
    if (wn.bk) wheels.bkQ = wn.bk.quaternion.clone();
  }

  /* bike wheels: geometry bakes the pivot at the model origin — re-pivot each
     wheel at its own centre so it spins on its axle; front also steers */
  var bikeW = null;
  if (isBike && meta && meta.wheels) {
    function rePivot(node) {
      if (!node || !node.parent) return null;
      var par = node.parent;
      var ctr = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());
      par.worldToLocal(ctr);
      var pv = new THREE.Group();
      pv.rotation.order = 'YXZ';
      pv.position.copy(ctr);
      node.position.sub(ctr);
      par.add(pv); pv.add(node);
      return pv;
    }
    var fN = root.getObjectByName(meta.wheels.front) ||
      root.getObjectByName(String(meta.wheels.front).replace(/\./g, ''));
    var rN = root.getObjectByName(meta.wheels.rear) ||
      root.getObjectByName(String(meta.wheels.rear).replace(/\./g, ''));
    if (fN) bikeW = { front: rePivot(fN), rear: rePivot(rN) };
  }

  /* propeller (planes) — runtime strips dots from node names */
  var prop = null;
  if (isPlane && meta && meta.prop) {
    prop = root.getObjectByName(meta.prop) ||
      root.getObjectByName(String(meta.prop).replace(/\./g, '')) || null;
  }

  c.body.add(root);
  c._mdl3 = {
    root: root, wheels: wheels, bikeW: bikeW, prop: prop, dyn: perCar, burnt: false,
    copWhite: copWhite
  };
  if (isBike) BIKEN++;
  CARN++;
}

/* ---------- helicopter retrofit ---------- */
var HELIN = 0;
var HELI_LEN = 7.8;                /* fuselage length of the box heli being replaced */
function retrofitHeli(c) {
  if (!c || c._mdl3 || !c.body || !c.rotor) return;
  var key = (HELIN % 2) ? 'heli1' : 'heli0';
  var tpl = T.helis[key], meta = MDL.helis[key];
  if (!tpl && T.helis.heli0) { tpl = T.helis.heli0; meta = MDL.helis.heli0; }
  if (!tpl || !meta) return;
  c._saLook = true;                  /* block part 22 box-era details */

  var root = tpl.clone(true);
  root.traverse(function (n) { if (n.isMesh || n.isSkinnedMesh) n.castShadow = true; });

  var th = meta.yaw || 0;
  var sc = HELI_LEN / Math.max(meta.len || 27, .01);
  root.rotation.y = th;
  root.scale.setScalar(sc);

  /* align the model's rotor mast with the box heli's rotor axis (car origin) */
  var mx = (meta.mast && meta.mast.x) || 0, mz = (meta.mast && meta.mast.z) || 0;
  var bx = mx * Math.cos(th) + mz * Math.sin(th);
  var bz = -mx * Math.sin(th) + mz * Math.cos(th);
  root.position.x = -bx * sc;
  root.position.z = -bz * sc;
  root.updateMatrixWorld(true);
  var bb = new THREE.Box3().setFromObject(root);
  root.position.y = -bb.min.y - .05; /* ground it, cancel body lift */
  c.body.add(root);

  /* reuse the box heli's spinning rotor cross, moved + scaled onto the model mast */
  var rotY = (meta.rotor && meta.rotor.y ? meta.rotor.y : 9.4) * sc + .04;
  var rotS = (meta.rotor && meta.rotor.r ? (meta.rotor.r * sc) : 3.2) / 2.8;
  c.rotor.position.set(0, rotY, 0);
  c.rotor.scale.setScalar(rotS);

  /* hide every box part except the spinning rotor (tail rotor too — the model
     carries its own; its static blades read fine at rest) */
  var kids = c.body.children;
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i];
    if (k !== root && k !== c.rotor) k.visible = false;
  }
  if (c.wheels) for (var w = 0; w < c.wheels.length; w++) c.wheels[w].w.visible = false;

  c._mdl3 = {
    root: root, wheels: null, bikeW: null, prop: null, dyn: [], burnt: false, heli: true
  };
  HELIN++; CARN++;
}

/* ---------- per-frame ---------- */
var _qs = new THREE.Quaternion(), _qy = new THREE.Quaternion();
var AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);
var tickN = 0, errN = 0;
function warnOnce(e) {
  errN++;
  if (errN < 4) console.warn('[SA mdl]', e && e.message || e);
}

function animPed(p, px, pz) {
  var m = p._mdl3;
  if (!m) return;
  var gp = p.g.position;
  var dx = gp.x - px, dz = gp.z - pz, d2 = dx * dx + dz * dz;
  var vis = d2 < 28900;                     /* 170 m */
  if (vis !== m.vis) { m.vis = vis; m.root.visible = vis; }
  if (!vis || d2 > 3600) return;            /* bones within 60 m */
  poseRig(m.rig, p.legs[0].rotation.x, p.legs[1].rotation.x, p.arms[0].rotation.x, p.arms[1].rotation.x);
}

function tick(dt) {
  if (!(dt > 0)) dt = 1 / 60;
  var px = player.x, pz = player.z, i, c, m;
  for (i = 0; i < cars.length; i++) {
    c = cars[i]; m = c._mdl3;
    if (!m) continue;
    if (m.wheels && c.wheels && c.wheels.length) {
      var w0 = c.wheels[0];
      var spin = w0.w.rotation.x, steer = w0.front ? w0.pv.rotation.y : 0;
      var wh = m.wheels;
      _qs.setFromAxisAngle(AX, spin);
      _qy.setFromAxisAngle(AY, steer);
      if (wh.bk) wh.bk.quaternion.copy(wh.bkQ).multiply(_qs);
      if (wh.fl) { wh.fl.quaternion.copy(wh.flQ).multiply(_qs).premultiply(_qy); }
      if (wh.fr) { wh.fr.quaternion.copy(wh.frQ).multiply(_qs).premultiply(_qy); }
    }
    if (m.bikeW && c.wheels && c.wheels.length >= 2) {
      var fw0 = c.wheels[0], rw0 = c.wheels[1];
      if (m.bikeW.front) {
        m.bikeW.front.rotation.x = fw0.w.rotation.x;
        m.bikeW.front.rotation.y = fw0.pv ? fw0.pv.rotation.y : 0;
      }
      if (m.bikeW.rear) m.bikeW.rear.rotation.x = rw0.w.rotation.x;
    }
    if (m.prop) m.prop.rotateZ(dt * 42);
    if (c.dead && !m.burnt) {
      m.burnt = true;
      for (var d0 = 0; d0 < m.dyn.length; d0++) m.dyn[d0].color = lin(0x1a1a1a);
    }
  }
  for (i = 0; i < peds.length; i++) animPed(peds[i], px, pz);
  var gp = SA.gangPeds || [];
  for (i = 0; i < gp.length; i++) animPed(gp[i], px, pz);
  var pm = pModel._mdl3;
  if (pm) poseRig(pm.rig, pModel.legs[0].rotation.x, pModel.legs[1].rotation.x, pModel.arms[0].rotation.x, pModel.arms[1].rotation.x);
  tickN++;
  if ((tickN & 63) === 0) scanAll();
}

/* ---------- scanning / install ---------- */
var CARN = 0, PEDN = 0, BIKEN = 0, installed = false;
function scanAll() {
  var i;
  for (i = 0; i < cars.length; i++) { try { retrofitCar(cars[i]); } catch (e) { warnOnce(e); } }
  for (i = 0; i < peds.length; i++) { try { retrofitPed(peds[i]); } catch (e) { warnOnce(e); } }
  var gp = SA.gangPeds || [];
  for (i = 0; i < gp.length; i++) {
    try {
      if (!gp[i]._mdl3) retrofitPed(gp[i], pickTpl(Math.random() < .85 ? 'm' : 'w'));
    } catch (e) { warnOnce(e); }
  }
  try { if (!pModel._mdl3) retrofitPed(pModel, null); } catch (e) { warnOnce(e); }
}

function install() {
  if (installed) return;
  installed = true;
  scanAll();
  SA.addUpd(tick);
  SA.mdl3d = {
    ready: true, cars: function () { return CARN; }, peds: function () { return PEDN; },
    rescan: scanAll, bad: bad, models: {
      cars: Object.keys(T.cars).length, chars: T.chars.length,
      planes: Object.keys(T.planes).length, ships: Object.keys(T.ships).length,
      bikes: Object.keys(T.bikes).length, helis: Object.keys(T.helis).length
    }
  };
  console.log('[SA mdl] real 3D models active — cars ' + CARN + ' (' + BIKEN + ' bikes, ' + HELIN + ' helis), peds ' + PEDN +
    ', templates ' + Object.keys(T.cars).length + 'c/' + T.chars.length + 'p' +
    (bad.length ? ' (' + bad.length + ' failed)' : ''));
  console.log('[SA mdl] credits: cars/peds/boats/planes Quaternius (CC0); bike Suzuki SV650 Paul Spooner (CC-BY); helicopters jeremy (CC-BY), kazuma (CC0) — via poly.pizza');
  if (bad.length) console.warn('[SA mdl] failed payloads:', bad.slice(0, 3));
}

function queueInstall() {
  var tries = 0;
  function go() {
    try { install(); }
    catch (e) {
      installed = false;
      if (++tries < 24) setTimeout(go, 250);
      else console.warn('[SA mdl] install failed:', e && e.message || e);
    }
  }
  setTimeout(go, 0);
}
})();
