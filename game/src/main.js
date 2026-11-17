// Solmar Heat — bootstrap.
// Builds the game, exposes it as window.__solmarHeat for the playtest and
// the screenshots, and runs the frame loop. The loop clamps its step so a
// slow headless render still moves the world in stable slices.

import * as THREE from 'three';
import './config.js';
import './input.js';
import './audio.js';
import './save.js';
import './city.js';
import './vehicles.js';
import './pedestrians.js';
import './police.js';
import './combat.js';
import './missions.js';
import './hud.js';
import './shots.js';
import { Game } from './world.js';
import { readShotParams } from './shots.js';

// A visible error overlay: if anything fails to load, the player (and the
// playtest) sees what broke instead of a black screen.
const overlay = document.createElement('div');
overlay.id = 'errorOverlay';
overlay.style.cssText =
  'position:fixed;left:12px;bottom:12px;max-width:60vw;z-index:99;display:none;' +
  'background:rgba(120,10,10,0.92);color:#fff;font:13px/1.5 monospace;padding:10px 14px;border-radius:6px;';
document.body.appendChild(overlay);
window.addEventListener('error', (event) => {
  overlay.style.display = 'block';
  overlay.textContent = `Solmar Heat error: ${event.message}`;
});
window.addEventListener('unhandledrejection', (event) => {
  overlay.style.display = 'block';
  overlay.textContent = `Solmar Heat error: ${event.reason && event.reason.message ? event.reason.message : event.reason}`;
});

const { seed } = readShotParams();
const game = new Game(seed);
window.__solmarHeat = game;
window.THREE = THREE;

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  try {
    game.update(dt);
    game.render();
  } catch (err) {
    overlay.style.display = 'block';
    overlay.textContent = `Solmar Heat error: ${err && err.message ? err.message : err}`;
  }
}
frame();
