/* gen_models.js : builds parts s23_gltf.js, s24_skel.js, s25_mdl_data.js
   - s23: three r128 GLTFLoader (vendored)
   - s24: three r128 SkeletonUtils (vendored)
   - s25: window.SA_MDL = { cars, chars, planes, ships } with base64 GLB data
*/
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, 'qdrive');
const P = path.join(__dirname, 'parts');

function b64(file) {
  return 'data:application/octet-stream;base64,' + fs.readFileSync(file).toString('base64');
}
function glbJSON(file) {
  const buf = fs.readFileSync(file);
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.toString('utf8', 20, 20 + len));
}

/* ---- s23 / s24 : vendor libs ---- */
fs.writeFileSync(path.join(P, 's23_gltf.js'),
  '/* Part 23: three.js r128 GLTFLoader (vendored, MIT) - decodes embedded GLB models. */\n' +
  fs.readFileSync(path.join(__dirname, 'vendor', 'GLTFLoader.js'), 'utf8'));
fs.writeFileSync(path.join(P, 's24_skel.js'),
  '/* Part 24: three.js r128 SkeletonUtils (vendored, MIT) - clones skinned characters. */\n' +
  fs.readFileSync(path.join(__dirname, 'vendor', 'SkeletonUtils.js'), 'utf8'));

/* ---- cars ---- */
const cars = {};
for (const n of ['NormalCar1', 'NormalCar2', 'SportsCar', 'SportsCar2', 'SUV', 'Taxi', 'Cop']) {
  const f = path.join(R, 'cars_fglb', n + '.glb');
  cars[n] = { d: b64(f) };
}

/* ---- characters ---- */
const chars = {};
for (const [dir, sex] of [['chars_m', 'm'], ['chars_w', 'w']]) {
  for (const f of fs.readdirSync(path.join(R, dir))) {
    if (!f.endsWith('.glb')) continue;
    chars[sex + '_' + f.replace(/\.glb$/, '')] = { d: b64(path.join(R, dir, f)), sex };
  }
}

/* ---- planes (find propeller node = smallest-bbox mesh child) ---- */
function propOf(file) {
  const j = glbJSON(file);
  const rootIdx = j.scenes[j.scene || 0].nodes[0];
  const kids = (j.nodes[rootIdx].children || []).map(i => j.nodes[i]);
  let best = null, bestVol = 1e18;
  for (const n of kids) {
    if (n.mesh === undefined) continue;
    const acc = j.accessors[j.meshes[n.mesh].primitives[0].attributes.POSITION];
    if (!acc || !acc.min) continue;
    const vol = (acc.max[0] - acc.min[0]) * (acc.max[1] - acc.min[1]) * (acc.max[2] - acc.min[2]);
    if (vol < bestVol) { bestVol = vol; best = n.name || null; }
  }
  return best;
}
const planes = {
  plane: { d: b64(path.join(R, 'planes', 'SmallPlane.glb')), prop: propOf(path.join(R, 'planes', 'SmallPlane.glb')), yaw: 0 },
};
const ships = {
  boat: { d: b64(path.join(R, 'ships', 'Lifeboat.glb')), yaw: 0 },
};

/* ---- bikes + helis (poly.pizza, CC-BY/CC0; see credits log) ---- */
const DL = path.join(__dirname, 'downloads');
const bikes = {
  bike: {
    d: b64(path.join(DL, 'suzuki_sv650.glb')), len: 9.36, yaw: 0,
    wheels: { front: 'test.005_test.025', rear: 'test.003_test.025' }
  }
};
const helis = {
  heli0: {   /* Poly by Google 'Helicopter' by jeremy — nose +X */
    d: b64(path.join(DL, 'heli_jeremy.glb')), len: 27.4, yaw: -Math.PI / 2,
    mast: { x: 1.40, z: 0.00 }, rotor: { y: 9.45, r: 9.0 }
  },
  heli1: {   /* kazuma CC0 'Helicopter' — nose +Z */
    d: b64(path.join(DL, 'heli_kazuma_cc0.glb')), len: 4.63, yaw: 0,
    mast: { x: 0.002, z: -0.06 }, rotor: { y: 1.30, r: 2.6 }
  }
};

const payload = JSON.stringify({ cars, chars, planes, ships, bikes, helis });
fs.writeFileSync(path.join(P, 's25_mdl_data.js'),
  '/* Part 25: embedded 3D model payload (Quaternius CC0 packs + poly.pizza bike/heli GLBs). */\n' +
  'window.SA_MDL = ' + payload + ';\n');

const kb = Math.round(fs.statSync(path.join(P, 's25_mdl_data.js')).size / 1024);
console.log('s25_mdl_data.js written:', kb, 'KB');
console.log('cars:', Object.keys(cars).join(','));
console.log('chars:', Object.keys(chars).join(','));
console.log('planes:', JSON.stringify(planes).slice(0, 90));
console.log('ships:', Object.keys(ships).join(','));
console.log('bikes:', Object.keys(bikes).join(','), '| helis:', Object.keys(helis).join(','));
