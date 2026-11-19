// Solmar Heat — bootstrap: build the Game, expose it for the tools, stage
// screenshots, and show a readable overlay if the game fails to start.

import { Game } from './world.js';
import { stageShot } from './shots.js';

const overlay = document.getElementById('error-overlay');
function showError(msg) {
  if (!overlay) return;
  overlay.style.display = 'block';
  overlay.textContent = `Solmar Heat failed to start: ${msg}`;
}
window.addEventListener('error', (e) => showError(e.message || 'unknown error'));
window.addEventListener('unhandledrejection', (e) => showError(String(e.reason || 'unhandled rejection')));

let game = null;
try {
  const mount = document.getElementById('game');
  game = new Game(mount);
  window.__solmarHeat = game;
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    // Let the first frames render, then stage the requested scene.
    setTimeout(() => stageShot(game, shot), 600);
  }
} catch (err) {
  showError(err && err.message ? err.message : String(err));
  throw err;
}
