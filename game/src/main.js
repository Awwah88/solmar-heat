// Solmar Heat — bootstrap. Creates the Game, exposes it as
// window.__solmarHeat for the smoke/screenshot/playtest drivers, applies
// any ?shot= staging, and shows a readable error overlay if a module
// fails to load so a blank page never hides the cause.
import { Game } from './world.js';
import { applyShot } from './shots.js';

window.addEventListener('error', (e) => {
  const box = document.getElementById('error-box');
  if (box) {
    box.style.display = 'block';
    box.textContent = `Error: ${e.message} (${e.filename || ''}:${e.lineno || ''})`;
  }
});
window.addEventListener('unhandledrejection', (e) => {
  const box = document.getElementById('error-box');
  if (box) {
    box.style.display = 'block';
    box.textContent = `Error: ${e.reason && e.reason.message ? e.reason.message : e.reason}`;
  }
});

const game = new Game();
window.__solmarHeat = game;
applyShot(game);
