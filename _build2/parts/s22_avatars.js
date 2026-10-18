/* ============================================================
   PART 22: PEOPLE & RIDES — realism pass 2 (append-only)
   Textures: Polyhaven CC0 (denim / cotton jersey / linen /
   leather / rubber) embedded in part 20 + procedural face,
   tire tread, licence plate and lens maps generated here.
   Applied to: player, pedestrians, gang members and every
   vehicle (cars, bikes, boats, planes, helicopters) by
   swapping/mutating materials in place — no base edits.
   ============================================================ */
(function () {
"use strict";
var SA = window.SA;
if (!SA) return;
var T = window.SA_TEX || {};

var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
var rnd = function (a, b) { return a + Math.random() * (b - a); };
var step = function (n, f) { try { f(); } catch (e) { console.warn('[SA look] ' + n + ':', (e && e.message) || e); } };

var gfx2 = SA.gfx2 = { ready: false, cars: 0, peds: 0, player: false };
function srgbOn() { return !!(SA.gfx && SA.gfx.enc === 'srgb'); }
var ENV = (SA.gfx && SA.gfx.env) || .45;

var M = {};                 /* shared materials / textures */
var faceTexs = [], shirtSets = [], hairMats = [], plateMats = [];
var pedSeq = 0;

function lin(hex) {
  var c = new THREE.Color(hex);
  if (srgbOn()) c.convertSRGBToLinear();
  return c;
}
/* keep the filmic pipeline from converting our authored colours twice */
function tagLin(m) { if (m) { m.userData = m.userData || {}; m.userData.saC = 'lin'; } return m; }
function cnv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function ctex(c, srgb, rep) {
  var t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  if (rep) t.repeat.set(rep[0], rep[1]);
  t.needsUpdate = true;
  return t;
}
function loadImg(src) {
  return new Promise(function (res, rej) {
    var i = new Image();
    i.onload = function () { res(i); };
    i.onerror = function () { rej(new Error('img')); };
    i.src = src;
  });
}
function jtex(img, srgb, rep) {
  var t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  if (rep) t.repeat.set(rep[0], rep[1]);
  t.needsUpdate = true;
  return t;
}
/* luminance-neutralised detail from a photo (material colour then tints it) */
function neutral(img, size, contrast, target) {
  var c = cnv(size, size), g = c.getContext('2d');
  g.drawImage(img, 0, 0, size, size);
  var im = g.getImageData(0, 0, size, size), d = im.data;
  var sum = 0, i;
  for (i = 0; i < d.length; i += 4) sum += d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
  var mean = Math.max(1, sum / (d.length / 4));
  for (i = 0; i < d.length; i += 4) {
    var L = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
    var v = clamp(target * (1 + (L / mean - 1) * contrast), 0, 1) * 255 | 0;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
/* normal map from a height field (row-major, s x s) */
function normalFromHeight(H, s, strength) {
  var c = cnv(s, s), g = c.getContext('2d'), im = g.createImageData(s, s), d = im.data;
  for (var y = 0; y < s; y++) for (var x = 0; x < s; x++) {
    var i = y * s + x;
    var dx = (H[y * s + ((x + 1) % s)] - H[y * s + ((x + s - 1) % s)]) * strength;
    var dy = (H[((y + 1) % s) * s + x] - H[((y + s - 1) % s) * s + x]) * strength;
    var nx = -dx, ny = -dy, nz = 1, l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    d[i * 4] = (nx / l * .5 + .5) * 255;
    d[i * 4 + 1] = (ny / l * .5 + .5) * 255;
    d[i * 4 + 2] = (nz / l * .5 + .5) * 255;
    d[i * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

/* ---------------------------------------------------------- */
/*  procedural maps                                           */
/* ---------------------------------------------------------- */

/* tire tread: rubber photo base + circumferential grooves + sipes.
   texture serves both the tread (side UV) and the sidewall (cap UV) */
function buildTire(rubD, rubN) {
  var s = 256;
  var base = cnv(s, s), g = base.getContext('2d');
  g.drawImage(rubD, 0, 0, s, s);
  g.globalAlpha = .45; g.fillStyle = '#08080a'; g.fillRect(0, 0, s, s); g.globalAlpha = 1;

  var H = new Float32Array(s * s), im = g.getImageData(0, 0, s, s), d = im.data;
  var i, x, y;
  for (i = 0; i < d.length; i += 4) H[(i / 4 / s | 0) * s + (i / 4 % s)] = (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) / 255;

  function distC(x2, y2) { var u = x2 / s - .5, v = y2 / s - .5; return Math.sqrt(u * u + v * v); }
  /* tread: 3 circumferential grooves + staggered sipes (flat near cap centre) */
  var grooves = [.18, .42, .66, .9];
  for (y = 0; y < s; y++) for (x = 0; x < s; x++) {
    var u = x / s, v = y / s;
    var mask = clamp((distC(x, y) - .30) / .12, 0, 1);
    var hh = H[y * s + x] * .55;
    for (i = 0; i < grooves.length; i++) hh -= .5 * mask * Math.exp(-Math.pow((v - grooves[i]) / .028, 2));
    var band = (v * 8) | 0;
    var su = (u * 9 + (band % 2 ? .5 : 0)) % 1;
    if (su < .07) hh -= .22 * mask;
    H[y * s + x] = clamp(hh, 0, 1);
    /* darken the grooves a touch in the diffuse too */
    var dark = clamp((H[y * s + x] - (H[y * s + x] < .0 ? 0 : 0)), 0, 1);
    void dark;
  }
  /* sidewall rings for the caps */
  g.strokeStyle = 'rgba(46,46,52,.55)'; g.lineWidth = 5;
  g.beginPath(); g.arc(s / 2, s / 2, s * .205, 0, 7); g.stroke();
  g.beginPath(); g.arc(s / 2, s / 2, s * .148, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(16,16,20,.6)';
  for (i = 0; i < grooves.length; i++) {
    g.beginPath(); g.moveTo(0, grooves[i] * s); g.lineTo(s, grooves[i] * s); g.stroke();
  }

  M.tireD = ctex(base, true, null);
  M.tireN = ctex(normalFromHeight(H, s, 2.0), false, null);
  void rubN;
}

/* licence plates: reflective white, blue border, random SA-style code */
function plateCanvas(seed) {
  var c = cnv(220, 110), g = c.getContext('2d');
  var G = 14 + Math.floor(seed * 6), L = 'QWERTYUIOPASDFGHJKLZXCVBNM';
  var letters = '', digits = '';
  var r1 = Math.sin(seed * 127.1) * 43758.5453, r2 = Math.sin(seed * 311.7) * 24634.6345;
  r1 -= Math.floor(r1); r2 -= Math.floor(r2);
  for (var i = 0; i < 3; i++) { letters += L[(r1 * 26 + i * 7.3 | 0) % 26]; digits += String((r2 * 10 + i * 3.1 | 0) % 10); }
  g.fillStyle = '#f4f3ec'; g.fillRect(0, 0, 220, 110);
  g.strokeStyle = '#20418c'; g.lineWidth = 7; g.strokeRect(5, 5, 210, 100);
  g.fillStyle = '#20418c'; g.font = '700 15px Arial'; g.textAlign = 'center';
  g.fillText('SAN ANDREAS', 110, 26);
  g.fillStyle = '#1a1c22'; g.font = '800 46px "Arial Black",Arial'; g.textAlign = 'center';
  g.fillText(letters + ' ' + digits, 112, 80);
  g.fillStyle = '#c9a227'; g.fillRect(158, 88, 24, 12);
  g.fillStyle = '#20418c'; g.font = '700 9px Arial'; g.fillText('JUL', 178, 98);
  return c;
}

/* headlight / taillight lenses */
function lensCanvas(kind) {
  var s = 128, c = cnv(s, s), g = c.getContext('2d');
  if (kind === 'head') {
    var grd = g.createLinearGradient(0, 0, 0, s);
    grd.addColorStop(0, '#dfe6ee'); grd.addColorStop(.5, '#f6f8fb'); grd.addColorStop(1, '#c9d2dc');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(120,132,148,.5)';
    for (var y = 4; y < s; y += 8) g.fillRect(0, y, s, 2);
    g.fillStyle = 'rgba(150,160,175,.35)'; g.fillRect(0, 0, 3, s); g.fillRect(s - 3, 0, 3, s);
  } else {
    g.fillStyle = '#8f1218'; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,80,80,.55)';
    for (var x2 = 3; x2 < s; x2 += 10) g.fillRect(x2, 0, 3, s);
    for (var y2 = 3; y2 < s; y2 += 10) g.fillRect(0, y2, s, 3);
    g.fillStyle = 'rgba(60,4,8,.6)'; g.fillRect(0, 0, s, 5); g.fillRect(0, s - 5, s, 5);
  }
  return c;
}

/* a face sheet for a sphere head (front of the head faces local +Z = u .25) */
function faceCanvas(v) {
  var W = 512, H = 256, c = cnv(W, H), g = c.getContext('2d');
  var cx = W * .25, cy = H * .5;           /* face centre */
  g.fillStyle = '#e9e9e9'; g.fillRect(0, 0, W, H);
  /* subtle skin shading: crown slightly lit, jaw shaded */
  var grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, 'rgba(255,255,255,.10)');
  grd.addColorStop(.55, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,.16)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  /* side (ear) areas + temple shading */
  g.fillStyle = 'rgba(0,0,0,.05)';
  g.beginPath(); g.ellipse(cx - 78, cy + 12, 26, 32, .2, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + 78, cy + 12, 26, 32, -.2, 0, 7); g.fill();

  var eyeY = cy - 10, dx = 24, ex = [cx - dx, cx + dx];
  /* brow ridge shadow */
  g.fillStyle = 'rgba(0,0,0,.10)';
  g.beginPath(); g.ellipse(cx, eyeY - 16, 48, 13, 0, 0, 7); g.fill();
  /* eyes */
  for (var i = 0; i < 2; i++) {
    var x = ex[i], sgn = i ? 1 : -1;
    g.fillStyle = '#f2f1ee';
    g.beginPath(); g.ellipse(x, eyeY, 11, 7.2, sgn * .06, 0, 7); g.fill();
    var irisCol = ['#5b4632', '#3f5a78', '#4a6b52', '#2f2a26', '#6b5a3f', '#3a4a63'][v % 6];
    g.fillStyle = irisCol;
    g.beginPath(); g.arc(x + sgn * 1.5, eyeY + .5, 4.6, 0, 7); g.fill();
    g.fillStyle = '#0c0c0e';
    g.beginPath(); g.arc(x + sgn * 1.5, eyeY + .5, 2.2, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.beginPath(); g.arc(x + sgn * 1.5 - 1.4, eyeY - 1.2, .9, 0, 7); g.fill();
    /* lash line + lid */
    g.strokeStyle = 'rgba(20,16,14,.75)'; g.lineWidth = 2.4;
    g.beginPath(); g.ellipse(x, eyeY - 1, 11, 7.2, sgn * .06, 3.5, 6.2); g.stroke();
    g.strokeStyle = 'rgba(30,24,20,.35)'; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(x, eyeY - 2.4, 10.4, 5.6, sgn * .06, 3.4, 6.1); g.stroke();
  }
  /* brows */
  var browLift = [0, 3, 1, -2, 2, 0][v % 6];
  g.fillStyle = ['#2b211a', '#3a2b1e', '#1f1913', '#4a3a28', '#2e2620', '#33261c'][v % 6];
  g.save(); g.translate(cx - dx, eyeY - 15 - browLift);
  g.beginPath(); g.ellipse(0, 0, 15, 3.4, -.12, 0, 7); g.fill(); g.restore();
  g.save(); g.translate(cx + dx, eyeY - 15 - browLift);
  g.beginPath(); g.ellipse(0, 0, 15, 3.4, .12, 0, 7); g.fill(); g.restore();
  /* nose */
  g.fillStyle = 'rgba(0,0,0,.13)';
  g.beginPath(); g.moveTo(cx - 4, cy - 4); g.lineTo(cx + 4, cy - 4); g.lineTo(cx + 5.5, cy + 18); g.lineTo(cx - 5.5, cy + 18); g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,.30)';
  g.beginPath(); g.ellipse(cx - 5.4, cy + 19.5, 2.6, 1.8, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(cx + 5.4, cy + 19.5, 2.6, 1.8, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.28)';
  g.beginPath(); g.ellipse(cx, cy + 8, 2.6, 5.4, 0, 0, 7); g.fill();
  /* mouth + lips */
  var mo = [0, 1.5, -1, 2, 0, 1][v % 6];
  g.strokeStyle = 'rgba(70,34,30,.85)'; g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(cx - 17, cy + 33 + mo); g.quadraticCurveTo(cx, cy + 36 + mo * 1.6, cx + 17, cy + 33 + mo); g.stroke();
  g.strokeStyle = 'rgba(120,60,52,.42)'; g.lineWidth = 3.4;
  g.beginPath(); g.moveTo(cx - 15, cy + 37 + mo); g.quadraticCurveTo(cx, cy + 40 + mo * 1.6, cx + 15, cy + 37 + mo); g.stroke();
  /* jaw / beard variants */
  if (v === 2 || v === 4) {
    g.fillStyle = 'rgba(28,22,16,.30)';
    g.beginPath(); g.ellipse(cx, cy + 44, 34, 20, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(cx, cy + 30, 30, 13, 0, 3.3, 6.1); g.stroke();
  }
  if (v === 5) {          /* age lines */
    g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(cx - 20, cy + 3); g.lineTo(cx - 8, cy + 2); g.stroke();
    g.beginPath(); g.moveTo(cx + 8, cy + 2); g.lineTo(cx + 20, cy + 3); g.stroke();
    g.beginPath(); g.moveTo(cx - 6, cy - 22); g.lineTo(cx - 2, cy - 22); g.stroke();
    g.beginPath(); g.moveTo(cx + 2, cy - 22); g.lineTo(cx + 6, cy - 22); g.stroke();
  }
  return c;
}

/* ---------------------------------------------------------- */
/*  build shared materials                                    */
/* ---------------------------------------------------------- */
function buildShared(IMG) {
  /* shirts: two fabric options */
  shirtSets = [
    { d: ctex(neutral(IMG.jrs_d, 256, .85, .92), true, [1.6, 1.4]), n: ctex(IMG.jrs_n, false, [1.6, 1.4]) },
    { d: ctex(neutral(IMG.lin_d, 256, .85, .92), true, [1.4, 1.2]), n: ctex(IMG.lin_n, false, [1.4, 1.2]) }
  ];
  M.denimD = ctex(neutral(IMG.dnm_d, 256, .9, .90), true, [1.3, 1.3]);
  M.denimN = ctex(IMG.dnm_n, false, [1.3, 1.3]);
  M.ltrD = ctex(neutral(IMG.ltr_d, 256, .9, .86), true, [1, 1]);
  M.ltrN = ctex(IMG.ltr_n, false, [1, 1]);
  buildTire(IMG.rub_d, IMG.rub_n);

  for (var v = 0; v < 6; v++) faceTexs.push(ctex(faceCanvas(v), true, null));
  var hairCols = [0x16120f, 0x271b12, 0x3d2b19, 0x5a3f26, 0x77624a, 0x44464a, 0x2a2c30];
  for (var h = 0; h < hairCols.length; h++) {
    var hm = tagLin(new THREE.MeshStandardMaterial({ color: lin(hairCols[h]), roughness: .92, metalness: .02 }));
    hm.userData.saEnv = Math.min(.45, ENV * .8);
    hm.envMapIntensity = hm.userData.saEnv;
    hairMats.push(hm);
  }
  for (var p = 0; p < 8; p++) {
    var pm = tagLin(new THREE.MeshStandardMaterial({ map: ctex(plateCanvas(p * 1.37 + .11), true, null), roughness: .38, metalness: .12 }));
    pm.userData.saEnv = Math.min(1.1, ENV * 2.2);
    pm.envMapIntensity = pm.userData.saEnv;
    plateMats.push(pm);
  }
  M.lensHead = ctex(lensCanvas('head'), true, null);
  M.lensTail = ctex(lensCanvas('tail'), true, null);

  M.chrome = tagLin(new THREE.MeshStandardMaterial({ color: lin(0xc8ccd2), metalness: 1, roughness: .28 }));
  M.chrome.userData.saEnv = Math.min(1.9, ENV * 4);
  M.chrome.envMapIntensity = M.chrome.userData.saEnv;
  M.hubGeo = new THREE.CylinderGeometry(.165, .165, .035, 12).rotateZ(Math.PI / 2);
  M.shoeMats = [0x1a1917, 0x2b241d, 0x635c52, 0x121214].map(function (col) {
    var m = tagLin(new THREE.MeshStandardMaterial({ color: lin(col), roughness: .62, metalness: .04, map: M.ltrD, normalMap: M.ltrN }));
    m.normalScale.set(.4, .4);
    m.userData.saEnv = Math.min(.5, ENV * .8);
    m.envMapIntensity = m.userData.saEnv;
    return m;
  });
  M.shoeGeo = new THREE.BoxGeometry(.2, .1, .32);
  M.hairGeo = new THREE.SphereGeometry(.207, 10, 8, 0, 6.3, 0, 1.18);
  M.plateGeo = new THREE.BoxGeometry(.46, .12, .022);
  M.mirrorGeo = new THREE.BoxGeometry(.2, .1, .13);

  /* shared vehicle materials: tires, trim, glass */
  step('tire mat', function () {
    wheelMat.map = M.tireD; wheelMat.normalMap = M.tireN;
    wheelMat.normalScale.set(.5, .5);
    wheelMat.color = lin(0x121215);
    wheelMat.roughness = .93; wheelMat.metalness = .02;
    wheelMat.userData.saEnv = Math.min(.5, ENV * .8);
    wheelMat.envMapIntensity = wheelMat.userData.saEnv;
    wheelMat.needsUpdate = true;
  });
  step('trim mat', function () {
    junkMat.color = lin(0x3d4247); junkMat.metalness = .68; junkMat.roughness = .42;
    junkMat.userData.saEnv = Math.min(1.2, ENV * 2.4);
    junkMat.envMapIntensity = junkMat.userData.saEnv;
    junkMat.needsUpdate = true;
  });
  step('glass mat', function () {
    glass.color = lin(0x0a1219); glass.roughness = .05; glass.metalness = .35;
    glass.needsUpdate = true;
  });
}

/* ---------------------------------------------------------- */
/*  vehicle retrofit                                          */
/* ---------------------------------------------------------- */
function swapMat(root, from, to) {
  root.traverse(function (o) {
    if (!o.isMesh || !o.material || !from) return;
    if (Array.isArray(o.material)) {
      for (var i = 0; i < o.material.length; i++) if (o.material[i] === from) o.material[i] = to;
    } else if (o.material === from) o.material = to;
  });
}
function retroCar(c, idx) {
  if (!c || !c.g || c._saLook) return false;
  c._saLook = true;
  var D = c.d || {};
  var flying = c.flying || c.kind === 'plane' || c.kind === 'heli';
  var bike = c.kind === 'bike', boat = c.boat || c.kind === 'boat';

  /* paint -> clearcoat */
  step('paint', function () {
    var old = c.paintM;
    if (old && !old._saPhys) {
      var pm = new THREE.MeshPhysicalMaterial({
        color: (old.color && old.color.clone) ? old.color.clone() : lin(0x9aa0a8),
        roughness: rnd(.30, .40), metalness: .6,
        clearcoat: 1, clearcoatRoughness: .16
      });
      pm.userData.saEnv = Math.min(1.7, ENV * 3.6);
      pm.envMapIntensity = pm.userData.saEnv;
      old._saPhys = pm;
      c.paintM = pm;
      swapMat(c.g, old, pm);
    }
  });
  /* lenses */
  step('lights', function () {
    if (c.headM) { c.headM.map = M.lensHead; c.headM.emissiveMap = M.lensHead; c.headM.roughness = .18; c.headM.needsUpdate = true; }
    if (c.tailM) { c.tailM.map = M.lensTail; c.tailM.emissiveMap = M.lensTail; c.tailM.roughness = .22; c.tailM.needsUpdate = true; }
  });
  /* chrome hubs on every wheel */
  step('hubs', function () {
    var ws = c.wheels || [];
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i].w, pv = ws[i].pv;
      if (!w || w._saHub) continue;
      w._saHub = true;
      var centred = Math.abs((pv && pv.position.x) || 0) < .01;
      if (centred) {
        var h1 = new THREE.Mesh(M.hubGeo, M.chrome); h1.position.set(.165, 0, 0); w.add(h1);
        var h2 = new THREE.Mesh(M.hubGeo, M.chrome); h2.position.set(-.165, 0, 0); w.add(h2);
      } else {
        var hh = new THREE.Mesh(M.hubGeo, M.chrome);
        hh.position.set(pv.position.x >= 0 ? .165 : -.165, 0, 0);
        w.add(hh);
      }
    }
  });
  /* body details: mirrors + plates (road vehicles only) */
  if (!flying && !boat) {
    step('mirrors', function () {
      var b = c.body;
      if (!b || b._saMirror) return;
      b._saMirror = true;
      var y = (D.cabY || 1.4) - (D.cabH || .7) / 2 + .09;
      var z = -.22 + (D.cabL || 2) / 2 - .05;
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        var mm = new THREE.Mesh(M.mirrorGeo, c.paintM);
        mm.position.set(s2 * ((D.wid || 2.1) / 2 + .11), y, z);
        mm.castShadow = true;
        b.add(mm);
      }
    });
    step('plates', function () {
      var b = c.body;
      if (!b || b._saPlate) return;
      b._saPlate = true;
      var mat = plateMats[Math.abs(idx | 0) % plateMats.length];
      var rear = new THREE.Mesh(M.plateGeo, mat);
      rear.position.set(0, (D.ch || .8) + .24, -(D.len || 4.5) / 2 - .015);
      b.add(rear);
      if (!bike) {
        var front = new THREE.Mesh(M.plateGeo, mat);
        front.position.set(0, (D.ch || .8) + .28, (D.len || 4.5) / 2 + .015);
        b.add(front);
      }
    });
  }
  gfx2.cars++;
  return true;
}

/* ---------------------------------------------------------- */
/*  people retrofit                                           */
/* ---------------------------------------------------------- */
function retroPed(p) {
  if (!p || !p.g || p._saLook) return false;
  p._saLook = true;
  var seq = pedSeq++;
  var g = p.g, head = null, hat = null;
  g.traverse(function (o) {
    if (!o.isMesh || !o.geometry) return;
    var gt = o.geometry.type;
    if (gt === 'SphereGeometry' && o.position.y > 1.6 && !head) head = o;
    else if (gt === 'CylinderGeometry' && o.position.y > 1.82) hat = o;
  });
  /* head: face sheet + softer skin response */
  step('face', function () {
    if (!head || !head.material || head.material.map) return;
    head.material.map = faceTexs[seq % faceTexs.length];
    head.material.roughness = .74;
    head.material.metalness = 0;
    head.material.needsUpdate = true;
  });
  /* clothes: shirt (torso + arms share one material) & pants */
  step('cloth', function () {
    var shirtDone = false, pantsDone = false;
    g.traverse(function (o) {
      if (!o.isMesh || !o.geometry || o.geometry.type !== 'BoxGeometry') return;
      var gp = o.geometry.parameters, m = o.material;
      if (!m || !m.isMeshStandardMaterial || m.map) return;
      if (!shirtDone && Math.abs(o.position.y - 1.26) < .25 && gp.width > .4) {
        var set = shirtSets[seq % shirtSets.length];
        m.map = set.d; m.normalMap = set.n; m.normalScale.set(.32, .32); m.roughness = .88;
        m.needsUpdate = true; shirtDone = true;
      } else if (!pantsDone && o.position.y < -.3 && gp.height > .6) {
        m.map = M.denimD; m.normalMap = M.denimN; m.normalScale.set(.3, .3); m.roughness = .94;
        m.needsUpdate = true; pantsDone = true;
      }
    });
  });
  /* shoes on the leg pivots */
  step('shoes', function () {
    var legs = p.legs || [];
    for (var i = 0; i < legs.length; i++) {
      var pv = legs[i];
      if (!pv || pv._saShoe) continue;
      pv._saShoe = true;
      var sh = new THREE.Mesh(M.shoeGeo, M.shoeMats[(seq + i) % M.shoeMats.length]);
      sh.position.set(0, -.78, .035);
      sh.castShadow = true;
      pv.add(sh);
    }
  });
  /* hair when there's no hat */
  step('hair', function () {
    if (hat || g._saHair) return;
    g._saHair = true;
    var hm2 = new THREE.Mesh(M.hairGeo, hairMats[(seq * 3 + 1) % hairMats.length]);
    hm2.position.y = 1.845;
    hm2.rotation.y = rnd(0, 6.28);
    hm2.castShadow = true;
    g.add(hm2);
  });
  gfx2.peds++;
  return true;
}
function retroPlayer() {
  var pm = pModel;
  if (!pm || !pm.g) return false;
  var g = pm.g, head = null;
  g.traverse(function (o) {
    if (o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry' && o.position.y > 1.7 && !head) head = o;
  });
  step('face', function () {
    if (head && head.material && !head.material.map) {
      head.material.map = faceTexs[3];
      head.material.roughness = .72;
      head.material.needsUpdate = true;
    }
  });
  step('cloth', function () {
    var jacketDone = false, pantsDone = false;
    g.traverse(function (o) {
      if (!o.isMesh || !o.geometry || o.geometry.type !== 'BoxGeometry') return;
      var gp = o.geometry.parameters, m = o.material;
      if (!m || !m.isMeshStandardMaterial || m.map) return;
      if (!jacketDone && gp.width > .5 && o.position.y > 1) {
        m.map = M.denimD; m.normalMap = M.denimN; m.normalScale.set(.34, .34); m.roughness = .78;
        m.needsUpdate = true; jacketDone = true;
      } else if (!pantsDone && gp.width > .4 && o.position.y < 1) {
        m.map = M.denimD; m.normalMap = M.denimN; m.normalScale.set(.3, .3); m.roughness = .94;
        m.needsUpdate = true; pantsDone = true;
      }
    });
  });
  step('shoes', function () {
    var legs = pm.legs || [];
    for (var i = 0; i < legs.length; i++) {
      var pv = legs[i];
      if (!pv || pv._saShoe) continue;
      pv._saShoe = true;
      var sh = new THREE.Mesh(M.shoeGeo, M.shoeMats[i % 2]);
      sh.position.set(0, -.75, .04);
      sh.castShadow = true;
      pv.add(sh);
    }
  });
  return true;
}

/* ---------------------------------------------------------- */
/*  scanner + kick-off                                        */
/* ---------------------------------------------------------- */
function scanLook() {
  step('cars', function () {
    for (var i = 0; i < cars.length; i++) if (!cars[i]._saLook) retroCar(cars[i], i);
  });
  step('peds', function () {
    for (var i = 0; i < peds.length; i++) if (!peds[i]._saLook) retroPed(peds[i]);
    var gp = SA.gangPeds || [];
    for (var j = 0; j < gp.length; j++) if (!gp[j]._saLook) retroPed(gp[j]);
  });
  step('player', function () { if (!gfx2.player) gfx2.player = retroPlayer() || false; });
}

(function kick() {
  function go() {
    var keys = ['dnm_d', 'dnm_n', 'jrs_d', 'jrs_n', 'lin_d', 'lin_n', 'ltr_d', 'ltr_n', 'rub_d', 'rub_n'];
    var missing = keys.some(function (k) { return !T[k]; });
    if (missing) { gfx2.ready = true; console.log('[SA look] payload missing - skipped'); return; }
    Promise.all(keys.map(function (k) { return loadImg(T[k]); })).then(function (imgs) {
      var IMG = {};
      for (var i = 0; i < keys.length; i++) IMG[keys[i]] = imgs[i];
      step('shared', function () { buildShared(IMG); });
      scanLook();
      if (SA.slowUpd) SA.slowUpd.push(scanLook);
      gfx2.ready = true;
      console.log('[SA look] people + rides realism ready (cars ' + gfx2.cars + ', peds ' + gfx2.peds + ')');
    }).catch(function (e) { console.warn('[SA look] load:', (e && e.message) || e); gfx2.ready = true; });
  }
  if (SA.hooks && SA.hooks.afterBuild) SA.hooks.afterBuild.push(go);
  else setTimeout(go, 400);
})();

})();
