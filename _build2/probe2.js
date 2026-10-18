/* probe2.js <file.glb> ... : nodes/translations/materials/bbox summary */
const fs = require('fs');
for (const file of process.argv.slice(2)) {
  const buf = fs.readFileSync(file);
  if (buf.toString('utf8', 0, 4) !== 'glTF') { console.log(file, 'not glb'); continue; }
  const jsonLen = buf.readUInt32LE(12);
  const j = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  const out = { file, gen: j.asset && j.asset.generator, sizeKB: Math.round(buf.length / 1024) };
  out.materials = (j.materials || []).map(m => m.name);
  out.nodes = (j.nodes || []).map((n, i) => {
    const bits = [];
    if (n.mesh !== undefined) {
      let bb = null;
      const mesh = j.meshes[n.mesh];
      if (mesh && mesh.primitives.length) {
        const acc = j.accessors[mesh.primitives[0].attributes.POSITION];
        if (acc && acc.min) bb = [acc.min.map(v => +v.toFixed(2)), acc.max.map(v => +v.toFixed(2))];
      }
      bits.push('mesh' + n.mesh + (bb ? ' bb:' + JSON.stringify(bb) : ''));
    }
    if (n.translation) bits.push('t:' + n.translation.map(v => +v.toFixed(3)));
    if (n.scale) bits.push('s:' + n.scale.map(v => +v.toFixed(3)));
    if (n.rotation) bits.push('r:' + n.rotation.map(v => +v.toFixed(2)));
    if (n.children) bits.push('kids:' + n.children.length);
    return (n.name || 'n' + i) + (bits.length ? '  [' + bits.join(' ') + ']' : '');
  });
  out.anims = (j.animations || []).map(a => a.name);
  out.skins = (j.skins || []).length;
  console.log(JSON.stringify(out, null, 1));
}
