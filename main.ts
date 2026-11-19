import { buildDossier } from "./vendor/makefun-game.ts";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || "/output";
mkdirSync(out, { recursive: true });
cpSync(join(dir, "game"), join(out, "game"), { recursive: true });
if (existsSync(join(dir, "screenshots"))) cpSync(join(dir, "screenshots"), join(out, "screenshots"), { recursive: true });
writeFileSync(join(out, "dossier.json"), buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648, game_path_max_bytes: 1000 }));
