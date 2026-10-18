/* Convert Quaternius car OBJ+MTL (CC0) to GLB with semantic materials,
   recentred wheel nodes, unit length, ground-origin, +Z forward.
   Output: qdrive/cars_glb/<Name>.glb + meta.json */
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, 'qdrive', 'cars', 'OBJ');
const OUT = path.join(__dirname, 'qdrive', 'cars_glb');
fs.mkdirSync(OUT, { recursive: true });

/* ---------- material semantics ---------- */
function semName(model, objName, mtlName, firstPaint) {
  const isWheel = /wheel/i.test(objName);
  if (isWheel) return mtlName === 'Black' ? 'Tire' : 'Rim';
  if (mtlName === 'Windows') return 'Glass';
  if (mtlName === 'Headlights') return 'LampHead';
  if (mtlName === 'TailLights') return 'LampTail';
  if (mtlName === 'WhiteLights') return 'LampWhite';
  if (mtlName === 'BlueLights') return 'LampBlue';
  if (mtlName === 'Material.007') return 'TrimGrey';
  if (mtlName === 'DarkOrange') return 'PaintDark';
  if (firstPaint && mtlName === firstPaint) return 'Paint';
  if (mtlName === 'Black') return 'TrimBlack';
  if (mtlName === 'Grey') return 'TrimGrey';
  return 'Paint';   /* White/Blue/Yellow/LightBlue/Orange leftovers */
}

function srgb2lin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

function parseMTL(txt) {
  const mats = {}; let cur = null;
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith('newmtl ')) { cur = t.slice(7).trim(); mats[cur] = { kd: [0.5, 0.5, 0.5] }; }
    else if (cur && t.startsWith('Kd ')) mats[cur].kd = t.slice(3).trim().split(/\s+/).map(Number);
  }
  return mats;
}

/* ---------- OBJ parse ---------- */
function parseOBJ(txt) {
  const V = [], N = [], objs = [];
  let cur = null, curPrim = null;
  const lines = txt.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('v ')) { const p = line.slice(2).trim().split(/\s+/); V.push(p.map(Number)); }
    else if (line.startsWith('vn ')) { const p = line.slice(3).trim().split(/\s+/); N.push(p.map(Number)); }
    else if (line.startsWith('o ')) { cur = { name: line.slice(2).trim(), prims: [] }; objs.push(cur); curPrim = null; }
    else if (line.startsWith('usemtl ') && cur) { curPrim = { mtl: line.slice(7).trim(), faces: [] }; cur.prims.push(curPrim); }
    else if (line.startsWith('f ') && curPrim) {
      const parts = line.slice(2).trim().split(/\s+/).map(s => {
        const t = s.split('/');
        return { v: parseInt(t[0], 10) - 1, n: t[2] ? parseInt(t[2], 10) - 1 : -1 };
      });
      /* triangulate fan */
      for (let i = 1; i + 1 < parts.length; i++) curPrim.faces.push([parts[0], parts[i], parts[i + 1]]);
    }
  }
  return { V, N, objs };
}

/* ---------- GLB writer ---------- */
function writeGLB(file, gltf, bin) {
  const pad4 = n => (n + 3) & ~3;
  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  if (json.length % 4) json = Buffer.concat([json, Buffer.alloc(4 - json.length % 4, 0x20)]);
  const binPad = pad4(bin.length);
  const binBuf = Buffer.concat([bin, Buffer.alloc(binPad - bin.length, 0)]);
  const total = 12 + 8 + json.length + 8 + binBuf.length;
  const head = Buffer.alloc(12);
  head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(binBuf.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, jh, json, bh, binBuf]));
}

const meta = {};
for (const f of fs.readdirSync(SRC)) {
  if (!f.endsWith('.obj')) continue;
  const name = f.replace(/\.obj$/, '');
  const obj = parseOBJ(fs.readFileSync(path.join(SRC, f), 'utf8'));
  const mtls = parseMTL(fs.readFileSync(path.join(SRC, name + '.mtl'), 'utf8'));

  /* --- global bbox to find axes --- */
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of obj.V) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
  const ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  const lengthAxis = ext.indexOf(Math.max(...ext));
  const heightAxis = ext.indexOf(Math.min(...ext));
  const widthAxis = 3 - lengthAxis - heightAxis;
  /* build axis remap so that: X=width, Y=height, Z=length, +Z = front */
  const map = [widthAxis, heightAxis, lengthAxis];
  const rot = (p) => [p[map[0]], p[map[1]], p[map[2]]];

  /* --- wheel node z to detect facing (front should end up +Z) --- */
  let frontZ = null, backZ = null;
  const wheelCenters = {};
  for (const o of obj.objs) {
    const bm = [1e9, 1e9, 1e9], bx = [-1e9, -1e9, -1e9];
    for (const pr of o.prims) for (const fc of pr.faces) for (const iv of fc) {
      const q = rot(obj.V[iv.v]);
      for (let k = 0; k < 3; k++) { bm[k] = Math.min(bm[k], q[k]); bx[k] = Math.max(bx[k], q[k]); }
    }
    const c = [(bm[0] + bx[0]) / 2, (bm[1] + bx[1]) / 2, (bm[2] + bx[2]) / 2];
    wheelCenters[o.name] = { bm, bx, c, wheel: /wheel/i.test(o.name) };
    if (/Front/i.test(o.name)) frontZ = c[2];
    if (/BackWheels/i.test(o.name)) backZ = c[2];
  }
  const flip = (frontZ !== null && backZ !== null && frontZ < backZ) ? Math.PI : 0; /* rotate 180 about Y if backwards */

  /* --- transform: rotate(flip) then translate so ground=0, centre x/z, then scale length->1 --- */
  const R = (p) => {
    let q = rot(p);
    if (flip) { const x = q[0], z = q[2]; q = [-x, q[1], -z]; }
    return q;
  };
  /* full bbox after R */
  let amn = [1e9, 1e9, 1e9], amx = [-1e9, -1e9, -1e9];
  for (const p of obj.V) { const q = R(p); for (let k = 0; k < 3; k++) { amn[k] = Math.min(amn[k], q[k]); amx[k] = Math.max(amx[k], q[k]); } }
  const scale = 1 / (amx[2] - amn[2]);
  const tx = -(amn[0] + amx[0]) / 2, ty = -amn[1], tz = -(amn[2] + amx[2]) / 2;
  const T = (p) => { const q = R(p); return [(q[0] + tx) * scale, (q[1] + ty) * scale, (q[2] + tz) * scale]; };

  /* --- collect materials (semantic) --- */
  const matIndex = {}, materials = [], bufferParts = [];
  let byteOff = 0;
  const align = () => { const r = byteOff % 4; if (r) { bufferParts.push(Buffer.alloc(4 - r)); byteOff += 4 - r; } };

  function pushAccessor(data, type, comps, target) {
    align();
    const buf = Buffer.alloc(data.length * 4);
    for (let i = 0; i < data.length; i++) buf.writeFloatLE(data[i], i * 4);
    bufferParts.push(buf);
    const acc = { bufferView: views.length, componentType: 5126, count: data.length / comps, type };
    views.push({ buffer: 0, byteOffset: byteOff, byteLength: buf.length, target });
    byteOff += buf.length;
    return accs.push(acc) - 1;
  }
  const views = [], accs = [];

  function getMat(sem, kd) {
    if (matIndex[sem] !== undefined) return matIndex[sem];
    const c = kd.map(srgb2lin).map(v => Math.round(v * 1000) / 1000);
    const m = {
      name: sem,
      pbrMetallicRoughness: {
        baseColorFactor: [c[0], c[1], c[2], 1],
        metallicFactor: sem === 'Paint' || sem === 'PaintDark' ? 0.25 : (sem === 'Rim' ? 0.9 : 0.05),
        roughnessFactor: sem === 'Glass' ? 0.03 : (sem === 'Paint' ? 0.3 : (sem === 'Tire' ? 0.95 : 0.5)),
      },
      doubleSided: false,
    };
    if (sem === 'LampHead') { m.emissiveFactor = [0.85, 0.8, 0.6]; }
    if (sem === 'LampTail') { m.emissiveFactor = [0.7, 0.05, 0.05]; }
    if (sem === 'LampBlue') { m.emissiveFactor = [0.05, 0.15, 0.8]; }
    if (sem === 'LampWhite') { m.emissiveFactor = [0.8, 0.8, 0.8]; }
    matIndex[sem] = materials.length;
    materials.push(m);
    return matIndex[sem];
  }

  /* --- build mesh primitives per object/material --- */
  const nodes = [], meshes = [];
  const rootChildren = [];
  for (const o of obj.objs) {
    const isWheel = /wheel/i.test(o.name);
    let pivot = [0, 0, 0];
    if (isWheel) { const wc = wheelCenters[o.name]; const p0 = T(wc.c); pivot = p0; }
    const prims = [];
    for (const pr of o.prims) {
      const sem = semName(name, o.name, pr.mtl, obj.objs[0].prims[0].mtl);
      const pos = [], nor = [], idx = [];
      const vmap = new Map();
      for (const fc of pr.faces) for (const iv of fc) {
        const key = iv.v + ':' + iv.n;
        if (!vmap.has(key)) {
          vmap.set(key, pos.length / 3);
          const p = T(obj.V[iv.v]);
          pos.push(p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]);
          if (iv.n >= 0 && obj.N[iv.n]) {
            let n = obj.N[iv.n];
            n = [n[map[0]], n[map[1]], n[map[2]]];
            if (flip) n = [-n[0], n[1], -n[2]];
            const l = Math.hypot(n[0], n[1], n[2]) || 1;
            nor.push(n[0] / l, n[1] / l, n[2] / l);
          } else nor.push(0, 1, 0);
        }
        idx.push(vmap.get(key));
      }
      const aPos = pushAccessor(pos, 'VEC3', 3, 34962);
      const aNor = pushAccessor(nor, 'VEC3', 3, 34962);
      const aIdx = pushAccessor(idx, 'SCALAR', 1, 34963);
      accs[aIdx].componentType = 5125;
      views[accs[aIdx].bufferView].byteLength = idx.length * 4;
      /* rewrite as uint32 */
      prims.push({ attributes: { POSITION: aPos, NORMAL: aNor }, indices: aIdx, material: getMat(sem, (mtls[pr.mtl] || { kd: [0.5, 0.5, 0.5] }).kd) });
    }
    meshes.push({ name: o.name, primitives: prims });
    nodes.push({ name: o.name, mesh: meshes.length - 1, translation: [pivot[0], pivot[1], pivot[2]] });
    rootChildren.push(nodes.length - 1);
  }
  nodes.push({ name: name + '_root', children: rootChildren });

  const gltf = {
    asset: { version: '2.0', generator: 'sa-conv' },
    scene: 0,
    scenes: [{ nodes: [nodes.length - 1] }],
    nodes, meshes, materials,
    accessors: accs,
    bufferViews: views,
    buffers: [{ byteLength: 0 }],
  };
  const bin = Buffer.concat(bufferParts);
  gltf.buffers[0].byteLength = bin.length + (4 - bin.length % 4) % 4;
  writeGLB(path.join(OUT, name + '.glb'), gltf, bin);
  meta[name] = {
    sizeKB: Math.round(fs.statSync(path.join(OUT, name + '.glb')).size / 1024),
    length: +(amx[2] - amn[2]).toFixed(3), width: +(amx[0] - amn[0]).toFixed(3), height: +(amx[1] - amn[1]).toFixed(3),
    flip, wheels: Object.keys(wheelCenters).filter(k => wheelCenters[k].wheel).map(k => ({
      name: k, pos: T(wheelCenters[k].c).map(v => +v.toFixed(4)).concat([0]).slice(0, 3).map(v => +v.toFixed(4)),
    })),
  };
  console.log(name, '->', meta[name].sizeKB + 'KB', 'L' + meta[name].length, 'W' + meta[name].width, 'H' + meta[name].height, meta[name].flip ? '(flipped)' : '');
}
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
console.log('done ->', OUT);
