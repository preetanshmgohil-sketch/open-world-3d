/* Offline geometry analysis for downloaded GLBs: nose direction, rotor hub, wheel nodes.
   Usage: node glb_meta.js <file.glb> [<file.glb> ...] */
const fs = require('fs');
const path = require('path');

function readGLB(file) {
  const buf = fs.readFileSync(path.join(__dirname, 'downloads', file));
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  let off = 20 + jsonLen;
  // pad to 4
  const binLen = buf.readUInt32LE(off); const binType = buf.readUInt32LE(off + 4);
  const bin = buf.slice(off + 8, off + 8 + binLen);
  return { json, bin };
}
/* matrix helpers (column major, glTF) */
function ident() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k];
    o[c*4+r] = s;
  }
  return o;
}
function fromTRS(t, q, s) {
  t = t || [0,0,0]; q = q || [0,0,0,1]; s = s || [1,1,1];
  const [x,y,z,w] = q, x2=x+x, y2=y+y, z2=z+z;
  const xx=x*x2, xy=x*y2, xz=x*z2, yy=y*y2, yz=y*z2, zz=z*z2, wx=w*x2, wy=w*y2, wz=w*z2;
  return [ (1-(yy+zz))*s[0], (xy+wz)*s[0], (xz-wy)*s[0], 0,
           (xy-wz)*s[1], (1-(xx+zz))*s[1], (yz+wx)*s[1], 0,
           (xz+wy)*s[2], (yz-wx)*s[2], (1-(xx+yy))*s[2], 0,
           t[0], t[1], t[2], 1 ];
}
function xp(m, p) {
  return [ m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
           m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
           m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14] ];
}
function readPositions(json, bin, accessorIdx) {
  const acc = json.accessors[accessorIdx];
  if (!acc || acc.type !== 'VEC3' || acc.componentType !== 5126) return [];
  const bv = json.bufferViews[acc.bufferView];
  const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = bv.byteStride || 12;
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const o = base + i * stride;
    out.push([ bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8) ]);
  }
  return out;
}

for (const file of process.argv.slice(2)) {
  const mastArg = file.indexOf('@') > 0 ? file.split('@')[1].split(',').map(Number) : null;
  const fileArg = file.indexOf('@') > 0 ? file.split('@')[0] : file;
  const { json, bin } = readGLB(fileArg);
  const meshVertSets = [];  // per node: {name, pts}
  const nodeInfo = [];
  function walk(idx, parentM) {
    const n = json.nodes[idx];
    const local = n.matrix ? n.matrix : fromTRS(n.translation, n.rotation, n.scale);
    const world = mul(parentM, local);
    if (n.mesh !== undefined) {
      const pts = [];
      for (const prim of json.meshes[n.mesh].primitives) {
        const ps = readPositions(json, bin, prim.attributes.POSITION);
        for (const p of ps) pts.push(xp(world, p));
      }
      // local-space bbox too (for wheel node axis detection): use node.matrix w/o parent
      const lpts = [];
      for (const prim of json.meshes[n.mesh].primitives) {
        const ps = readPositions(json, bin, prim.attributes.POSITION);
        for (const p of ps) lpts.push(xp(local, p));
      }
      nodeInfo.push({ name: n.name || ('mesh' + n.mesh), pts, lpts, tri: pts.length, isChildOfRoot: true });
    }
    (n.children || []).forEach(c => walk(c, world));
  }
  (json.scenes[json.scene || 0].nodes || []).forEach(n => walk(n, ident()));

  const all = [];
  for (const ni of nodeInfo) for (const p of ni.pts) all.push(p);
  const mn = [Infinity,Infinity,Infinity], mx = [-Infinity,-Infinity,-Infinity];
  for (const p of all) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
  const size = [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]];
  const ctr = [(mx[0]+mn[0])/2, (mx[1]+mn[1])/2, (mx[2]+mn[2])/2];

  // dominant horizontal axis
  const axis = size[0] >= size[2] ? 0 : 2;
  const aSize = size[axis];
  // end bands (last 18% each side) -> volume heuristic: bigger = nose
  function bandVol(a0, a1) {
    let bmn = [Infinity,Infinity,Infinity], bmx = [-Infinity,-Infinity,-Infinity], n = 0;
    for (const p of all) { if (p[axis] >= a0 && p[axis] <= a1) { n++; for (let k = 0; k < 3; k++) { bmn[k] = Math.min(bmn[k], p[k]); bmx[k] = Math.max(bmx[k], p[k]); } } }
    if (!n) return { vol: 0, n: 0 };
    return { vol: (bmx[0]-bmn[0])*(bmx[1]-bmn[1])*(bmx[2]-bmn[2]), n, yCtr: (bmx[1]+bmn[1])/2, ySize: bmx[1]-bmn[1] };
  }
  const bm = mn[axis], bM = mx[axis], span = bM - bm;
  const bandLo = bandVol(bm, bm + span * 0.18);
  const bandHi = bandVol(bM - span * 0.18, bM);
  const noseHi = bandHi.vol > bandLo.vol;
  const noseAxis = (axis === 0 ? (noseHi ? '+x' : '-x') : (noseHi ? '+z' : '-z'));

  // rotor: top 6% band
  const yTop = mx[1], yBand = mn[1] + size[1] * 0.94;
  let rx = 0, rz = 0, rn = 0;
  for (const p of all) { if (p[1] >= yBand && (yTop - p[1]) < size[1] * 0.08) { rx += p[0]; rz += p[2]; rn++; } }
  let rotor = null;
  if (rn > 20) {
    rx /= rn; rz /= rn;
    let r = 0;
    for (const p of all) { if (p[1] >= yBand) { const d = Math.hypot(p[0]-rx, p[2]-rz); if (d > r) r = d; } }
    rotor = { x: +rx.toFixed(3), y: +yBand.toFixed(3), z: +rz.toFixed(3), r: +r.toFixed(3), n: rn };
  }

  // fuselage bbox (exclude top 6% = blades)
  const fusCut = mx[1] - size[1] * 0.06;
  const fmn = [Infinity,Infinity,Infinity], fmx = [-Infinity,-Infinity,-Infinity];
  for (const p of all) { if (p[1] <= fusCut) for (let k = 0; k < 3; k++) { fmn[k] = Math.min(fmn[k], p[k]); fmx[k] = Math.max(fmx[k], p[k]); } }
  const fsz = [fmx[0]-fmn[0], fmx[1]-fmn[1], fmx[2]-fmn[2]];
  const fct = [(fmx[0]+fmn[0])/2, (fmx[1]+fmn[1])/2, (fmx[2]+fmn[2])/2];
  console.log('  fuselage(excl top6%): min ' + fmn.map(v=>+v.toFixed(2)) + ' max ' + fmx.map(v=>+v.toFixed(2)) + ' size ' + fsz.map(v=>+v.toFixed(2)) + ' ctr ' + fct.map(v=>+v.toFixed(2)));

  // y-slab table (fractions of height)
  const fr = [0.50, 0.58, 0.66, 0.72, 0.78, 0.83, 0.87, 0.90, 0.93, 0.96, 0.98, 1.001];
  let prev = fr[0];
  for (const f of fr.slice(1)) {
    let n = 0, sx = 0, sz = 0, smn = [Infinity,Infinity], smx = [-Infinity,-Infinity];
    for (const p of all) {
      const ff = (p[1] - mn[1]) / size[1];
      if (ff >= prev && ff < f) { n++; sx += p[0]; sz += p[2];
        smn[0] = Math.min(smn[0], p[0]); smx[0] = Math.max(smx[0], p[0]);
        smn[1] = Math.min(smn[1], p[2]); smx[1] = Math.max(smx[1], p[2]); }
    }
    if (n) console.log('  slab ' + prev.toFixed(2) + '-' + f.toFixed(3) + ' n=' + String(n).padEnd(5) + ' dx=' + (smx[0]-smn[0]).toFixed(2).padEnd(8) + ' dz=' + (smx[1]-smn[1]).toFixed(2).padEnd(8) + ' ctr(' + (sx/n).toFixed(2) + ',' + (sz/n).toFixed(2) + ')');
    prev = f;
  }

  if (mastArg) {
    const mxr = mastArg[0], mzr = mastArg[1];
    for (const f2 of [0.86, 0.88, 0.90, 0.92]) {
      let r2 = 0, n2 = 0, sy = 0;
      for (const p of all) {
        const ff = (p[1] - mn[1]) / size[1];
        if (ff >= f2) { const d = Math.hypot(p[0] - mxr, p[2] - mzr); n2++; sy += p[1]; if (d > r2) r2 = d; }
      }
      console.log('  mastRadius(frac>=' + f2.toFixed(2) + '): r=' + r2.toFixed(2) + '  n=' + n2 + '  avgY=' + (sy / Math.max(n2, 1)).toFixed(2));
    }
  }

  // per-node local bbox (for wheels) + thin axis
  const parts = nodeInfo.map(ni => {
    const lmn = [Infinity,Infinity,Infinity], lmx = [-Infinity,-Infinity,-Infinity];
    for (const p of ni.lpts) for (let k = 0; k < 3; k++) { lmn[k] = Math.min(lmn[k], p[k]); lmx[k] = Math.max(lmx[k], p[k]); }
    const ls = [lmx[0]-lmn[0], lmx[1]-lmn[1], lmx[2]-lmn[2]];
    const lc = [(lmx[0]+lmn[0])/2, (lmx[1]+lmn[1])/2, (lmx[2]+lmn[2])/2];
    let thinA = 'x'; if (ls[1] < ls[0] && ls[1] < ls[2]) thinA = 'y'; if (ls[2] < ls[0] && ls[2] < ls[1]) thinA = 'z';
    // world bbox of node
    const wmn = [Infinity,Infinity,Infinity], wmx = [-Infinity,-Infinity,-Infinity];
    for (const p of ni.pts) for (let k = 0; k < 3; k++) { wmn[k] = Math.min(wmn[k], p[k]); wmx[k] = Math.max(wmx[k], p[k]); }
    return { name: ni.name, tri: ni.tri, localSize: ls.map(v=>+v.toFixed(3)), localCtr: lc.map(v=>+v.toFixed(3)), thinA,
             worldCtr: wmn.map((v,i)=>+(((v+wmx[i])/2)).toFixed(3)), worldSize: wmn.map((v,i)=>+(wmx[i]-v).toFixed(3)) };
  });

  console.log('=== ' + file + '  verts:' + all.length + '  parts:' + nodeInfo.length);
  console.log('  bbox min ' + mn.map(v=>+v.toFixed(2)) + ' max ' + mx.map(v=>+v.toFixed(2)));
  console.log('  size ' + size.map(v=>+v.toFixed(2)) + '   center ' + ctr.map(v=>+v.toFixed(2)));
  console.log('  dominant axis: ' + 'xz'[axis/2] + '   end band vol lo=' + bandLo.vol.toFixed(1) + ' hi=' + bandHi.vol.toFixed(1) + '  ->  NOSE ' + noseAxis.toUpperCase());
  console.log('  rotor: ' + JSON.stringify(rotor));
  const interesting = parts.filter(p => /wheel|tire|tyre|test\.0|front|rear|whl|rim|rotor|blade/i.test(p.name));
  const show = interesting.length ? interesting : parts;
  for (const p of show.slice(0, 20)) {
    console.log('  node ' + p.name.padEnd(30).slice(0,30) + ' local sz ' + p.localSize.join(',').padEnd(22) + ' localCtr ' + p.localCtr.join(',').padEnd(22) + ' thin=' + p.thinA + '  worldCtr ' + p.worldCtr.join(',') + '  worldSz ' + p.worldSize.join(','));
  }
}
