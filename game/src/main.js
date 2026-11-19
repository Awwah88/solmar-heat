// Solmar Heat — bootstrap. Creates the game, exposes it for tests and
// screenshots, stages ?shot= scenes, and shows a red error overlay if
// anything throws during load so a broken build is visible, not silent.
import { Game } from "./world.js";
import { stageShot } from "./shots.js";

const errBox = document.getElementById("err");
function showError(msg) {
  if (errBox) errBox.textContent = `ERROR: ${msg}`;
}
window.addEventListener("error", (e) => showError(e.message || String(e.error || e)));
window.addEventListener("unhandledrejection", (e) => showError(String(e.reason)));

let game = null;
try {
  const canvas = document.getElementById("game-canvas");
  game = new Game(canvas);
  window.__solmarHeat = game;
  game.start();
  const params = new URLSearchParams(window.location.search);
  if (params.get("shot")) stageShot(game, params);
} catch (e) {
  showError(e && e.message ? e.message : String(e));
  console.error(e);
}
