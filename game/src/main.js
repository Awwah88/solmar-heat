// Solmar Heat — the game itself: boot, the main loop, the player on foot and
// behind the wheel, stealing cars, collisions, and the win / busted / wasted
// flow. Everything else is a system this file wires together.

import * as THREE from 'three';
import { CONFIG, clamp, dist2d } from './config.js';
import { createWorld, updateWorld } from './world.js';
import { createCity, resolveCollisions } from './city.js';
import { makeCar, driveCar, createTraffic, createSmoke } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHUD } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const SPAWN = { x: 18, z: 0, heading: 0 };

/** Build Dana, the player character on foot. */
function buildPlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.4, 0.95, 8),
    new THREE.MeshLambertMaterial({ color: 0xc23b2e }),
  );
  jacket.position.y = 0.98;
  jacket.castShadow = true;
  group.add(jacket);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
  );
  head.position.y = 1.66;
  head.castShadow = true;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.6, 0.32),
    new THREE.MeshLambertMaterial({ color: 0x2c3e50 }),
  );
  legs.position.y = 0.3;
  group.add(legs);
  return group;
}

/** Boot the game. */
function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('game').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 700);

  const world = createWorld(scene);
  const city = createCity(scene);
  const smoke = createSmoke(scene);

  // The shared game object every system reads.
  const game = {
    scene,
    renderer,
    state: 'menu',
    money: 0,
    health: CONFIG.player.health,
    time: 0,
    shotMode: false,
    player: { car: null, mesh: null, heading: SPAWN.heading, onFoot: true },
    parkedCars: [],
  };
  game.player.mesh = buildPlayerMesh();
  game.player.mesh.position.set(SPAWN.x, 0, SPAWN.z);
  scene.add(game.player.mesh);

  game.audio = createAudio();
  game.hud = createHUD(game);
  game.traffic = createTraffic(scene, CONFIG.traffic.count);
  game.pedestrians = createPedestrians(scene, CONFIG.pedestrians.count);
  game.police = createPolice(scene, game);
  game.combat = createCombat(scene, game);
  game.missions = createMissions(game);
  const input = createInput((e) => {
    if (game.state !== 'playing' || game.shotMode) return;
    game.audio.ensure();
    if (!game.player.car) {
      if (game.combat.pistolOwned) game.combat.shoot(game.time);
      else game.combat.punch(game.time);
    }
  });

  game.playerPos = () => {
    if (game.player.car) {
      const p = game.player.car.group.position;
      return { x: p.x, z: p.z };
    }
    const p = game.player.mesh.position;
    return { x: p.x, z: p.z };
  };
  game.playerHeading = () => (game.player.car ? game.player.car.heading : game.player.heading);

  game.setPlayerPos = (x, z, heading) => {
    game.player.mesh.position.set(x, 0, z);
    game.player.heading = heading;
    game.player.mesh.rotation.y = heading;
  };

  game.addMoney = (n) => {
    game.money += n;
    game.hud.setMoney(game.money);
  };

  game.damagePlayer = (n) => {
    if (game.state !== 'playing') return;
    game.health = Math.max(0, game.health - n);
    game.hud.setHealth(game.health);
    if (game.health <= 0) game.wasted();
  };

  game.save = () => {
    saveGame({
      money: game.money,
      missionIndex: game.missions.missionIndex,
      pistolOwned: game.combat.pistolOwned,
      shellsTaken: game.missions.shellsTaken,
      health: game.health,
    });
  };

  game.busted = () => {
    if (game.state !== 'playing') return;
    game.state = 'busted';
    game.audio.siren(false);
    game.audio.busted();
    game.hud.showScreen('busted');
  };

  game.wasted = () => {
    if (game.state !== 'playing') return;
    game.state = 'wasted';
    game.audio.siren(false);
    game.audio.busted();
    game.hud.showScreen('wasted');
  };

  game.win = () => {
    if (game.state !== 'playing') return;
    game.state = 'win';
    game.audio.siren(false);
    game.hud.showScreen('win');
    game.save();
  };

  /** Put the player behind the wheel of a car. */
  game.enterCar = (car) => {
    const ti = game.traffic.cars.indexOf(car);
    if (ti >= 0) {
      game.traffic.cars.splice(ti, 1);
      game.police.addWanted(1);
      game.hud.toast('Car stolen', 'Wanted level up — the law is coming');
    }
    game.player.car = car;
    car.isPlayer = true;
    game.player.mesh.visible = false;
    game.audio.ensure();
  };

  /** Step out of the car onto the street. */
  game.exitCar = () => {
    const car = game.player.car;
    if (!car) return;
    car.speed = 0;
    car.isPlayer = false;
    const side = car.heading + Math.PI / 2;
    const px = car.group.position.x + Math.sin(side) * 2.6;
    const pz = car.group.position.z + Math.cos(side) * 2.6;
    game.player.car = null;
    game.setPlayerPos(px, pz, car.heading);
    game.player.mesh.visible = true;
    if (!game.parkedCars.includes(car)) game.parkedCars.push(car);
  };

  /** Nearest stealable car to the player, within reach. */
  function nearestCar() {
    const p = game.playerPos();
    let best = null;
    let bestD = 3.6;
    const candidates = [...game.traffic.cars, ...game.parkedCars];
    if (game.missions.goldCar) candidates.push(game.missions.goldCar);
    for (const car of candidates) {
      const pos = car.group.position;
      const d = dist2d(p.x, p.z, pos.x, pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function resetRun(continueSave) {
    game.money = 0;
    game.health = CONFIG.player.health;
    game.player.car = null;
    game.player.mesh.visible = true;
    game.setPlayerPos(SPAWN.x, SPAWN.z, SPAWN.heading);
    game.police.reset();
    game.missions.reset();
    for (const car of [...game.parkedCars]) {
      scene.remove(car.group);
    }
    game.parkedCars = [];
    game.hud.setMoney(0);
    game.hud.setHealth(game.health);
    game.hud.setWanted(0);
    if (continueSave) {
      const s = loadGame();
      if (s) {
        game.money = s.money;
        game.hud.setMoney(game.money);
        game.health = s.health;
        game.hud.setHealth(game.health);
        if (s.pistolOwned) game.combat.givePistol();
        if (s.missionIndex > 0) game.missions.jumpTo(s.missionIndex);
      }
    }
    game.state = 'playing';
    game.hud.hideScreens();
    game.audio.ensure();
  }

  game.hud.onStart((cont) => {
    if (!cont) clearSave();
    resetRun(cont);
  });
  game.hud.showContinue(hasSave());
  game.hud.showScreen('menu');
  game.missions.start();

  // Stage a screenshot scene when the URL asks for one.
  const shotCamera = stageShot(game);
  if (shotCamera) {
    camera.position.set(...shotCamera.camPos);
    camera.lookAt(...shotCamera.camLook);
    // The staged scene sets money/wanted directly, so sync the HUD once.
    game.hud.setMoney(game.money);
    game.hud.setWanted(game.police.wanted);
    game.hud.setHealth(game.health);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // The test hook: state the screenshot and smoke scripts read.
  window.__solmarHeat = game;

  const clock = new THREE.Clock();
  let autosaveAt = 0;
  let pedHitAt = 0;
  const camTarget = new THREE.Vector3();
  const camPos = new THREE.Vector3();

  function updateCamera(dt) {
    if (shotCamera) {
      camera.position.set(...shotCamera.camPos);
      camera.lookAt(...shotCamera.camLook);
      return;
    }
    const p = game.playerPos();
    const heading = game.playerHeading();
    const back = game.player.car ? 11 : 7.5;
    const height = game.player.car ? 5 : 4;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    camTarget.set(p.x + fx * 5, 1.2, p.z + fz * 5);
    camPos.set(p.x - fx * back, height, p.z - fz * back);
    camera.position.lerp(camPos, Math.min(1, 5 * dt));
    camera.lookAt(camTarget);
  }

  function updatePlaying(dt) {
    const axes = input.driveAxes();
    const player = game.player;

    if (player.car) {
      const car = player.car;
      driveCar(car, { throttle: axes.throttle, steer: axes.steer, brake: axes.brake, handbrake: axes.handbrake }, dt, city.colliders, city.palmColliders, game.time);
      // Tire smoke on hard turns and handbrake slides.
      if ((axes.handbrake || Math.abs(axes.steer) > 0.7) && Math.abs(car.speed) > 10 && game.time - car.smokeAt > 0.12) {
        car.smokeAt = game.time;
        smoke.spawn(car.group.position.x - Math.sin(car.heading) * 1.8, car.group.position.z - Math.cos(car.heading) * 1.8);
      }
      // Running a pedestrian over is a crime.
      const pp = car.group.position;
      if (Math.abs(car.speed) > 8 && game.time - pedHitAt > 3) {
        if (game.pedestrians.knockDown(pp.x, pp.z, 2.2, game.time)) {
          pedHitAt = game.time;
          game.police.addWanted(1);
          game.audio.crash();
        }
      }
      game.audio.engine(Math.abs(car.speed) / CONFIG.car.maxSpeed);
      if (input.wasPressed('KeyE')) game.exitCar();
    } else {
      // On foot: A/D turn, W/S move, Shift sprints.
      const speed = axes.run ? CONFIG.player.runSpeed : CONFIG.player.walkSpeed;
      player.heading += -axes.steer * 2.6 * dt;
      const fx = Math.sin(player.heading);
      const fz = Math.cos(player.heading);
      const mesh = player.mesh;
      mesh.position.x += fx * axes.throttle * speed * dt;
      mesh.position.z += fz * axes.throttle * speed * dt;
      mesh.rotation.y = player.heading;
      resolveCollisions(mesh.position, CONFIG.player.radius, city.colliders);
      for (const palm of city.palmColliders) {
        const dx = mesh.position.x - palm.x;
        const dz = mesh.position.z - palm.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < palm.r + 0.7 && d > 0.001) {
          mesh.position.x = palm.x + (dx / d) * (palm.r + 0.7);
          mesh.position.z = palm.z + (dz / d) * (palm.r + 0.7);
        }
      }
      mesh.position.x = clamp(mesh.position.x, -CONFIG.world.bounds, CONFIG.world.bounds);
      mesh.position.z = clamp(mesh.position.z, -CONFIG.world.bounds, CONFIG.world.bounds);
      game.audio.engine(0);
      if (input.wasPressed('KeyE')) {
        const car = nearestCar();
        if (car) game.enterCar(car);
        else game.missions.tryTaxiInteract();
      }
      if (input.wasPressed('KeyF')) game.combat.punch(game.time);
    }

    const pPos = game.playerPos();
    const pSpeed = player.car ? Math.abs(player.car.speed) : 0;
    game.traffic.update(dt, player.car, game.time);
    game.pedestrians.update(dt, pPos, pSpeed, game.time);
    game.police.update(dt, game.time);
    game.police.flash(game.time);
    game.missions.update(dt, game.time);
    game.combat.update(dt, game.time, camera);
    game.audio.siren(game.police.wanted > 0);

    // Spray Shop: drive in with cash and the heat is gone.
    const spray = CONFIG.landmarks.spray;
    if (player.car && game.police.wanted > 0 && dist2d(pPos.x, pPos.z, spray.x, spray.z) < 10 && game.money >= CONFIG.economy.sprayCost) {
      game.money -= CONFIG.economy.sprayCost;
      game.police.clearWanted();
      game.hud.setMoney(game.money);
      game.hud.toast('Spray Shop', `-$${CONFIG.economy.sprayCost} — wanted level cleared`);
    }

    // HUD + autosave.
    game.hud.setWanted(game.police.wanted);
    game.hud.drawMinimap();
    if (game.time > autosaveAt) {
      autosaveAt = game.time + 20;
      game.save();
    }
    input.endFrame();
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    game.time += dt;
    updateWorld(world, dt, game.time);
    smoke.update(dt, camera);
    if (game.state === 'playing' && !game.shotMode) {
      updatePlaying(dt);
    } else if (game.state === 'menu' || game.shotMode) {
      // Attract mode: traffic and pedestrians keep the city alive.
      game.traffic.update(dt, null, game.time);
      game.pedestrians.update(dt, null, 0, game.time);
      game.hud.drawMinimap();
    }
    updateCamera(dt);
    renderer.render(scene, camera);
  }
  animate();
}

boot();
