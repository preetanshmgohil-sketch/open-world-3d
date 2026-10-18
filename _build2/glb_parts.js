/* Analyze GLB part bounding boxes to identify wheels/rotors.
   Usage: node glb_parts.js <file.glb> */
const fs = require('fs');
const path = require('path');
const file = process.argv[2];
const buf = fs.readFileSync(path.join(__dirname, 'downloads', file));
const jsonLen = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));

/* --- minimal 4x4 matrix helpers (column-major like glTF) --- */
function ident() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
function mul(a, b) { /* a*b */
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k];
    o[c*4+r] = s;
  }
  return o;
}
function fromTRS(t, q, s) {
  t = t || [0,0,0]; q = q || [0,0,0,1]; s = s || [1,1,1];
  const [x,y,z,w] = q;
  const x2=x+x, y2=y+y, z2=z+z;
  const xx=x*x2, xy=x*y2, xz=x*z2, yy=y*y2, yz=y*z2, zz=z*z2, wx=w*x2, wy=w*y2, wz=w*z2;
  return [
    (1-(yy+zz))*s[0], (xy+wz)*s[0], (xz-wy)*s[0], 0,
    (xy-wz)*s[1], (1-(xx+zz))*s[1], (yz+wx)*s[1], 0,
    (xz+wy)*s[2], (yz-wx)*s[2], (1-(xx+yy))*s[2], 0,
    t[0], t[1], t[2], 1
  ];
}
function xformPoint(m, p) {
  return [
    m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
    m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
    m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]
  ];
}

const results = [];
function nodeWorld(idx, parentM) {
  const n = gltf.nodes[idx];
  const local = n.matrix ? n.matrix : fromTRS(n.translation, n.rotation, n.scale);
  const world = mul(parentM, local);
  if (n.mesh !== undefined) {
    const mesh = gltf.meshes[n.mesh];
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const prim of mesh.primitives) {
      const acc = gltf.accessors[prim.attributes.POSITION];
      if (acc && acc.min && acc.max) {
        /* 8 corners */
        for (let i = 0; i < 8; i++) {
          const p = [
            (i & 1) ? acc.max[0] : acc.min[0],
            (i & 2) ? acc.max[1] : acc.min[1],
            (i & 4) ? acc.max[2] : acc.min[2]
          ];
          const w = xformPoint(world, p);
          for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], w[k]); mx[k] = Math.max(mx[k], w[k]); }
        }
      }
    }
    results.push({
      idx, name: n.name || mesh.name || ('mesh' + n.mesh),
      prims: mesh.primitives.length,
      mn, mx,
      size: [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]],
      ctr: [(mx[0]+mn[0])/2, (mx[1]+mn[1])/2, (mx[2]+mn[2])/2]
    });
  }
  (n.children || []).forEach(c => nodeWorld(c, world));
}
const scene = gltf.scenes[gltf.scene || 0];
(scene.nodes || []).forEach(n => nodeWorld(n, ident()));

/* overall box */
const OM = [[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];
for (const r of results) for (let k = 0; k < 3; k++) { OM[0][k] = Math.min(OM[0][k], r.mn[k]); OM[1][k] = Math.max(OM[1][k], r.mx[k]); }
const osz = [OM[1][0]-OM[0][0], OM[1][1]-OM[0][1], OM[1][2]-OM[0][2]];
console.log('file: ' + file + '   parts: ' + results.length);
console.log('total bbox min: ' + OM[0].map(v=>v.toFixed(2)) + '  max: ' + OM[1].map(v=>v.toFixed(2)) + '  size: ' + osz.map(v=>v.toFixed(2)));
console.log('--- parts (sorted big->small) ---');
results.sort((a,b) => (b.size[0]*b.size[1]*b.size[2]) - (a.size[0]*a.size[1]*a.size[2]));
for (const r of results.slice(0, 24)) {
  console.log(
    '  ' + r.name.padEnd(28).slice(0,28) +
    ' sz ' + r.size.map(v=>v.toFixed(2)).join(' x ').padEnd(20) +
    ' ctr [' + r.ctr.map(v=>v.toFixed(2)).join(', ') + ']'
  );
}
