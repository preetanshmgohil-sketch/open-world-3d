# Credits & Third-Party Licenses

**Open World 3D — Enhanced Edition** bundles no commercial or “borrowed” assets. Everything is
either original code, CC0 (public domain), CC-BY (attribution), or MIT-licensed open source.
This file is the authoritative attribution list — if you fork or redistribute this project,
**keep it** (CC-BY models legally require the attribution; CC0 assets are credited with thanks).

---

## 1 · Code & libraries

| Component | License | Author / Source | Where |
| --- | --- | --- | --- |
| Game code, build system, tooling | **MIT** | Preetansh Gohil & contributors | this repository |
| [three.js](https://threejs.org) **r128** (core) | **MIT** (© 2010–2021 three.js authors) | three.js project | loaded at runtime from [cdnjs](https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js), fallback [unpkg](https://unpkg.com/three@0.128.0/build/three.min.js) — not redistributed in this repo |
| three.js **GLTFLoader** (r128) | **MIT** | three.js project | vendored: `_build2/vendor/GLTFLoader.js` → embedded in build (`s23`) |
| three.js **SkeletonUtils** (r128) | **MIT** | three.js project | vendored: `_build2/vendor/SkeletonUtils.js` → embedded in build (`s24`) |

---

## 2 · 3D models — Quaternius (CC0 1.0, Public Domain)

[Quaternius](https://quaternius.com) publishes low-poly game packs under **CC0 1.0 Universal**
([license text](https://creativecommons.org/publicdomain/zero/1.0/)), i.e. no rights reserved.
A copy of the license shipment is preserved in the repository at
`_build2/qdrive/cars/License.txt`. We credit the author enthusiastically anyway.

| Pack | Models used in the game | License |
| --- | --- | --- |
| **Cars** | NormalCar1, NormalCar2, SportsCar, SportsCar2, SUV, Taxi, Cop (7 car bodies × paint jobs = 45 car spawns) | CC0 |
| **Ultimate Modular Men** | Beach, Casual, Casual2, Punk, Suit, Swat, Worker (characters) | CC0 |
| **Ultimate Modular Women** | Casual, Formal, Punk, Suit, Worker (characters) | CC0 |
| **Airplanes** | SmallPlane (the flyable plane) | CC0 |
| **Ships** | Lifeboat (boats) | CC0 |

Converted/copied into this repository as glTF (`.glb`) payloads:
`_build2/qdrive/cars_fglb/`, `_build2/qdrive/chars_m/`, `_build2/qdrive/chars_w/`,
`_build2/qdrive/planes/`, `_build2/qdrive/ships/`.

---

## 3 · 3D models — poly.pizza (CC0 / CC-BY)

| Model | Author | License | Source | Used for |
| --- | --- | --- | --- | --- |
| “Motorcycle, Suzuki SV650” | **Paul Spooner** | **CC-BY** (Creative Commons Attribution) | <https://poly.pizza/m/1yfyze7uGxS> | the 4 street motorcycles (`_build2/downloads/suzuki_sv650.glb`) |
| “Helicopter” | **kazuma** | **CC0** (Public Domain) | <https://poly.pizza/m/EQJ2MECUbx> | one of the two helicopter types (`_build2/downloads/heli_kazuma_cc0.glb`) |
| “Helicopter” | **jeremy** (Jeremy Edelblut) | **CC-BY** (Creative Commons Attribution) | <https://poly.pizza/u/jeremy> | the other helicopter type (`_build2/downloads/heli_jeremy.glb`) |

*CC-BY compliance:* the authors are credited here, linked above, and also logged in the game's
own console at startup. If you reuse these models (or this project), keep these credits.

*Note on model files:* poly.pizza models were distributed in OBJ/GLTF and pre-converted to glTF
(`obj2gltf` by the poly.pizza pipeline; `FBX2glTF` for one file). Those conversions are format
changes only — the license of the artwork is unchanged.

---

## 4 · Textures

### Poly Haven — CC0 1.0

[Poly Haven](https://polyhaven.com) — “all assets are CC0” (public domain, no attribution
required; credited with thanks).

Photoscanned material textures (albedo + normal; asphalt also roughness), downloaded to
`_build2/tex_src/` (with `_catalog.json` for provenance) and re-encoded for embedding into
`_build2/tex_out/`:

* asphalt, pavement, grass, dry grass
* denim, jersey, linen (clothing fabrics)
* leather, rubber (vehicle/character details)

### Kenney — CC0 1.0

[Kenney](https://kenney.nl) — “Retro Textures (Fantasy)” pack, CC0. Pack retained at
`kenney_retro-textures-fantasy/` (includes `License.txt`). Selected floor tiles are embedded
(wood planks, tan tiles).

### Procedural textures

The majority of the game's surfaces (roads, buildings, sky, signs, effects) are **generated in
code** at runtime on `<canvas>` elements — no license involved.

---

## 5 · Build-time tools (not part of the shipped game)

| Tool | License | Purpose | Redistributed? |
| --- | --- | --- | --- |
| [FBX2glTF](https://github.com/facebookincubator/FBX2glTF) (Facebook) | **BSD** (© Facebook, Inc.) | converts Quaternius car FBX → glTF once, at build time | **No** — `_build2/tools/` is git-ignored; download it yourself if you re-convert (see CONTRIBUTING.md) |
| `obj2gltf` (AnalyticalGraphicsInc) | **Apache-2.0** | used by poly.pizza's download pipeline (historical; not used by this repo) | No |
| PowerShell + .NET `System.Drawing` | OS component (Windows) | texture resize/re-encode (`tex_prep*.ps1`) | No |

The repository's own scripts (`conv_cars.js`, `patch_cars.js`, `glb_meta.js`, `glb_info.js`,
`gen_models.js`, `gen_texdata.js`, …) are part of the project and covered by its **MIT** license.

---

## 6 · Audio & fonts

* **Audio:** there are no audio files anywhere in this project. All music and effects are
  **synthesized at runtime** with the Web Audio API (a tiny procedural synth engine in
  `s16_radio.js` / core parts). No music licensing applies.
* **Fonts:** system fonts only (`Arial Narrow`, `Arial`, `Segoe UI`, `system-ui`). Nothing bundled.

---

## 7 · Trademarks & fan-project notice

**Open World 3D — Enhanced Edition is an independent, non-commercial fan project.**

* It is **not affiliated with, sponsored by, or endorsed by** Rockstar Games or Take-Two
  Interactive Software, Inc.
* It contains **no assets, code, audio, or text** from *Grand Theft Auto* games. All models,
  textures and audio are original, procedurally generated, or the free assets credited above.
* City names, gang references, radio-station names and similar terms used in the game are homage
  references. *“Grand Theft Auto”*, *“San Andreas”*, and related marks belong to their respective
  owners. Nothing in this project grants any rights to those marks.
* “Open World 3D” is the name of this project only.

If you believe something in this repository infringes your rights, please open an issue — it will
be addressed promptly.

---

## 8 · How to add a new asset (for contributors)

1. Only add assets that are **CC0**, **CC-BY**, **MIT/BSD/Apache**, or your own original work.
   No ripped/commercial content, no AI-license-unclear outputs.
2. Update **this file** in the same pull request: add author, license, source link, and where the
   asset is used.
3. Prefer CC0; if CC-BY, ensure the credit line is precise (author + link + license).
4. For CC-BY-licensed code/art, add the license text if the license requires it.

*Last updated: 2026 — maintained by the project contributors.*
