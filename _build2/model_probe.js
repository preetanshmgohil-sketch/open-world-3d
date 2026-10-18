/* Probe GLB + OBJ/MTL files: structure, animations, materials, parts. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'qdrive');

function probeGLB(file) {
  const buf = fs.readFileSync(file);
  const magic = buf.toString('utf8', 0, 4);
  if (magic !== 'glTF') return { file, err: 'not glb' };
  const jsonLen = buf.readUInt32LE(12);
  const j = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  return {
    file: path.relative(root, file).replace(/\\/g, '/'),
    sizeKB: Math.round(buf.length / 1024),
    generator: j.asset && j.asset.generator,
    dera: !!(j.extensionsRequired || []).length ? j.extensionsRequired : undefined,
    nodes: (j.nodes || []).length,
    meshes: (j.meshes || []).map(m => m.name + '[' + m.primitives.length + ']').slice(0, 14),
    materials: (j.materials || []).map(m => m.name).slice(0, 14),
    textures: (j.textures || []).length,
    images: (j.images || []).map(i => i.mimeType || i.uri).slice(0, 8),
    skins: (j.skins || []).length,
    anims: (j.animations || []).map(a => a.name + (a.channels ? '(' + a.channels.length + ')' : '')).slice(0, 30),
    animCount: (j.animations || []).length,
  };
}

function probeOBJ(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const v = (txt.match(/^v /gm) || []).length;
  const f = (txt.match(/^f /gm) || []).length;
  const o = [...new Set((txt.match(/^o .*/gm) || []))];
  const g = [...new Set((txt.match(/^g .*/gm) || []))];
  const mtl = [...new Set((txt.match(/^usemtl .*/gm) || []))];
  return { file: path.basename(file), v, f, o: o.slice(0, 12), g: g.slice(0, 12), mtl };
}
function probeMTL(file) {
  const txt = fs.readFileSync(file, 'utf8');
  return { file: path.basename(file), mats: [...new Set(txt.match(/^newmtl .*/gm) || [])], maps: [...new Set(txt.match(/^map_[A-Za-z]+ .*/gm) || [])] };
}

const out = { chars: [], ships: [], cars: [] };
for (const dir of ['chars', 'ships']) {
  const d = path.join(root, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) out[dir].push(probeGLB(path.join(d, f)));
}
const objDir = path.join(root, 'cars', 'OBJ');
if (fs.existsSync(objDir)) {
  for (const f of fs.readdirSync(objDir)) {
    if (f.endsWith('.obj')) out.cars.push(probeOBJ(path.join(objDir, f)));
    if (f.endsWith('.mtl')) out.cars.push(probeMTL(path.join(objDir, f)));
  }
}
console.log(JSON.stringify(out, null, 1));
