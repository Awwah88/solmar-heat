// Solmar Heat — main.js
// One clear job: start the game. Create the renderer and the Game, stage a
// screenshot scene when ?shot= is given, and report a readable error if
// WebGL cannot start.
import { Game } from './world.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const errorBox = document.getElementById('loadError');

function showError(message) {
  if (errorBox) {
    errorBox.style.display = 'block';
    errorBox.textContent = message;
  }
  // eslint-disable-next-line no-console
  console.error(message);
}

let game = null;
try {
  game = new Game(canvas);
  window.__solmarHeat = game;
} catch (err) {
  showError(`Solmar Heat could not start: ${err && err.message ? err.message : err} — try desktop Chrome with WebGL enabled.`);
}

// Screenshot staging: ?shot=menu|cover|foot|mission plays a real scene
// through the game's own systems, so the frame is a genuine render.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (game && shot) {
  // Let the first frame paint, then stage the scene.
  requestAnimationFrame(() => {
    try {
      stageShot(shot, game);
    } catch (err) {
      showError(`Could not stage shot "${shot}": ${err && err.message ? err.message : err}`);
    }
  });
}
