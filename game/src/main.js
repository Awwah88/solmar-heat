// Solmar Heat — bootstrap. Builds the renderer, lights and the Game, wires
// the public handle the tests drive, and runs the frame loop.
import * as THREE from 'three';
import { Game } from './world.js';
import { Input } from './input.js';

const errBox = document.getElementById('err');
window.addEventListener('error', (e) => {
  if (!errBox) return;
  errBox.style.display = 'block';
  errBox.textContent = 'Error: ' + (e.message || e.error);
});

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 7);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x9fc3dd, 220, 520);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 60, 180);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.position.set(140, 220, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -200;
sun.shadow.camera.right = 200;
sun.shadow.camera.top = 200;
sun.shadow.camera.bottom = -200;
sun.shadow.camera.far = 600;
scene.add(sun);

const input = new Input();
const game = new Game({ scene, camera, renderer, input, seed });

// Public handle: state, money and health are live getters, not functions.
window.__solmarHeat = game.api;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = clock.getDelta();
  game.frame(dt);
  renderer.render(scene, camera);
}
loop();
