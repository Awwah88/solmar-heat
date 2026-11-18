// Solmar Heat — the entry point: copies game/ and screenshots/ into the
// output directory and writes dossier.json with the kit's buildDossier.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync('game', join(out, 'game'), { recursive: true });
cpSync('screenshots', join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`Solmar Heat dossier written to ${join(out, 'dossier.json')} (${dossier.length} bytes)`);
