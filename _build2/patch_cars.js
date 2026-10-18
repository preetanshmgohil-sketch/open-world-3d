/* patch_cars.js : rename FBX2glTF car materials to semantic names.
   - body color (Yellow/White/Blue/Orange/LightBlue/DarkOrange...) -> Paint / PaintDark
   - Windows -> Glass, Headlights -> LampHead, TailLights -> LampTail,
     WhiteLights -> LampWhite, BlueLights -> LampBlue
   - body Black/Grey -> TrimBlack/TrimGrey ; wheel Black/Grey -> Tire/Rim (cloned)
   Output: qdrive/cars_fglb/<name>.glb  (in place) + carmeta.json
*/
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'qdrive', 'cars_fglb');

const PAINTISH = /^(Yellow|White|Blue|LightBlue|Orange|DarkRed|Red|Green|Pink|Purple|Cyan|GreyWhite)$/;
const meta = {};

function readGLB(file) {
  const buf = fs.readFileSync(file);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  const binOff = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binOff);
  const bin = buf.slice(binOff + 8, binOff + 8 + binLen);
  return { json, bin };
}
function writeGLB(file, json, bin) {
  let jb = Buffer.from(JSON.stringify(json), 'utf8');
  if (jb.length % 4) jb = Buffer.concat([jb, Buffer.alloc(4 - jb.length % 4, 0x20)]);
  let bb = bin;
  if (bb.length % 4) bb = Buffer.concat([bb, Buffer.alloc(4 - bb.length % 4, 0)]);
  const head = Buffer.alloc(12);
  head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jb.length + 8 + bb.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jb.length, 0); jh.writeUInt32LE(0x4E4F534A, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bb.length, 0); bh.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, jh, jb, bh, bb]));
}

for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.glb')) continue;
  const file = path.join(DIR, f);
  const name = f.replace(/\.glb$/, '');
  const { json, bin } = readGLB(file);

  /* map meshes -> owning node name */
  const meshNode = {};
  (json.nodes || []).forEach(n => { if (n.mesh !== undefined) meshNode[n.mesh] = n.name || ''; });

  const mats = json.materials || [];
  const rename = i => {
    const m = mats[i], n = m.name || '';
    if (n === 'Windows') return 'Glass';
    if (n === 'Headlights') return 'LampHead';
    if (n === 'TailLights') return 'LampTail';
    if (n === 'WhiteLights') return 'LampWhite';
    if (n === 'BlueLights') return 'LampBlue';
    if (n === 'DarkOrange') return 'PaintDark';
    if (PAINTISH.test(n)) return 'Paint';
    return n;
  };
  /* base renamed materials */
  mats.forEach((m, i) => { m.name = rename(i); });

  /* find offsets of Black/Grey materials */
  const idxOf = nm => mats.findIndex(m => m.name === nm);
  const blackI = idxOf('Black'), greyI = idxOf('Grey');
  const dup = (i, nm) => {
    const c = JSON.parse(JSON.stringify(mats[i]));
    c.name = nm;
    mats.push(c);
    return mats.length - 1;
  };
  const tireI = blackI >= 0 ? dup(blackI, 'Tire') : -1;
  const rimI = greyI >= 0 ? dup(greyI, 'Rim') : -1;

  /* rename body trims + remap wheel primitives */
  if (blackI >= 0) mats[blackI].name = 'TrimBlack';
  if (greyI >= 0) mats[greyI].name = 'TrimGrey';

  let remapped = 0;
  (json.meshes || []).forEach((mesh, mi) => {
    const nname = meshNode[mi] || mesh.name || '';
    const isWheel = /wheel/i.test(nname);
    mesh.primitives.forEach(p => {
      if (p.material === undefined) return;
      const cur = mats[p.material].name;
      if (isWheel) {
        if (cur === 'TrimBlack' && tireI >= 0) { p.material = tireI; remapped++; }
        else if (cur === 'TrimGrey' && rimI >= 0) { p.material = rimI; remapped++; }
      }
      /* body meshes keep TrimBlack / TrimGrey */
    });
  });

  /* material tweaks: make Paint/Trim physical-ish (runtime mostly rebinds anyway) */
  mats.forEach(m => {
    if (m.name === 'Glass') { m.pbrMetallicRoughness = m.pbrMetallicRoughness || {}; m.pbrMetallicRoughness.roughnessFactor = Math.min(0.05, m.pbrMetallicRoughness.roughnessFactor ?? 0.05); }
  });

  /* meta: body bbox from its mesh accessor (local: Y=length, Z=height, X=width) */
  const rootIdx = json.scenes[json.scene || 0].nodes[0];
  const kids = (json.nodes[rootIdx].children || []).map(i => json.nodes[i]);
  const bodyNode = kids.find(n => n.mesh !== undefined && !/wheel/i.test(n.name || ''));
  let m2 = null;
  if (bodyNode) {
    const acc = json.accessors[json.meshes[bodyNode.mesh].primitives[0].attributes.POSITION];
    if (acc && acc.min && acc.max) {
      m2 = {
        len: +(acc.max[1] - acc.min[1]).toFixed(3),
        wid: +(acc.max[0] - acc.min[0]).toFixed(3),
        hgt: +(acc.max[2] - acc.min[2]).toFixed(3),
        groundLocalZ: +acc.min[2].toFixed(3),
      };
    }
  }
  meta[name] = m2;
  writeGLB(file, json, bin);
  console.log(name, '->', mats.map(m => m.name).join(','), '| remapped:', remapped, '| meta:', JSON.stringify(m2));
  if (name === 'Cop') { /* expose Black material fate for debugging */ console.log('   cop mats:', mats.map((m, i) => i + ':' + m.name).join(' ')); }
}
fs.writeFileSync(path.join(DIR, 'carmeta.json'), JSON.stringify(meta, null, 1));
console.log('written', path.join(DIR, 'carmeta.json'));
