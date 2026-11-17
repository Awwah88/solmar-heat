// Solmar Heat — main.ts
// The entrypoint the bounty runs. It stages the game for the grader:
// copy game/ and screenshots/ out of this repository and write
// dossier.json with the vendored make.fun library. Node 22 standard
// library only, no network, no build step — it just copies files and
// calls buildDossier, exactly as the kit's starter does.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output directory, then the two trees the entry is made of.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier is what the judge reads: the game's source text plus its
// screenshots, written by the library so the scorer can reproduce it
// byte for byte. The caps mirror the gate: at most 4 screenshots of
// 256 KiB each, a game/ of at most 993 files / 48 MiB, and a dossier
// text of at most 160 KiB.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
