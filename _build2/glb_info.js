/* Quick GLB structure inspector: node names, materials, counts. */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'downloads');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.glb'));
for (const f of files) {
  const buf = fs.readFileSync(path.join(dir, f));
  const magic = buf.toString('ascii', 0, 4);
  if (magic !== 'glTF') { console.log(f + '  NOT GLTF'); continue; }
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  const nodeNames = (json.nodes || []).map(n => n.name || '?');
  const mats = (json.materials || []).map(m => m.name || '?');
  const wheelish = nodeNames.filter(n => /wheel|tire|tyre|rotor|prop|blade|main|tail/i.test(n));
  const imgs = (json.images || []).map(i => i.mimeType || i.uri && i.uri.slice(0, 20) || '?');
  console.log('=== ' + f + '  (' + buf.length + ' bytes)');
  console.log('  nodes:' + (json.nodes || []).length + '  meshes:' + (json.meshes || []).length + '  mats:' + (json.materials || []).length + '  images:' + imgs.length + '  anims:' + (json.animations || []).length + '  skins:' + (json.skins || []).length);
  console.log('  node names: ' + nodeNames.slice(0, 40).join(' | ').slice(0, 400));
  console.log('  wheel/rotor-like: ' + (wheelish.length ? wheelish.join(' | ') : '-'));
  console.log('  materials: ' + mats.slice(0, 20).join(' | ').slice(0, 260));
}
