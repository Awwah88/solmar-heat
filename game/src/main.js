// Solmar Heat — main.js
// Bootstrap: creates the renderer, scene and camera, builds the world,
// applies any ?shot= staging, and runs the frame loop. Any error that
// escapes is shown on screen as well as in the console, so a broken
// build is obvious instead of a black page.

import * as THREE from '../vendor/three.module.min.js';
import { World } from './world.js';
import { applyShot } from './shots.js';

const overlay = document.createElement('div');
overlay.id = 'errorOverlay';
overlay.style.cssText =
  'position:fixed;inset:auto 0 0 0;background:#7a1010;color:#fff;' +
  'font:14px monospace;padding:10px 14px;z-index:99;display:none;white-space:pre-wrap;';
document.body.appendChild(overlay);

window.addEventListener('error', (event) => {
  overlay.style.display = 'block';
  overlay.textContent = `Solmar Heat error: ${event.message}`;
});

function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.id = 'gl';
  renderer.domElement.style.cssText = 'position:fixed;inset:0;display:block;';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87bfe8);
  scene.fog = new THREE.Fog(0xa8c8e0, 180, 520);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(80, 40, -190);
  camera.lookAt(80, 0, -140);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const world = new World(renderer, scene, camera);
  world.init();

  // Screenshot staging (?shot=...) runs after the world exists.
  const params = new URLSearchParams(window.location.search);
  applyShot(world, params);

  let last = performance.now();
  let frames = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    frames += 1;
    try {
      world.update(dt);
    } catch (err) {
      overlay.style.display = 'block';
      overlay.textContent = `Solmar Heat error: ${err && err.message ? err.message : err}`;
      console.error(err);
      return;
    }
    renderer.render(scene, camera);
    // Expose a frame counter for the smoke tests.
    if (frames % 60 === 0) window.__solmarHeatFrames = frames;
  }
  requestAnimationFrame(loop);

  // First click anywhere enables audio (browsers require a gesture).
  const unlock = () => {
    world.audio.ensure();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
}

try {
  start();
} catch (err) {
  overlay.style.display = 'block';
  overlay.textContent = `Solmar Heat failed to start: ${err && err.message ? err.message : err}`;
  console.error(err);
}
