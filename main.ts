// SUNSET SHORES — the gta6-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its classic scripts, three.js
// vendored under game/vendor/, no network request). This program hands it
// in: it checks the screenshots are present and within the gate's limits,
// copies game/ and screenshots/ from beside this file to /output, and writes
// /output/dossier.json — the summary the judge reads — with the vendored
// make.fun library.
//
// The game itself: SUNSET SHORES, an open-world crime game set in the
// sun-soaked fictional city of Palmera Bay. Leo Marin, ex-getaway driver,
// plays "The Palmera Job" (6 story missions, ending with a boat escape at
// the pier) on foot and by car, with traffic, pedestrians, a city bus on a
// perimeter loop, a 0-5 star wanted system, pursuing police cruisers, foot
// cops, a helicopter and roadblocks at 4 stars, pistol, SMG and shotgun
// combat (headshots pay double, rusher enemies charge with knives), side
// jobs (taxi fares, hidden smuggler packages), stunt ramps, Pay 'n Spray,
// a day-night cycle, sprint stamina, three radio stations, a cinematic
// camera and photo mode, a HUD with minimap, start menu, pause, save/load,
// synthesised sound and music. Put 3 or 4 PNG or JPEG screenshots in
// screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight: the gate refuses more than 4 screenshots or one over 256 KiB,
// so refuse early here with a clear message instead of a silent bad entry.
const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((f) => !f.startsWith('.')).sort()
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shots.length}`);
}
for (const shot of shots) {
  const size = statSync(join(shotsDir, shot)).size;
  if (size > 262144) throw new Error(`screenshot ${shot} is ${size} bytes (max 262144)`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`SUNSET SHORES: ${shots.length} screenshots (${shots.join(', ')}) -> ${out}`);
