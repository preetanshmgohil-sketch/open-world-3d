# Contributing to Open World 3D — Enhanced Edition

First of all: **thank you for even considering it.** This project needs help, contributions, and
coordination to grow from an impressive hobby build into a polished open-source game — and every
contribution counts, from a one-line typo fix to a whole new gameplay system.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Table of contents

* [Ways to contribute](#ways-to-contribute)
* [Quick start (dev setup)](#quick-start-dev-setup)
* [Repository & build map](#repository--build-map)
* [How the build works](#how-the-build-works)
* [The asset pipelines](#the-asset-pipelines)
* [Adding or replacing a 3D model](#adding-or-replacing-a-3d-model)
* [Changing textures](#changing-textures)
* [Testing & QA checklist](#testing--qa-checklist)
* [Code style & conventions](#code-style--conventions)
* [Asset licensing rules (strict)](#asset-licensing-rules-strict)
* [Pull request process](#pull-request-process)
* [Bugs & feature requests](#bugs--feature-requests)
* [Coordination & communication](#coordination--communication)

---

## Ways to contribute

| If you are… | You can help by… |
| --- | --- |
| a JS dev | gameplay systems, mission scripting, AI, input (gamepad/touch), refactoring, tests |
| a 3D artist | swapping/adding vehicle & character models, animations, interiors |
| a performance nerd | draw-call & memory profiling, instancing, LOD tuning, mobile work |
| a tester | cross-browser QA, repro-ing issues, balancing reports |
| a writer | docs, tutorials, GIFs, README translations, issue triage |

Issues labelled **`good first issue`** are intentionally scoped for newcomers.

---

## Quick start (dev setup)

**Requirements:** [Node.js](https://nodejs.org) ≥ 18 and git. That's it — there are **no npm
dependencies** to install. PowerShell 5+ is optional (Windows convenience scripts).

```bash
git clone <your fork>
cd open-world-3d

node _build2/build.js     # build index1.html from base.html + parts   (or: npm run build)
node _build2/serve.js     # serve this folder on http://127.0.0.1:8123
# open http://127.0.0.1:8123/index1.html
```

Windows equivalents:

```powershell
powershell -ExecutionPolicy Bypass -File _build2\build.ps1   # or: npm run build:ps
node _build2\serve.js
```

The first build prints `[build] running gen_texdata.js / gen_models.js` if the generated payload
parts are missing — that's normal (they are git-ignored, see below).

---

## Repository & build map

The game ships as **one file** (`index1.html`), but its source lives in small numbered parts:

| Part | What it contains |
| --- | --- |
| `s01_core.js` | engine core — renderer/scene bootstrap, input, HUD helpers, shared `SA` namespace |
| `s02_world.js` | world generation — heightfield, road data, terrain |
| `s03_roads.js` | roads / highways / bridges |
| `s04_country.js` | countryside (Red County towns, farms, forests) |
| `s05_lv.js` | Las Venturas (neon city district, casinos) |
| `s06_sf.js` | San Fierro (hillside city, docks) |
| `s07_ls_extra.js` | Los Santos extras |
| `s08_vehicles.js` | vehicle classes — cars, boats, planes, helicopters (flight model) |
| `s09_physics.js` | physics & world bounds |
| `s10_gangs.js` | gangs & turf zones |
| `s11_rpg.js` | RPG stats + shops (gym / barber / clothes) |
| `s12_cops.js` | 6-star police escalation |
| `s13_activities.js` | side activities (taxi, vigilante, packages…) |
| `s14_casino.js` | casino gambling |
| `s15_story.js` | story missions |
| `s16_radio.js` | procedural radio — 6 stations, Web Audio |
| `s17_extras.js` | weapons 4–8 + spraycan, Ammu-Nation, nitro, jetpack, cheats, save/load, side jobs |
| `s18_boot.js` | boot / integration — HUD, pause menu, big map, autosave, hotkeys |
| `s19_camera.js` | camera patch |
| `s20_texdata.js` | **generated** — embedded texture payload (`window.SA_TEX`) |
| `s21_visuals.js` | realism visual pass (gritty look) |
| `s22_avatars.js` | "people & rides" realism pass 2 (append-only) |
| `s23_gltf.js` | **generated** — vendored three.js r128 GLTFLoader (MIT) |
| `s24_skel.js` | **generated** — vendored three.js r128 SkeletonUtils (MIT) |
| `s25_mdl_data.js` | **generated** — embedded GLB model payload (`window.SA_MDL`) |
| `s26_swap.js` | real-3D-model retrofit — replaces box-era placeholders, wires ticks/credits |

Other key files:

| Path | Purpose |
| --- | --- |
| `_build2/base.html` | HTML/CSS shell + HUD + the `<!--@@PARTS@@-->` marker the build injects into |
| `_build2/build.js` / `build.ps1` | the two equivalent assemblers (Node / PowerShell) |
| `_build2/gen_models.js` | rebuilds `s23`/`s24`/`s25` from `qdrive/` + `downloads/` |
| `_build2/gen_texdata.js` | rebuilds `s20` from `tex_out/` + the Kenney pack |
| `_build2/qdrive/` | Quaternius source packs (CC0) consumed by the build |
| `_build2/downloads/` | poly.pizza bike & helicopter GLBs consumed by the build |
| `_build2/vendor/` | GLTFLoader.js + SkeletonUtils.js (r128, MIT) — source of `s23`/`s24` |
| `_build2/tex_src/` · `tex_out/` | Poly Haven originals (CC0) · re-encoded embeds |
| `_build2/tools/` | FBX2glTF.exe — **git-ignored**, download separately (see below) |

Dev tools you will actually use:

| Tool | What it does |
| --- | --- |
| `node _build2/glb_meta.js file.glb` | measures a model: bounding box, node names, pivot offsets (find wheels/rotors/masts) |
| `node _build2/glb_info.js` | prints GLB structure: nodes, materials, mesh counts |
| `_build2/modelview.html` | browser model viewer for eyeballing assets (served by `serve.js`) |
| `node _build2/serve.js [port]` | zero-dependency static server for the repo |
| `node _build2/peek.js` | QA screenshot receiver (see [Testing](#testing--qa-checklist)) |
| `node _build2/conv_cars.js` | OBJ → GLB car converter (alternative pipeline, see below) |
| `node _build2/patch_cars.js` | renames FBX2glTF car materials to semantic names (in place) |
| `_build2/tex_prep.ps1` · `tex_prep2.ps1` | texture resize/re-encode (Windows / System.Drawing) |

---

## How the build works

`build.js` and `build.ps1` do exactly the same thing, byte for byte:

1. ensure the generated parts exist (`s20`, `s23`, `s24`, `s25`) — if any is missing, run
   `gen_texdata.js` / `gen_models.js` first (force with `--regen` / `-Regen`);
2. read `base.html` (UTF-8, BOM-stripped);
3. sort `parts/sNN_*.js` by name and concatenate each as
   `<script>/* ==== name ==== */\r\nCODE\r\n</script>\r\n`;
4. replace the `<!--@@PARTS@@-->` marker with that block and write `../index1.html`
   (UTF-8, no BOM).

Because the output is byte-sensitive, **do not reformat parts gratuitously** and keep line
endings untouched. If you change the build logic, verify both assemblers still produce the same
bytes as each other (build to a temp copy and compare hashes).

---

## The asset pipelines

### Models

* **Characters / planes / ships** — raw GLBs live in `_build2/qdrive/{chars_m,chars_w,planes,ships}/`
  and are embedded directly by `gen_models.js`.
* **Cars** — Quaternius FBX sources in `_build2/qdrive/cars/FBX/` are converted to glTF with
  **FBX2glTF** (external tool, not shipped), then `patch_cars.js` renames materials to semantic
  names; the results live in `_build2/qdrive/cars_fglb/` and are what the build consumes.
  *Alternative*: `conv_cars.js` can convert the OBJ sources (`qdrive/cars/OBJ/`) straight to GLB
  (node-only, no external tool) — useful if you can't run FBX2glTF.
* **poly.pizza models** (motorcycle + 2 helicopters) — GLBs in `_build2/downloads/`, embedded by
  `gen_models.js` with per-model metadata (scale, yaw, mast/rotor/wheel handling).

Re-converting cars requires FBX2glTF: download the release binary for your OS from
<https://github.com/facebookincubator/FBX2glTF/releases> and place the executable in
`_build2/tools/` (that folder is git-ignored — the binary is intentionally not redistributed;
see CREDITS.md).

### Textures

`_build2/tex_src/` holds the Poly Haven CC0 originals. `tex_prep.ps1` / `tex_prep2.ps1` resize &
re-encode them into `_build2/tex_out/`; `gen_texdata.js` then embeds `tex_out/` + selected Kenney
tiles into `s20`. If you're not on Windows, don't worry: **edit `tex_out/` directly** (any JPEG
re-encoded to a sane size works) and run `npm run textures`.

---

## Adding or replacing a 3D model

1. **Prepare the asset.** Prefer `.glb` (glTF 2.0). The model should be reasonably centered on the
   origin, Y-up, with its front along +Z (this is the convention the retrofit logic assumes).
2. **Inspect it.** `node _build2/glb_meta.js yourmodel.glb` → note the bounding box (for scale),
   node names (wheels/rotor/mast candidates) and pivot offsets. Use `modelview.html` for a visual
   check.
3. **Register it.**
   * Vehicles/characters that *replace* an existing class → add an entry to the relevant list in
     `_build2/gen_models.js` (see the bike/heli reference implementations: scale from
     `meta.len`, yaw correction, rotor/mast repositioning) and wire the spawn/retrofit in
     `_build2/parts/s26_swap.js`.
   * Completely new vehicle kinds → extend the class in `s08_vehicles.js` as well and document the
     new kind in this file.
4. **Rebuild.** `node _build2/build.js`, then verify in-game (see QA checklist below).
5. **Credit it.** Add the model to [CREDITS.md](CREDITS.md) (author, license, source link) in the
   same PR — required for CC-BY, mandatory project policy for everything else.

## Changing textures

1. Drop re-encoded JPEGs (256–1024 px, quality ~80) into `_build2/tex_out/`.
2. Register them in `_build2/gen_texdata.js` (key → file) and — if materials should use them —
   wire the key in the part that builds that material (usually `s01`–`s07` or `s22`).
3. `npm run textures` → `npm run build`.
4. Keep the embedded texture budget sane: every added MB lands in `index1.html`.

---

## Testing & QA checklist

Pull requests are expected to pass this list (and say so in the PR description):

- [ ] `node _build2/build.js` completes without errors (and `build.ps1` if you touched the build).
- [ ] **Browser console is clean** — zero errors *and* zero warnings. This is a project rule.
- [ ] Model report: open the console, `SA.mdl3d.ready === true` and `SA.mdl3d.bad` is an **empty
      array** (run `SA.mdl3d.rescan()` to force a re-check).
- [ ] Played the affected area: on foot + entered/drove a vehicle; flew/rode swapped vehicles if
      you touched them.
- [ ] Save/load round-trip works (`P` → Save, reload, `P` → Load) after gameplay changes.
- [ ] No obvious performance regression in the densest view you can find
      (`renderer.info.render.calls` before/after is a good number to quote).

### Screenshot QA (optional, very useful for model/visual work)

Two tiny tools make visual review easy:

```bash
node _build2/serve.js       # terminal 1 — serves the repo on :8123
node _build2/peek.js        # terminal 2 — screenshot receiver on :8124
```

Then in the game's browser console:

```js
renderer.render(scene, camera);
fetch('http://127.0.0.1:8124/shot?name=myreview', {
  method: 'POST',
  body: renderer.domElement.toDataURL('image/jpeg', .9)
});
```

→ the image lands at `_build2/shots/myreview.jpg` (`_build2/shots/` is git-ignored). Attach
before/after shots to model-related PRs.

---

## Code style & conventions

* Plain browser JavaScript — **no transpiler, no bundler, no new runtime dependencies**
  (three.js r128 is the only one; discuss additions in an issue first).
* Each part is a self-contained IIFE that hangs its public API on `window.SA`. Later parts may
  intentionally override earlier ones (that's the project's plugin pattern — e.g. `s17` extends the
  base weapons, `s26` retrofits `s08`/`s22` visuals).
* Match the surrounding style: 2-space indent, semicolons, single quotes, compact helpers.
* No `console.log` spam — startup messages are fine, per-frame logging is not.
* Reuse geometries/materials, dispose what you remove, avoid per-frame allocations.
* Keep the save format backwards-compatible (`v: 1`). If you change it, bump the version and write
  a migration.
* Gameplay code should degrade gracefully when optional systems (jetpack, story, etc.) are absent.

---

## Asset licensing rules (strict)

The repository must remain **100 % free of license problems**. Therefore:

**Allowed**
* CC0 (public domain) — preferred.
* CC-BY — with exact attribution (author + source link + license) in
  [CREDITS.md](CREDITS.md) and, for media, also visible in-game where reasonable.
* MIT / BSD / Apache-2.0 for code or tools.
* Your own original work (state that it's yours).

**Not allowed**
* Anything ripped from commercial games (especially GTA / Rockstar / Take-Two content).
* Trademarked logos/brands used as assets.
* AI-generated assets with unclear licensing terms.
* Music/audio files (the game synthesizes audio at runtime — keep it that way).

Any PR that adds or changes an asset must update [CREDITS.md](CREDITS.md) in the same PR.

---

## Pull request process

1. **Fork** the repo and branch from `main` with a descriptive name
   (`feat/gamepad-support`, `fix/night-lights`, `assets/ambulance-model`).
2. **Open an issue first** for anything larger than a bug fix and get a 👍 on the direction —
   it prevents duplicated work.
3. Keep PRs **small and focused** (one feature/fix per PR). Rebuild `index1.html` and commit it
   if your change affects the game (the built file ships from the repo root).
4. Fill in the PR template — especially *how you tested it*.
5. CI runs the **build check** workflow (regenerates payloads and builds `index1.html` from a
   clean checkout). Keep it green.
6. A maintainer will review as time permits. Be kind, be patient — and if a PR goes quiet, a
   polite ping is welcome.

Contributions are accepted under the project's MIT license (code) with assets under their own
(compatible) licenses per CREDITS.md.

---

## Bugs & feature requests

Use the issue templates:

* 🐛 [Bug report](.github/ISSUE_TEMPLATE/bug_report.md) — include browser/OS, repro steps, and the
  **console output** (even warnings).
* 💡 [Feature request](.github/ISSUE_TEMPLATE/feature_request.md) — what, why, scope, and whether
  you can implement it.

For help questions, ideas and coordination, use **Discussions** (linked from the New Issue page).

---

## Coordination & communication

* **Issues** = work items (bugs, features, tasks with clear scope).
* **Discussions** = ideas, questions, showcases, "is anyone working on X?"
* Comment on an issue to **claim** it before starting, so two people don't build the same thing.
* Labels: `good first issue` (newcomer-friendly), `help wanted` (maintainer explicitly wants
  collaborators), `assets`, `performance`, `gameplay`, `docs`.
* Response times are best-effort (volunteer project) — but everything gets read.

**Where help is needed most right now:** see the [Help wanted
section](README.md#help-wanted--contributors--coordination) in the README — especially model swaps,
performance work, and gameplay systems.

Thank you for making this better. 🏝️
