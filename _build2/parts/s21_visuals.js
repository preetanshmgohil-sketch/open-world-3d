/* ============================================================
   PART 21: REALISM PACK (18+ gritty look)
   - filmic render pipeline (ACES + sRGB output + grade)
   - Polyhaven CC0 photo textures on roads / pavement / grass /
     terrain / dirt roads + Kenney CC0 props (planks, plaza tiles)
   - refined sky, soft clouds, better water
   - realistic building facades + country house walls
   - material palette regrade (desaturate cartoon colours)
   - procedural sky environment (PMREM) that follows day/night
   - film grain + vignette overlays
   Append-only: touches visuals only, never gameplay logic.
   ============================================================ */
(function(){
"use strict";
const SA = window.SA;
if (!SA || !window.THREE) return;
const TX = window.SA_TEX || {};

/* ---------------------------------------------------------- */
/*  config + state                                            */
/* ---------------------------------------------------------- */
const G = SA.gfx = {
  aces: true,            /* ACES filmic tone mapping   */
  exposure: 1.05,        /* renderer exposure          */
  enc: 'srgb',           /* output colour space        */
  grade: 'saturate(.93) contrast(1.06)',  /* canvas CSS grade */
  env: .45,              /* global env-map intensity   */
  grain: .05,            /* film grain opacity         */
  vignette: 1,           /* vignette overlay strength  */
  hemiK: .9, ambK: .6,   /* light domain trims         */
  ready: false
};

const ANISO = Math.min(16, (renderer.capabilities && renderer.capabilities.getMaxAnisotropy) ? renderer.capabilities.getMaxAnisotropy() : 8);
const srgbTex = [], linTex = [];
const step = (n, f) => { try { f(); } catch (e) { console.warn('[SA gfx] ' + n + ':', (e && e.message) || e); } };

/* ---------------------------------------------------------- */
/*  helpers                                                   */
/* ---------------------------------------------------------- */
function loadImg(src){
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('image load failed'));
    i.src = src;
  });
}
function mkTex(img, opt){
  const t = new THREE.Texture(img || undefined);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = (opt && opt.aniso) || ANISO;
  if (opt && opt.rep) t.repeat.set(opt.rep[0], opt.rep[1]);
  if (opt && opt.srgb) { t.encoding = THREE.sRGBEncoding; srgbTex.push(t); }
  else linTex.push(t);
  t.needsUpdate = true;
  return t;
}
/* draw an image/canvas tiled across a canvas 2d context */
function tiled(g, im, tw, th, vary, flip, filter){
  const W = g.canvas.width, H = g.canvas.height;
  tw = Math.max(1, Math.round(tw)); th = Math.max(1, Math.round(th));
  for (let y = 0; y < H; y += th) for (let x = 0; x < W; x += tw) {
    g.save();
    if (filter) g.filter = filter;
    if (flip && Math.random() < flip) { g.translate(x + tw, y); g.scale(-1, 1); }
    else g.translate(x, y);
    g.drawImage(im, 0, 0, tw, th);
    g.restore();
    if (vary) {
      const a = Math.random() * vary;
      g.fillStyle = (Math.random() < .5 ? 'rgba(0,0,0,' : 'rgba(255,255,255,') + a.toFixed(3) + ')';
      g.fillRect(x, y, tw, th);
    }
  }
}
function speck(g, n, dark){
  const W = g.canvas.width, H = g.canvas.height;
  for (let i = 0; i < n; i++) {
    const a = dark ? rnd(.02, .07) : rnd(.02, .06);
    g.fillStyle = (dark ? 'rgba(0,0,0,' : 'rgba(255,255,255,') + a.toFixed(3) + ')';
    g.fillRect(Math.random() * W, Math.random() * H, rnd(1, 3), rnd(1, 3));
  }
}
function blotches(g, n, a0, a1, rx, ry, light){
  const W = g.canvas.width, H = g.canvas.height;
  for (let i = 0; i < n; i++) {
    g.fillStyle = 'rgba(' + (light ? '255,255,255,' : '0,0,0,') + rnd(a0, a1).toFixed(3) + ')';
    g.beginPath();
    g.ellipse(Math.random() * W, Math.random() * H, rnd(rx[0], rx[1]), rnd(ry[0], ry[1]), 0, 0, 7);
    g.fill();
  }
}
/* redraw an existing CanvasTexture in place (keeps all references).
   Canvas art is authored in sRGB, so tag it accordingly. */
function redraw(t, w, h, fn){
  const c = t.image;
  if (!c || !c.getContext) return false;
  c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  t.anisotropy = ANISO;
  t.encoding = THREE.sRGBEncoding;
  t.needsUpdate = true;
  const i = linTex.indexOf(t); if (i >= 0) linTex.splice(i, 1);
  if (srgbTex.indexOf(t) < 0) srgbTex.push(t);
  return true;
}
/* luminance-normalised neutral detail canvas (for vertex-coloured ground) */
function neutralDetail(img, contrast, target){
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, s, s);
  const im = g.getImageData(0, 0, s, s), d = im.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
  const mean = Math.max(1, sum / (d.length / 4));
  for (let i = 0; i < d.length; i += 4) {
    const L = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
    const v = clamp(target * (1 + (L / mean - 1) * contrast), 0, 1) * 255 | 0;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}

/* ---------------------------------------------------------- */
/*  1. renderer pipeline                                      */
/* ---------------------------------------------------------- */
function applyPipeline(){
  renderer.toneMapping = G.aces ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = G.exposure;
  const enc = G.enc === 'srgb' ? THREE.sRGBEncoding : THREE.LinearEncoding;
  if (renderer.outputEncoding !== enc) {
    renderer.outputEncoding = enc;
    for (const t of srgbTex) t.encoding = enc;
    for (const t of linTex) t.encoding = THREE.LinearEncoding;
    scene.traverse(o => {
      const m = o.material;
      if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach(mm => { mm.needsUpdate = true; });
    });
  }
  renderer.domElement.style.filter = G.grade || 'none';
}

/* ---------------------------------------------------------- */
/*  2. sky / clouds / water                                   */
/* ---------------------------------------------------------- */
function redrawSky(){
  redraw(skyTex, 32, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#fbfcfe');
    gr.addColorStop(.42, '#eef3f8');
    gr.addColorStop(.60, '#e2e9f0');
    gr.addColorStop(.72, '#d0d9e1');
    gr.addColorStop(.80, '#b3bbc2');
    gr.addColorStop(.845, '#838b92');
    gr.addColorStop(.88, '#5c636a');
    gr.addColorStop(1, '#343a40');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function cloudTexture(){
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const im = g.createImageData(s, s), d = im.data;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const i = (y * s + x) * 4;
    const n = fbm(x * .026 + 7.3, y * .026 + 2.1, 4);
    const dx = (x - s / 2) / (s / 2), dy = (y - s / 2) / (s / 2);
    const a = smooth((n - .42) * 2.7) * smooth(1.30 - Math.hypot(dx, dy * 1.3));
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = clamp(a, 0, 1) * 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/* wrap-safe value noise so the water normal stays seamless when tiled */
function wtHash(x, y){
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >> 13)) * 1274126177 | 0;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}
function wtNoise(x, y, P){
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const w = v => ((v % P) + P) % P;
  const x0 = w(xi), y0 = w(yi), x1 = w(xi + 1), y1 = w(yi + 1);
  const sx = smooth(xf), sy = smooth(yf);
  return lerp(lerp(wtHash(x0, y0), wtHash(x1, y0), sx),
              lerp(wtHash(x0, y1), wtHash(x1, y1), sx), sy);
}
function wtFbm(x, y, oct, P){
  let v = 0, amp = .5, f = 1, nrm = 0;
  for (let o = 0; o < oct; o++) { v += wtNoise(x * f, y * f, P * f) * amp; nrm += amp; amp *= .5; f *= 2; }
  return v / nrm;
}
function waterNormalCanvas(seed){
  const s = 512, F = 7;                      /* lattice period keeps the tile seamless */
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d'), H = new Float32Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const u = x / s * F + seed, v = y / s * F + seed * .7;
    H[y * s + x] = wtFbm(u, v, 4, F) * .78 + wtFbm(u * 3.1, v * 3.1, 3, F * 3.1) * .22;
  }
  const im = g.createImageData(s, s), d = im.data;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const i = y * s + x;
    const dx = (H[y * s + ((x + 1) % s)] - H[y * s + ((x + s - 1) % s)]) * 1.4;
    const dy = (H[((y + 1) % s) * s + x] - H[((y + s - 1) % s) * s + x]) * 1.4;
    let nx = -dx, ny = -dy, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    d[i * 4] = (nx / l * .5 + .5) * 255;
    d[i * 4 + 1] = (ny / l * .5 + .5) * 255;
    d[i * 4 + 2] = (nz / l * .5 + .5) * 255;
    d[i * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return c;
}
function redrawWater(){
  const src = waterNormalCanvas(3.7);
  redraw(waterNrm, 512, 512, (g) => { g.drawImage(src, 0, 0); });
  waterNrm.repeat.set(720, 720);              /* finer ripples, visible near the shore */
  waterMat.color.set(0x0f3350);
  waterMat.roughness = .3;
  waterMat.metalness = .5;
  waterMat.normalScale.set(1, 1);
  waterMat.needsUpdate = true;
}
function redrawClouds(){
  const ct = cloudTexture();
  cloudMat.map = ct;
  cloudMat.transparent = true;
  cloudMat.depthWrite = false;
  cloudMat.alphaTest = 0;
  cloudMat.needsUpdate = true;
}

/* ---------------------------------------------------------- */
/*  3. ground / road / pavement photo composites              */
/* ---------------------------------------------------------- */
function buildRoadCanvas(){
  const W = 1024, H = 4096;              /* one canvas = 14 m x 55.6 m */
  const mx = W / 14;                     /* px per metre across        */
  redraw(roadTex, W, H, (g) => {
    tiled(g, IMG.asp_d, W / 4, H / 16, .05, .28);
    blotches(g, 26, .03, .09, [120, 360], [200, 640], false);
    blotches(g, 12, .02, .045, [100, 300], [160, 480], true);
    /* repair patches */
    for (let i = 0; i < 12; i++) {
      const x = rnd(30, W - 190), y = rnd(0, H - 320), w = rnd(70, 200), h = rnd(140, 620);
      const t = 16 + Math.random() * 16 | 0;
      g.fillStyle = 'rgba(' + t + ',' + t + ',' + (t + 2) + ',.24)';
      g.fillRect(x, y, w, h);
    }
    /* cracks */
    g.strokeStyle = 'rgba(9,9,11,.5)'; g.lineWidth = 2;
    for (let i = 0; i < 20; i++) {
      let x = Math.random() * W, y = Math.random() * H;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += rnd(-26, 26); y += rnd(30, 130); g.lineTo(x, y); }
      g.stroke();
    }
    /* wheel-polish tracks */
    const lanes = [128, 384, 640, 896];
    g.fillStyle = 'rgba(0,0,0,.08)';
    for (const lc of lanes) for (const o of [-62, 62]) g.fillRect(lc + o - 26, 0, 52, H);
    /* --- markings (real-ish widths, worn) --- */
    const line = (m0, m1, col) => { g.fillStyle = col; g.fillRect(m0 * mx, 0, (m1 - m0) * mx, H); };
    /* centre double yellow */
    line(6.72, 6.86, 'rgba(206,166,44,.85)');
    line(7.14, 7.28, 'rgba(206,166,44,.85)');
    /* edge lines */
    line(.35, .47, 'rgba(216,216,210,.78)');
    line(13.53, 13.65, 'rgba(216,216,210,.78)');
    /* lane dashes: 6 cycles over the 55.55 m tile (seamless) */
    const cyc = H / 6, dash = cyc * .34;
    g.fillStyle = 'rgba(220,220,214,.72)';
    for (const m of [3.5, 10.5]) for (let k = 0; k < 6; k++) g.fillRect((m - .06) * mx, k * cyc + cyc * .12, .12 * mx, dash);
    /* worn paint: dark asphalt specks eating into the markings */
    const paintCols = [.41, 3.5, 6.79, 7.21, 10.5, 13.59];
    for (let i = 0; i < 520; i++) {
      const m = paintCols[i % paintCols.length];
      const x = m * mx + rnd(-16, 16), y = Math.random() * H;
      g.fillStyle = 'rgba(24,24,26,' + rnd(.28, .62).toFixed(2) + ')';
      g.fillRect(x, y, rnd(3, 13), rnd(5, 22));
    }
    for (let i = 0; i < 90; i++) {
      g.fillStyle = 'rgba(28,28,30,' + rnd(.2, .45).toFixed(2) + ')';
      g.fillRect(Math.random() * W, Math.random() * H, rnd(4, 16), rnd(6, 34));
    }
    /* oil + rubber stains in lane centres */
    for (let i = 0; i < 46; i++) {
      g.fillStyle = 'rgba(7,7,9,' + rnd(.05, .15).toFixed(2) + ')';
      g.beginPath();
      g.ellipse(lanes[i % 4] + rnd(-46, 46), Math.random() * H, rnd(9, 26), rnd(18, 70), 0, 0, 7);
      g.fill();
    }
    speck(g, 2400, true);
  });
  roadMat.normalMap = mkTex(IMG.asp_n, { rep: [4, 280], aniso: ANISO });
  roadMat.normalScale.set(.55, .55);
  roadMat.roughnessMap = mkTex(IMG.asp_r, { rep: [4, 280], aniso: 4 });
  roadMat.roughness = 1;
  roadMat.needsUpdate = true;
}
function buildWalkCanvas(){
  /* walkTex: one tile = 3.88 m (base slabs + plaza tint share it) */
  redraw(walkTex, 512, 512, (g) => {
    tiled(g, IMG.pv_d, 256, 256, .05, .25);
    /* expansion joints */
    g.strokeStyle = 'rgba(30,30,32,.30)'; g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 1.5); g.lineTo(512, 1.5); g.moveTo(1.5, 0); g.lineTo(1.5, 512);
    g.moveTo(256, 0); g.lineTo(256, 512); g.moveTo(0, 256); g.lineTo(512, 256);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.10)'; g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, 4); g.lineTo(512, 4); g.moveTo(4, 0); g.lineTo(4, 512);
    g.stroke();
    /* gum stains + cracks */
    for (let i = 0; i < 70; i++) {
      g.fillStyle = 'rgba(20,20,22,' + rnd(.05, .17).toFixed(2) + ')';
      g.beginPath();
      g.ellipse(Math.random() * 512, Math.random() * 512, rnd(2, 6), rnd(2, 6), 0, 0, 7);
      g.fill();
    }
    g.strokeStyle = 'rgba(40,40,44,.4)'; g.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      let x = Math.random() * 512, y = Math.random() * 512;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += rnd(-30, 30); y += rnd(-30, 30); g.lineTo(x, y); }
      g.stroke();
    }
    speck(g, 900, true);
  });
  slabMat.normalMap = mkTex(IMG.pv_n, { rep: [34, 34], aniso: ANISO });
  slabMat.normalScale.set(.5, .5);
  slabMat.needsUpdate = true;
  /* long LV/SF sidewalk strips: their UVs stretch one tile over ~880 m,
     so give them their own material clone with a sane repeat */
  scene.traverse(o => {
    if (o.isInstancedMesh && o.material === slabMat && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 1) {
      const m2 = slabMat.clone();
      m2.normalMap = slabMat.normalMap.clone();
      m2.normalMap.needsUpdate = true;
      m2.normalMap.repeat.set(1, 230);
      m2.map = slabMat.map.clone();
      m2.map.needsUpdate = true;
      m2.map.repeat.set(1, 230);
      o.material = m2;
    }
  });
}
function buildIntersectionCanvas(){
  redraw(asphaltTex, 512, 512, (g) => {
    tiled(g, IMG.asp_d, 512, 512, .05, .25);       /* photo at road-scale grain */
    g.fillStyle = 'rgba(12,12,14,.26)'; g.fillRect(0, 0, 512, 512);
    blotches(g, 5, .02, .05, [40, 120], [40, 120], false);
    blotches(g, 4, .02, .04, [40, 100], [40, 100], true);
    speck(g, 1400, true);
  });
  asphalt.normalMap = mkTex(IMG.asp_n, { rep: [5, 5], aniso: ANISO });
  asphalt.normalScale.set(.5, .5);
  asphalt.needsUpdate = true;
}
function buildParkCanvas(){
  redraw(grassTex, 512, 512, (g) => {
    tiled(g, IMG.gr_d, 128, 128, .06, .3, 'brightness(1.26) saturate(.92)');
    blotches(g, 16, .04, .1, [50, 150], [50, 150], false);
    blotches(g, 8, .03, .06, [40, 120], [40, 120], true);
    speck(g, 1600, true);
  });
  parkMat.color.set(0xc9d8b0);
  parkMat.normalMap = mkTex(IMG.gr_n, { rep: [36, 36], aniso: ANISO });
  parkMat.normalScale.set(.6, .6);
  parkMat.needsUpdate = true;
}
function buildDirtRoads(){
  let done = 0;
  scene.traverse(o => {
    if (!o.isMesh || !o.userData || !o.userData.road || !o.userData.road.kind) return;
    if (o.userData.road.kind !== 'dirt' || !o.material || !o.material.map) return;
    if (o.material.userData && o.material.userData.saDirt) return;
    o.material.userData.saDirt = true;
    redraw(o.material.map, 512, 2048, (g) => {
      tiled(g, IMG.dg_d, 512, 512, .06, .25, 'brightness(1.08)');
      blotches(g, 10, .04, .1, [60, 180], [90, 300], false);
      speck(g, 1600, true);
    });
    o.material.normalMap = mkTex(IMG.dg_n, { rep: [6, 24], aniso: ANISO });
    o.material.normalScale.set(.5, .5);
    o.material.needsUpdate = true;
    done++;
  });
  if (done) console.log('[SA gfx] dirt road materials upgraded:', done);
}
function buildTerrainDetail(){
  const det = neutralDetail(IMG.dg_d, .33, .97);
  const tMat = terrain.material;
  tMat.map = mkTex(det, { rep: [2300, 2300], srgb: true, aniso: ANISO });
  tMat.normalMap = mkTex(IMG.dg_n, { rep: [2300, 2300], aniso: ANISO });
  tMat.normalScale.set(.30, .30);
  tMat.needsUpdate = true;
}
function buildPlazaAndWood(){
  plazaMat.map = mkTex(IMG.k_tiles, { rep: [30, 30], srgb: true, aniso: ANISO });
  plazaMat.needsUpdate = true;
  const wood = mkTex(IMG.k_planks, { rep: [2, 2], srgb: true, aniso: ANISO });
  woodMat.map = wood;
  woodMat.color.set(0xb99a72);
  woodMat.needsUpdate = true;
  if (SA.MAT && SA.MAT.wood) {
    SA.MAT.wood.map = wood;
    SA.MAT.wood.color.set(0xa98a63);
    SA.MAT.wood.needsUpdate = true;
  }
}

/* ---------------------------------------------------------- */
/*  4. facades                                                */
/* ---------------------------------------------------------- */
function facadePair(k, cols, rs){
  const W = WINS[k]; if (!W || !W.m || !W.m.image) return;
  const S = 512, rows = 4;
  const cw = S / cols, ch = S / rows;
  const spec = [];            /* window rects for the emissive pass */
  redraw(W.m, S, S, (g) => {
    /* wall base */
    g.fillStyle = '#d9d9d7'; g.fillRect(0, 0, S, S);
    const grd = g.createLinearGradient(0, 0, 0, S);
    grd.addColorStop(0, 'rgba(255,255,255,.10)');
    grd.addColorStop(.55, 'rgba(255,255,255,0)');
    grd.addColorStop(1, 'rgba(0,0,0,.20)');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    /* floor bands */
    for (let r = 1; r < rows; r++) {
      g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(0, r * ch - 2, S, 3);
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, r * ch - 4, S, 2);
    }
    if (rs === 'pilaster') for (let c = 0; c <= cols; c++) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(c * cw - 4, 0, 8, S); }
    if (rs === 'bands') for (let r = 0; r < rows; r++) { g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, r * ch + ch * .78, S, ch * .1); }
    speck(g, 1500, true);
    /* windows */
    const tall = (k % 2) === 1;
    const ww = cw * (tall ? .40 : .56), wh = ch * (tall ? .62 : .50);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * cw + (cw - ww) / 2, y = r * ch + ch * .16;
      spec.push([x, y, ww, wh]);
      /* frame */
      g.fillStyle = '#e9e9e6'; g.fillRect(x - 4, y - 4, ww + 8, wh + 8);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x - 4, y + wh + 4, ww + 8, 3);
      const rnd2 = Math.random();
      if (rnd2 < .09) {          /* boarded up */
        g.fillStyle = '#7f6a4e'; g.fillRect(x, y, ww, wh);
        g.fillStyle = 'rgba(0,0,0,.25)';
        for (let b = 0; b < 4; b++) g.fillRect(x, y + b * wh / 4 + 4, ww, 3);
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, y, ww, 4);
      } else if (rnd2 < .19) {   /* blinds */
        g.fillStyle = '#a8a296'; g.fillRect(x, y, ww, wh);
        g.fillStyle = 'rgba(0,0,0,.14)';
        for (let b = 2; b < wh; b += 5) g.fillRect(x, y + b, ww, 2);
      } else {                   /* glass with sky reflection */
        const gl = g.createLinearGradient(0, y, 0, y + wh);
        gl.addColorStop(0, '#93a9ba'); gl.addColorStop(.45, '#5c7286'); gl.addColorStop(1, '#222d3a');
        g.fillStyle = gl; g.fillRect(x, y, ww, wh);
        g.fillStyle = 'rgba(255,255,255,.20)';
        g.beginPath();
        g.moveTo(x, y + wh * .60); g.lineTo(x + ww * .55, y); g.lineTo(x + ww * .78, y); g.lineTo(x, y + wh * .92);
        g.closePath(); g.fill();
        /* mullions */
        g.fillStyle = 'rgba(228,228,224,.85)';
        g.fillRect(x + ww / 2 - 1.5, y, 3, wh);
        g.fillRect(x, y + wh * .5 - 1.5, ww, 3);
      }
      /* sill + grime */
      g.fillStyle = '#c9c9c5'; g.fillRect(x - 6, y + wh + 4, ww + 12, 5);
      g.fillStyle = 'rgba(0,0,0,.20)'; g.fillRect(x - 6, y + wh + 9, ww + 12, 9);
      const gs = g.createLinearGradient(0, y + wh + 12, 0, y + wh + 12 + ch * .34);
      gs.addColorStop(0, 'rgba(40,40,42,.16)'); gs.addColorStop(1, 'rgba(40,40,42,0)');
      g.fillStyle = gs; g.fillRect(x - 2, y + wh + 12, ww + 4, ch * .34);
    }
  });
  redraw(W.e, S, S, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    for (const [x, y, ww, wh] of spec) {
      const p = Math.random();
      if (p < .48) continue;                     /* dark window */
      const warm = Math.random() < .3;
      const a = rnd(.35, .95);
      g.fillStyle = warm ? 'rgba(255,186,120,' + a.toFixed(2) + ')' : 'rgba(255,214,160,' + a.toFixed(2) + ')';
      g.fillRect(x, y, ww, wh);
      g.fillStyle = 'rgba(255,255,255,' + (a * .5).toFixed(2) + ')';
      g.fillRect(x + ww * .5 - 2, y, 4, wh);
    }
  });
}
function rebuildFacades(){
  facadePair(0, 8, '');
  facadePair(1, 10, 'pilaster');
  facadePair(2, 7, 'bands');
  facadePair(3, 9, '');
  /* country house walls (s04 towns) — clapboard + windows + door */
  if (SA.MAT && SA.MAT.wallA && SA.MAT.wallA.map) {
    redraw(SA.MAT.wallA.map, 512, 512, (g) => {
      g.fillStyle = '#f4f4f1'; g.fillRect(0, 0, 512, 512);
      /* clapboard siding */
      for (let y = 0; y < 512; y += 14) {
        g.fillStyle = 'rgba(0,0,0,.075)'; g.fillRect(0, y, 512, 2);
        g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, y + 2, 512, 1);
      }
      /* eave shadow + foundation */
      const ev = g.createLinearGradient(0, 0, 0, 60);
      ev.addColorStop(0, 'rgba(0,0,0,.30)'); ev.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = ev; g.fillRect(0, 0, 512, 60);
      g.fillStyle = '#b4aea4'; g.fillRect(0, 470, 512, 42);
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, 470, 512, 4);
      speck(g, 900, true);
      g.strokeStyle = 'rgba(60,50,40,.35)'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        let x = Math.random() * 512, y = Math.random() * 380;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 3; k++) { x += rnd(-22, 22); y += rnd(-18, 26); g.lineTo(x, y); }
        g.stroke();
      }
      /* windows: 2 rows x 3 cols */
      const win = (x, y, w, h) => {
        g.fillStyle = '#fdfdfb'; g.fillRect(x - 5, y - 5, w + 10, h + 10);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 5, y + h + 5, w + 10, 4);
        const gl = g.createLinearGradient(0, y, 0, y + h);
        gl.addColorStop(0, '#8ea6b8'); gl.addColorStop(.5, '#55708a'); gl.addColorStop(1, '#1d2836');
        g.fillStyle = gl; g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(255,255,255,.2)';
        g.beginPath(); g.moveTo(x, y + h * .55); g.lineTo(x + w * .5, y); g.lineTo(x + w * .75, y); g.lineTo(x, y + h * .85);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(250,250,248,.9)';
        g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h / 2 - 2, w, 4);
        g.fillStyle = '#cfcfc9'; g.fillRect(x - 7, y + h + 4, w + 14, 6);
        const gs = g.createLinearGradient(0, y + h + 10, 0, y + h + 34);
        gs.addColorStop(0, 'rgba(40,40,42,.15)'); gs.addColorStop(1, 'rgba(40,40,42,0)');
        g.fillStyle = gs; g.fillRect(x - 3, y + h + 10, w + 6, 24);
      };
      for (const wy of [72, 232]) for (const wx of [64, 212, 360]) win(wx, wy, 88, 96);
      /* door */
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(203, 350, 106, 164);
      g.fillStyle = '#5a4030'; g.fillRect(208, 352, 96, 158);
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(208, 352, 96, 6);
      g.fillStyle = 'rgba(0,0,0,.30)';
      g.fillRect(220, 372, 72, 54); g.fillRect(220, 442, 72, 54);
      g.fillStyle = '#d8c07a'; g.beginPath(); g.arc(292, 434, 5, 0, 7); g.fill();
      g.fillStyle = '#a9a49b'; g.fillRect(196, 508, 120, 8);
    });
  }
}

/* ---------------------------------------------------------- */
/*  5. palette regrade (kill cartoon saturation)              */
/* ---------------------------------------------------------- */
function regradePalette(){
  const hsl = { h: 0, s: 0, l: 0 };
  const seen = [];
  scene.traverse(o => {
    const m = o.material; if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach(mm => {
      if (!(mm.isMeshStandardMaterial || mm.isMeshLambertMaterial)) return;
      if (seen.indexOf(mm) >= 0) return;
      seen.push(mm);
      const c = mm.color;
      if (!c || c.isColor !== true) return;
      c.getHSL(hsl);
      if (hsl.s > .5) { c.setHSL(hsl.h, Math.max(0, hsl.s * .78), hsl.l); }
      else if (hsl.s > .34) { c.setHSL(hsl.h, hsl.s * .88, hsl.l); }
      /* greens (trees/hedges/palms) get grimier */
      if (hsl.h > .18 && hsl.h < .48 && hsl.s > .22) {
        c.setHSL(hsl.h + .018, Math.min(hsl.s * .6, .32), hsl.l * .86);
      }
      mm.needsUpdate = true;
    });
  });
  /* terrain vertex colours: desaturate + slightly deepen */
  step('terrain colours', () => {
    const geo = terrain.geometry;
    const col = geo.attributes && geo.attributes.color;
    if (!col) return;
    for (let i = 0; i < col.count; i++) {
      let r = col.getX(i), g2 = col.getY(i), b = col.getZ(i);
      const l = r * .299 + g2 * .587 + b * .114;
      r = lerp(r, l, .42) * .93 * 1.02;
      g2 = lerp(g2, l, .42) * .93;
      b = lerp(b, l, .40) * .93 * .99;
      col.setXYZ(i, clamp(r, 0, 1), clamp(g2, 0, 1), clamp(b, 0, 1));
    }
    if (G.enc === 'srgb') {           /* to linear for the filmic pipeline */
      const lin = v => v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
      for (let i = 0; i < col.count; i++) col.setXYZ(i, lin(col.getX(i)), lin(col.getY(i)), lin(col.getZ(i)));
    }
    col.needsUpdate = true;
  });
}

/* authored (sRGB) material colours -> linear so the filmic pipeline
   reproduces them faithfully instead of washing everything out       */
function convertColors(toLinear){
  const f = toLinear ? 'convertSRGBToLinear' : 'convertLinearToSRGB';
  const want = toLinear ? 'lin' : 'srgb';
  const seen = [];
  const doMat = m => {
    if (!m || seen.indexOf(m) >= 0) return;
    seen.push(m);
    m.userData = m.userData || {};
    if ((m.userData.saC || 'srgb') === want) return;
    if (m.color && m.color.isColor) m.color[f]();
    if (m.emissive && m.emissive.isColor) m.emissive[f]();
    m.userData.saC = want;
    m.needsUpdate = true;
  };
  scene.traverse(o => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(doMat); });
  for (const c of [dayC, nightC, duskC, rainC]) {
    if (!c || !c.isColor) continue;
    c.userData = c.userData || {};
    if (c.userData.saC === want) continue;
    c[f](); c.userData.saC = want;
  }
}

/* per-instance tint jitter so instanced trees/hedges stop looking cloned */
function jitterFoliage(){
  const targets = [];
  try {
    if (typeof crownMat !== 'undefined') targets.push(crownMat, crownMat2);
    if (SA.MAT) for (const k of ['leafA', 'leafB', 'conif', 'cactus', 'trunk', 'palmTrunk', 'palm', 'conifer']) {
      if (SA.MAT[k] && targets.indexOf(SA.MAT[k]) < 0) targets.push(SA.MAT[k]);
    }
  } catch (e) {}
  const col = new THREE.Color(), hsl = { h: 0, s: 0, l: 0 };
  let n = 0;
  scene.traverse(o => {
    if (!o.isInstancedMesh || !o.setColorAt) return;
    const m = o.material;
    if (!m || !m.isMeshStandardMaterial || !m.color || !m.color.isColor) return;
    let ok = targets.indexOf(m) >= 0;
    if (!ok) {
      m.color.getHSL(hsl);
      ok = hsl.h > .18 && hsl.h < .48 && hsl.s > .18 && hsl.l < .6;   /* any green prop */
    }
    if (!ok) return;
    for (let i = 0; i < o.count; i++) {
      col.setRGB(rnd(.76, 1.08), rnd(.82, 1.06), rnd(.76, 1.0));
      o.setColorAt(i, col);
    }
    if (o.instanceColor) o.instanceColor.needsUpdate = true;
    m.needsUpdate = true;
    n++;
  });
  if (n) console.log('[SA gfx] foliage tint jitter on', n, 'instanced meshes');
}

/* ---------------------------------------------------------- */
/*  6. environment (procedural sky IBL, follows day/night)    */
/* ---------------------------------------------------------- */
let pmrem = null, envRT = null, envCanvas = null, envTex = null, lastEnvTod = -9, envInit = false;
function paintEnvCanvas(canvas, todNow){
  const g = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  const ang = todNow * Math.PI * 2, el = Math.sin(ang);
  const dayK = smooth((el + .18) / .4);
  const duskK = Math.max(0, 1 - Math.abs(el) * 4.5);
  const zen = [30, 74, 128].map((c, i) => Math.round(c * (.25 + .75 * dayK)));          /* zenith */
  const hor = [170, 196, 216].map((c, i) => Math.round(c * (.10 + .90 * dayK)));
  const grd = g.createLinearGradient(0, 0, 0, h * .5);
  grd.addColorStop(0, 'rgb(' + zen.join(',') + ')');
  grd.addColorStop(1, 'rgb(' + hor.join(',') + ')');
  g.fillStyle = grd; g.fillRect(0, 0, w, h * .5);
  g.fillStyle = 'rgb(' + hor.map(c => Math.round(c * .35)).join(',') + ')';
  g.fillRect(0, h * .5, w, h * .5);
  /* dusk glow + sun */
  if (duskK > .02 || el > 0) {
    const du = ((todNow * 2 + .75) % 1);
    const gx = du * w;
    const glow = g.createRadialGradient(gx, h * .5, 1, gx, h * .5, w * .22);
    const warm = Math.round(255 * clamp(duskK * 1.1 + el * .6, 0, 1));
    glow.addColorStop(0, 'rgba(' + warm + ',' + Math.round(warm * .72) + ',' + Math.round(warm * .42) + ',' + (.85 * clamp(el * 2 + duskK, 0, 1)).toFixed(2) + ')');
    glow.addColorStop(1, 'rgba(' + warm + ',' + Math.round(warm * .6) + ',120,0)');
    g.fillStyle = glow;
    g.beginPath(); g.ellipse(gx, h * .5, w * .22, h * .22, 0, 0, 7); g.fill();
  }
}
function rebuildEnv(){
  if (!(G.env > 0) || !renderer) return;
  try {
    if (!pmrem) pmrem = new THREE.PMREMGenerator(renderer);
    if (!envCanvas) { envCanvas = document.createElement('canvas'); envCanvas.width = 128; envCanvas.height = 64; }
    paintEnvCanvas(envCanvas, tod);
    if (!envTex) {
      envTex = new THREE.CanvasTexture(envCanvas);
      envTex.mapping = THREE.EquirectangularReflectionMapping;
      envTex.encoding = THREE.sRGBEncoding;
    }
    envTex.needsUpdate = true;
    const rt = pmrem.fromEquirectangular(envTex);
    if (envRT) envRT.dispose();
    envRT = rt;
    scene.environment = rt.texture;
    if (!envInit) {          /* first IBL build: materials recompile once */
      envInit = true;
      scene.traverse(o => {
        const m = o.material; if (!m) return;
        (Array.isArray(m) ? m : [m]).forEach(mm => { if (mm.isMeshStandardMaterial) mm.needsUpdate = true; });
      });
    }
    reapplyEnvIntensity();
    lastEnvTod = tod;
  } catch (e) { console.warn('[SA gfx] env:', (e && e.message) || e); }
}
function reapplyEnvIntensity(){
  const def = G.env;
  scene.traverse(o => {
    const m = o.material; if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach(mm => {
      if (!mm.isMeshStandardMaterial) return;
      let k = def;
      if (mm === waterMat) k = Math.min(1.2, def * 2.6);
      else if (mm === glass || mm === darkMat) k = def * 2;
      else if (SA.MAT && (mm === SA.MAT.silo || mm === SA.MAT.glassB || mm === SA.MAT.dish)) k = def * 2;
      else if (mm.userData && mm.userData.saEnv !== undefined) k = mm.userData.saEnv;
      mm.envMapIntensity = k;
    });
  });
}
function scanDynamic(){
  /* cars: glossy paint + glass pick up sky reflections */
  step('car env', () => {
    for (const c of cars) {
      if (c._saEnv) continue;
      c._saEnv = true;
      c.g.traverse(o => {
        const m = o.material;
        if (m && m.isMeshStandardMaterial) {
          const k = (m.metalness > .3) ? Math.min(1.5, G.env * 3) : G.env * 2;
          m.userData = m.userData || {};
          m.userData.saEnv = k;
          m.envMapIntensity = k;
        }
      });
    }
  });
  step('ped env', () => {
    for (const p of peds) {
      if (p._saEnv) continue;
      p._saEnv = true;
      p.g.traverse(o => {
        const m = o.material;
        if (m && m.isMeshStandardMaterial) {
          const k = Math.min(.4, G.env * .8);
          m.userData = m.userData || {};
          m.userData.saEnv = k;
          m.envMapIntensity = k;
        }
      });
    }
  });
}

/* ---------------------------------------------------------- */
/*  7. film layer (vignette + grain)                          */
/* ---------------------------------------------------------- */
let grainCtx = null, grainImg = null, grainTickN = 0;
function ensureOverlays(){
  if (!document.getElementById('sa-vig')) {
    const v = document.createElement('div');
    v.id = 'sa-vig';
    v.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;' +
      'background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 40%,rgba(5,6,8,.30) 80%,rgba(4,5,7,.58) 100%);' +
      'opacity:' + G.vignette;
    document.body.appendChild(v);
  }
  if (!document.getElementById('sa-grain')) {
    const c = document.createElement('canvas');
    c.id = 'sa-grain';
    c.width = 192; c.height = 108;
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;' +
      'opacity:' + G.grain + ';mix-blend-mode:overlay;image-rendering:pixelated';
    document.body.appendChild(c);
    grainCtx = c.getContext('2d');
    grainImg = grainCtx.createImageData(192, 108);
  }
}
function grainTick(){
  if (!grainCtx) return;
  if ((grainTickN++ & 1) !== 0) return;
  const d = grainImg.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 128 + (Math.random() * 60 - 30) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 26;
  }
  grainCtx.putImageData(grainImg, 0, 0);
}

/* ---------------------------------------------------------- */
/*  boot                                                      */
/* ---------------------------------------------------------- */
const IMG = {};
let built = false, loaded = false, applied = false;

function loadAll(){
  const keys = Object.keys(TX);
  if (!keys.length) { loaded = true; return Promise.resolve(); }
  return Promise.all(keys.map(k => loadImg(TX[k]).then(im => { IMG[k] = im; }).catch(() => {})))
    .then(() => { loaded = true; });
}
function applyAll(){
  if (applied) return;
  applied = true;
  const have = !!IMG.asp_d && !!IMG.dg_d;
  G.tex = have;
  if (have) {
    step('road', buildRoadCanvas);
    step('walk', buildWalkCanvas);
    step('intersection', buildIntersectionCanvas);
    step('park', buildParkCanvas);
    step('dirt', buildDirtRoads);
    step('terrain detail', buildTerrainDetail);
    step('plaza+wood', buildPlazaAndWood);
  }
  step('sky', redrawSky);
  step('clouds', redrawClouds);
  step('water', redrawWater);
  step('facades', rebuildFacades);
  step('palette', regradePalette);
  step('foliage jitter', jitterFoliage);
  if (G.enc === 'srgb') step('colour space', () => convertColors(true));
  applyPipeline();
  step('lights', () => { amb.intensity *= G.ambK; });
  step('env', rebuildEnv);
  step('overlays', ensureOverlays);
  G.ready = true;
  console.log('[SA] realism pack ready (tex:' + (have ? 'photo+kenney' : 'procedural') + ', aniso:' + ANISO + ')');
}
function tryApply(){ if (built && loaded) applyAll(); }

/* image decode starts immediately; scene work waits for the build */
loadAll().then(tryApply).catch(tryApply);
SA.hooks.afterBuild = SA.hooks.afterBuild || [];
SA.hooks.afterBuild.push(() => { built = true; tryApply(); });
SA.updates.push(grainTick);
SA.slowUpd.push(scanDynamic);

/* keep the light domain trims + env rebuild inside the day/night tick */
const _daylight = window.daylight;
if (typeof _daylight === 'function') {
  window.daylight = function(){
    _daylight.apply(null, arguments);
    try {
      hemi.intensity *= G.hemiK;
      if (G.env > 0 && Math.abs(tod - lastEnvTod) > .018) rebuildEnv();
    } catch (e) { /* never break the loop */ }
  };
}

/* live tuning API */
G.set = function(o){
  const encBefore = G.enc;
  Object.assign(G, o || {});
  if (o && o.vignette !== undefined) { const v = document.getElementById('sa-vig'); if (v) v.style.opacity = G.vignette; }
  if (o && o.grain !== undefined) { const c = document.getElementById('sa-grain'); if (c) c.style.opacity = G.grain; }
  if (G.enc !== encBefore && G.ready) convertColors(G.enc === 'srgb');
  applyPipeline();
  if (G.env > 0) rebuildEnv();
  else { scene.environment = null; }
  console.log('[SA gfx] set', JSON.stringify(G));
};
console.log('[SA] realism pack loaded');
})();
