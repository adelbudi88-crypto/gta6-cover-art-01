// Palm Neon entry program (Node 22, standard library only).
//
// Hands the built app in: copies this repository's app/ and screenshots/
// beside this file into the output directory and writes dossier.json there
// with the vendored make.fun library, so the sealed scorer can check the same
// bytes the judge reads. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps, from the competition's reference data: at most 4
// screenshots of 256 KiB, app/ at most 993 entries / 48 MiB, the dossier text
// at most 160 KiB. Passing them here makes this program fail exactly where
// the scorer would, instead of handing in bytes the gate refuses.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function fail(message) {
  console.error(`main.ts: ${message}`);
  process.exit(1);
}

if (!existsSync(join(repoRoot, 'app', 'index.html'))) fail('app/index.html is missing');
const shots = existsSync(join(repoRoot, 'screenshots')) ? readdirSync(join(repoRoot, 'screenshots')).filter((n) => !n.startsWith('.')) : [];
if (shots.length < 3 || shots.length > 4) fail(`screenshots/ holds ${shots.length} images, need 3 or 4`);

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, GATE_CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`main.ts: wrote ${shots.length} screenshots + dossier.json (${dossier.length} bytes) to ${outDir}`);
