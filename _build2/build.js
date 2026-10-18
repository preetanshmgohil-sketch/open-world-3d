#!/usr/bin/env node
/* build.js — cross-platform assembler: base.html + parts/sNN_*.js -> index1.html
   Mirrors _build2/build.ps1 byte-for-byte (same marker, same joins, UTF-8 no BOM)
   and auto-regenerates the generated parts (s20/s23/s24/s25) with Node when they
   are missing, so a fresh clone builds with a single command.

   Usage:  node _build2/build.js [--regen]
           --regen  force-regenerate the asset payloads before building
*/
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = __dirname;
const repoRoot = path.join(root, '..');
const partsDir = path.join(root, 'parts');
const basePath = path.join(root, 'base.html');
const outPath = path.join(repoRoot, 'index1.html');

const regen = process.argv.includes('--regen');

/* ---- make sure generated parts exist ---- */
const generators = [
  { script: 'gen_texdata.js', outputs: ['s20_texdata.js'] },
  { script: 'gen_models.js', outputs: ['s23_gltf.js', 's24_skel.js', 's25_mdl_data.js'] },
];
for (const g of generators) {
  const missing = g.outputs.filter(f => !fs.existsSync(path.join(partsDir, f)));
  if (!regen && !missing.length) continue;
  const why = regen ? '--regen' : 'missing: ' + missing.join(', ');
  console.log('[build] running ' + g.script + ' (' + why + ') ...');
  const r = spawnSync(process.execPath, [path.join(root, g.script)], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('[build] ' + g.script + ' failed'); process.exit(1); }
}

/* ---- assemble (same rules as build.ps1) ---- */
const stripBom = s => (s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s);
const base = stripBom(fs.readFileSync(basePath, 'utf8'));
const MARKER = '<!--@@PARTS@@-->';
if (!base.includes(MARKER)) { console.error('[build] marker ' + MARKER + ' not found in base.html'); process.exit(1); }

const parts = fs.readdirSync(partsDir).filter(f => /^s.*\.js$/.test(f)).sort();
if (!parts.length) { console.error('[build] no parts found in ' + partsDir); process.exit(1); }

let inject = '';
for (const name of parts) {
  const code = stripBom(fs.readFileSync(path.join(partsDir, name), 'utf8'));
  inject += '<script>/* ==== ' + name + ' ==== */\r\n' + code + '\r\n</script>\r\n';
}

const out = base.split(MARKER).join(inject);
fs.writeFileSync(outPath, out, 'utf8');
const kb = Math.round(fs.statSync(outPath).size / 1024);
console.log('Built index1.html : ' + kb + ' KB from ' + parts.length + ' parts -> ' + outPath);
