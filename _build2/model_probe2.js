/* Deep probe: character bones/meshes/verts + car per-object materials. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'qdrive');

function glbJSON(file) {
  const buf = fs.readFileSync(file);
  const jsonLen = buf.readUInt32LE(12);
  return { j: JSON.parse(buf.toString('utf8', 20, 20 + jsonLen)), size: buf.length };
}

const out = {};

// characters
for (const f of ['chars/Casual.glb', 'chars/Swat.glb']) {
  const { j, size } = glbJSON(path.join(root, f));
  const nodes = j.nodes || [];
  // total vertex count
  let verts = 0;
  for (const m of (j.meshes || [])) for (const p of m.primitives) verts += j.accessors[p.attributes.POSITION].count;
  // node name tree (first 60)
  const names = nodes.map((n, i) => i + ":" + n.name + (n.mesh !== undefined ? "[mesh]" : "") + (n.children ? ">" + n.children.length : ""));
  out[f] = {
    sizeKB: Math.round(size / 1024), verts, nodes: nodes.length,
    nodeNames: names.slice(0, 80),
    meshParts: (j.meshes || []).map(m => {
      let v = 0; for (const p of m.primitives) v += j.accessors[p.attributes.POSITION].count;
      return m.name + " verts=" + v + " prims=" + m.primitives.map(p => (j.materials[p.material] || {}).name).join("+");
    }),
    skins: (j.skins || []).map(s => "skel:" + s.skeleton + " joints:" + s.joints.length),
    scenes: j.scenes && j.scenes[0].nodes
  };
}

// car OBJ per-object material usage
function objParts(file) {
  const txt = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let cur = null; const parts = {};
  for (const line of txt) {
    if (line.startsWith('o ')) { cur = line.slice(2).trim(); parts[cur] = parts[cur] || {}; }
    if (line.startsWith('usemtl ') && cur) { parts[cur][line.slice(7).trim()] = (parts[cur][line.slice(7).trim()] || 0) + 1; }
  }
  return parts;
}
function mtlKd(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const out2 = {};
  let cur = null;
  for (const line of txt.split(/\r?\n/)) {
    if (line.startsWith('newmtl ')) { cur = line.slice(7).trim(); out2[cur] = {}; }
    else if (cur && line.startsWith('Kd ')) out2[cur].Kd = line.slice(3).trim();
    else if (cur && line.startsWith('Ks ')) out2[cur].Ks = line.slice(3).trim();
  }
  return out2;
}
const objDir = path.join(root, 'cars', 'OBJ');
out.cars = {};
for (const f of fs.readdirSync(objDir)) {
  if (f.endsWith('.obj')) out.cars[f] = { parts: objParts(path.join(objDir, f)) };
  if (f.endsWith('.mtl')) out.cars[f] = { mtl: mtlKd(path.join(objDir, f)) };
}
console.log(JSON.stringify(out, null, 1));
