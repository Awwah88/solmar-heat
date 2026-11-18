// Solmar Heat — the game itself. Owns the renderer, the loop, the
// player (on foot and driving), collisions, pickups, the spray shop,
// the state machine and the window.__solmarHeat handle the dev tools
// (shoot / smoke / playtest) read every poll.
import * as THREE from 'three';
import { CFG, clamp, wrapAngle } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity, collideCircle } from './city.js';
import { makeCar, createTraffic, createParkedCars } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { loadSave, saveGame, clearSave } from './save.js';
import { stageShot } from './shots.js';

export function createGame() {
  const input = createInput();
  const audio = createAudio();

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = false;
  document.getElementById('game').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CFG.colors.sky);
  scene.fog = new THREE.Fog(CFG.colors.fog, 90, 340);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 60, -140);

  // Sunset lighting: warm low sun from the south-west over the sea.
  const sun = new THREE.DirectionalLight(0xffb36b, 1.5);
  sun.position.set(-60, 55, 180);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xff9a7a, 0x2a2a3a, 0.85));
  const fill = new THREE.DirectionalLight(0x8090b0, 0.35);
  fill.position.set(80, 40, -120);
  scene.add(fill);

  const city = buildCity(scene);
  const colliders = city.colliders;

  // The handle: the dev tools read and (for the health safety net)
  // write these fields directly, so they stay plain mutable data.
  const G = {
    state: 'menu', money: 0, health: 100, time: 0,
    shotMode: null, shotCamera: null,
    player: { pos: { x: CFG.spawn.x, z: CFG.spawn.z }, heading: CFG.spawn.heading, car: null },
    traffic: null, parkedCars: [], police: null, missions: null, hud: null,
    renderer, scene, camera, city, cfg: CFG,
    playerPos() { return G.player.pos; },
    playerHeading() { return G.player.heading; },
  };

  const traffic = createTraffic(scene, colliders);
  G.traffic = traffic;
  let parkedCars = createParkedCars(scene);
  G.parkedCars = parkedCars;
  const police = createPolice(scene, colliders);
  G.police = police;
  const peds = createPedestrians(scene);
  const combat = createCombat(scene, audio);

  // Player mesh (visible on foot, hidden in a car).
  const playerMesh = new THREE.Group();
  {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.4, 8), new THREE.MeshLambertMaterial({ color: 0x2e86c1 }));
    body.position.y = 0.9;
    playerMesh.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    head.position.y = 1.9;
    playerMesh.add(head);
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
    jacket.position.y = 1.35;
    playerMesh.add(jacket);
  }
  playerMesh.position.set(CFG.spawn.x, 0, CFG.spawn.z);
  scene.add(playerMesh);

  // Tire smoke puffs (a tiny reusable pool).
  const smokeTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(200,200,200,0.55)');
    grad.addColorStop(1, 'rgba(200,200,200,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const puffs = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false }));
    s.scale.set(1, 1, 1);
    s.visible = false;
    scene.add(s);
    puffs.push({ s, life: 0 });
  }
  let puffIdx = 0;
  function puff(x, z) {
    const p = puffs[puffIdx++ % puffs.length];
    p.s.position.set(x, 0.6, z);
    p.s.visible = true;
    p.s.material.opacity = 0.5;
    p.s.scale.set(1.2, 1.2, 1);
    p.life = 0.7;
  }

  // Cash + shell pickups.
  const pickups = [];
  function addPickup(kind, x, z) {
    const mesh = kind === 'cash'
      ? new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.7), new THREE.MeshLambertMaterial({ color: 0x2ecc40 }))
      : new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 6), new THREE.MeshLambertMaterial({ color: 0xf5d5e0 }));
    mesh.position.set(x, 0.5, z);
    scene.add(mesh);
    pickups.push({ kind, x, z, mesh, taken: false });
  }
  const cashSpots = [[18, -30], [-18, 30], [54, -78], [-90, -30], [90, 30], [-54, 102], [126, 30], [-126, -102], [18, 150], [-18, -150]];
  for (const [x, z] of cashSpots) addPickup('cash', x, z);
  const shellSpots = [[54, 168], [66, 174], [58, 178], [144, 168], [156, 174], [146, 178], [-60, 170], [120, 172]];
  for (const [x, z] of shellSpots) addPickup('shell', x, z);

  // Taxi state (separate from the mission marker by design).
  const taxi = { dest: null, respawnAt: 0 };

  let wallCutAt = -10;
  let wasHitWall = false;
  let sprayAt = -10;
  let saveAt = 0;

  const hud = createHud(G);
  G.hud = hud;

  // Mission context: everything missions.js needs from the game.
  const missions = createMissions(G, {
    toast: (m) => hud.toast(m),
    audio,
    save: () => saveGame({ money: G.money, missionIndex: missions.missionIndex, health: G.health, x: G.player.pos.x, z: G.player.pos.z, shellsTaken: missions.shellsTaken, hasPistol: combat.hasPistol }),
    playerPos: () => G.player.pos,
    playerCar: () => G.player.car,
    addMoney: (n) => { G.money += n; hud.setMoney(G.money); },
    police,
    combat,
    scene,
    registerGoldCar: (gold) => { /* the gold car is entered from missions.goldCar */ },
    win: () => {
      G.state = 'win';
      hud.setWinMoney(G.money);
      hud.showScreen('win-screen');
      clearSave();
      audio.jingle();
    },
  });
  G.missions = missions;

  function objectiveText() {
    const mi = missions.missionIndex;
    if (mi >= 4) return 'Solmar Legend — you did it, Dash!';
    const base = CFG.missions[mi].text;
    if (mi === 1) return `${base} — package ${missions.packageIdx + 1} of 3 · ${Math.ceil(missions.timer)}s`;
    if (mi === 3) return missions.m4Stage === 0 ? 'Steal the gold Marlin GT at the Hotel' : missions.m4Stage === 1 ? 'Deliver the GT to the Old Lighthouse' : 'Escape to the Safehouse!';
    return base;
  }

  // --- entering / exiting cars ------------------------------------------
  function nearestCar(maxD) {
    const p = G.player.pos;
    let best = null, bestD = maxD;
    const consider = (car) => {
      const cp = car.group.position;
      const d = Math.hypot(cp.x - p.x, cp.z - p.z);
      if (d < bestD) { bestD = d; best = car; }
    };
    for (const c of parkedCars) consider(c);
    for (const c of traffic.cars) consider(c);
    if (missions.goldCar && !missions.goldCar.stolen) consider(missions.goldCar);
    return best;
  }

  function enterCar(car) {
    G.player.car = car;
    car.owned = car.owned || false;
    playerMesh.visible = false;
    const i = parkedCars.indexOf(car);
    if (i >= 0) parkedCars.splice(i, 1);
    const t = traffic.cars.indexOf(car);
    if (t >= 0) traffic.cars.splice(t, 1);
    if (!car.owned) {
      car.owned = true;
      police.addWanted(1);
      hud.setWanted(police.wanted);
      hud.toast(car === missions.goldCar ? 'You stole the gold Marlin GT!' : 'You stole a car! The cops are coming.');
      audio.blip();
      missions.onSteal(car);
      if (car === missions.goldCar) car.stolen = true;
    }
    G.player.pos.x = car.group.position.x;
    G.player.pos.z = car.group.position.z;
    G.player.heading = car.heading;
  }

  function exitCar() {
    const car = G.player.car;
    if (!car) return;
    car.speed = 0;
    const side = { x: G.player.pos.x + Math.cos(G.player.heading) * 2.6, z: G.player.pos.z - Math.sin(G.player.heading) * 2.6 };
    const fixed = collideCircle(side.x, side.z, CFG.playerRadius, colliders);
    G.player.pos.x = fixed.x;
    G.player.pos.z = fixed.z;
    G.player.car = null;
    playerMesh.visible = true;
    playerMesh.position.set(G.player.pos.x, 0, G.player.pos.z);
    if (!parkedCars.includes(car)) parkedCars.push(car);
  }

  // --- damage ------------------------------------------------------------
  function damage(n) {
    G.health = Math.max(0, G.health - n);
    hud.setHealth(G.health);
    if (G.health <= 0 && G.state === 'playing') {
      G.state = 'wasted';
      hud.showScreen('wasted-screen');
      audio.busted();
    }
  }

  // --- run reset (retry after busted/wasted, or play again) -------------
  function resetRun() {
    if (G.player.car) {
      scene.remove(G.player.car.group);
      G.player.car = null;
    }
    for (const c of parkedCars) scene.remove(c.group);
    parkedCars = createParkedCars(scene);
    G.parkedCars = parkedCars;
    if (missions.goldCar) { scene.remove(missions.goldCar.group); }
    police.clear();
    combat.reset();
    missions.reset();
    for (const pk of pickups) { pk.taken = false; pk.mesh.visible = true; }
    peds.fare.waiting = true;
    peds.fare.inCar = false;
    peds.fare.dest = null;
    peds.fare.mesh.visible = true;
    taxi.dest = null;
    G.money = 0;
    G.health = 100;
    G.time = 0;
    G.player.pos.x = CFG.spawn.x;
    G.player.pos.z = CFG.spawn.z;
    G.player.heading = CFG.spawn.heading;
    playerMesh.visible = true;
    playerMesh.position.set(CFG.spawn.x, 0, CFG.spawn.z);
    hud.setMoney(0);
    hud.setHealth(100);
    hud.setWanted(0);
    G.state = 'playing';
    hud.showScreen(null);
    audio.ensure();
    wallCutAt = -10;
    wasHitWall = false;
  }

  function startGame(fresh) {
    audio.ensure();
    if (fresh) {
      clearSave();
      resetRun();
    } else {
      const s = loadSave();
      if (s) {
        G.money = s.money || 0;
        G.health = s.health || 100;
        G.player.pos.x = s.x || CFG.spawn.x;
        G.player.pos.z = s.z || CFG.spawn.z;
        playerMesh.position.set(G.player.pos.x, 0, G.player.pos.z);
        const mi = s.missionIndex || 0;
        if (mi >= 1 && mi <= 3) {
          missions.missionIndex = mi;
          missions.current = { title: CFG.missions[mi].title };
          if (mi === 1) {
            missions.packageIdx = 0;
            missions.timer = CFG.courierSeconds;
            missions.marker = { x: CFG.landmarks.hotel.marker.x, z: CFG.landmarks.hotel.marker.z };
          } else if (mi === 2) {
            missions.marker = { x: CFG.landmarks.spray.marker.x, z: CFG.landmarks.spray.marker.z };
          } else {
            missions.ensureGold();
            missions.marker = { x: CFG.goldCar.x, z: CFG.goldCar.z };
          }
        }
        if (s.hasPistol) combat.unlockPistol();
        hud.setMoney(G.money);
        hud.setHealth(G.health);
      }
      G.state = 'playing';
      hud.showScreen(null);
    }
  }

  // --- driving -----------------------------------------------------------
  function driveCar(car, dt, now) {
    const P = CFG.physics;
    const fwd = input.isDown('KeyW');
    const back = input.isDown('KeyS');
    const hand = input.isDown('Space');
    if (fwd) car.speed += P.accel * dt;
    else if (back) {
      if (car.speed > 0.5) car.speed -= P.brake * dt;
      else car.speed -= P.reverseAccel * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
    }
    if (hand) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
    car.speed = clamp(car.speed, -P.maxReverse, P.maxSpeed);
    const steer = (input.isDown('KeyA') ? 1 : 0) - (input.isDown('KeyD') ? 1 : 0);
    const grip = clamp(Math.abs(car.speed) / 9, 0.25, 1);
    car.setHeading(car.heading + steer * P.turnRate * grip * dt * (car.speed >= 0 ? 1 : -1));
    // Substep the move so a fast car cannot tunnel through a building.
    const dist = Math.abs(car.speed) * dt;
    const steps = Math.max(1, Math.ceil(dist / 1.5));
    const sdt = dt / steps;
    let hitWall = false;
    for (let i = 0; i < steps; i++) {
      car.group.position.x += Math.sin(car.heading) * car.speed * sdt;
      car.group.position.z += Math.cos(car.heading) * car.speed * sdt;
      const fixed = collideCircle(car.group.position.x, car.group.position.z, CFG.carRadius, colliders);
      if (fixed.hit) hitWall = true;
      car.group.position.x = fixed.x;
      car.group.position.z = fixed.z;
    }
    // Wall-speed cut (fix #4): at most once per 0.5s, never per frame.
    // Damage only on a FRESH impact — grinding along a wall at speed
    // must not drain health every half second.
    const freshHit = hitWall && !wasHitWall;
    wasHitWall = hitWall;
    if (hitWall && Math.abs(car.speed) > 12 && now - wallCutAt > P.wallCutCooldown) {
      wallCutAt = now;
      car.speed *= P.wallCut;
      if (freshHit) { damage(4); audio.crash(); }
    }
    // Tire smoke on hard turns and handbrake slides.
    if (Math.abs(steer) > 0 && Math.abs(car.speed) > 14) {
      puff(car.group.position.x - Math.sin(car.heading) * 1.6, car.group.position.z - Math.cos(car.heading) * 1.6);
    }
    for (const w of car.wheels) w.rotation.z += car.speed * dt * 1.4;
    G.player.pos.x = car.group.position.x;
    G.player.pos.z = car.group.position.z;
    G.player.heading = car.heading;
  }

  function walkPlayer(dt) {
    const P = CFG.physics;
    const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = (input.isDown('KeyW') ? (run ? P.runSpeed : P.walkSpeed) : 0) +
      (input.isDown('KeyS') ? -P.walkSpeed * 0.5 : 0);
    const steer = (input.isDown('KeyA') ? 1 : 0) - (input.isDown('KeyD') ? 1 : 0);
    G.player.heading += steer * 2.6 * dt;
    const nx = G.player.pos.x + Math.sin(G.player.heading) * speed * dt;
    const nz = G.player.pos.z + Math.cos(G.player.heading) * speed * dt;
    const fixed = collideCircle(nx, nz, CFG.playerRadius, colliders);
    G.player.pos.x = clamp(fixed.x, -178, 178);
    G.player.pos.z = clamp(fixed.z, -178, 178);
    playerMesh.position.set(G.player.pos.x, 0, G.player.pos.z);
    playerMesh.rotation.y = G.player.heading;
    // Walk bob.
    playerMesh.position.y = speed !== 0 ? Math.abs(Math.sin(G.time * 9)) * 0.08 : 0;
  }

  // --- per-frame update ---------------------------------------------------
  function update(dt, now) {
    G.time += dt;
    // Player.
    if (G.player.car) {
      driveCar(G.player.car, dt, now);
    } else {
      walkPlayer(dt);
    }
    // Enter / exit a car.
    if (input.wasPressed('KeyE')) {
      if (G.player.car) exitCar();
      else {
        const car = nearestCar(3.8);
        if (car) enterCar(car);
      }
    }
    // Combat on foot.
    if (!G.player.car) {
      if (input.mouseClicked() && combat.hasPistol) {
        const hit = combat.shoot(now, G.player.pos, G.player.heading, peds.walkers, police.policeCars);
        if (hit === 'ped') { police.addWanted(1); hud.setWanted(police.wanted); }
        if (hit === 'cop') { police.addWanted(1); hud.setWanted(police.wanted); }
      }
      if (input.wasPressed('KeyF')) {
        const hit = combat.punch(now, G.player.pos, G.player.heading, peds.walkers);
        if (hit === 'ped') { police.addWanted(1); hud.setWanted(police.wanted); }
      }
    }
    combat.update(now);

    // Spray shop: repaint + clear wanted for $75.
    if (G.player.car && G.money >= CFG.economy.spray && police.wanted > 0 && now - sprayAt > 3) {
      const s = CFG.landmarks.spray;
      const dx = G.player.pos.x - s.x, dz = G.player.pos.z - s.z;
      if (dx * dx + dz * dz < s.radius * s.radius) {
        sprayAt = now;
        G.money -= CFG.economy.spray;
        hud.setMoney(G.money);
        police.setWanted(0);
        hud.setWanted(0);
        const nc = CFG.colors.car[Math.floor(Math.random() * CFG.colors.car.length)];
        G.player.car.group.children[0].material.color.setHex(nc);
        hud.toast('Fresh paint — the cops lost you! -$75');
        audio.jingle();
      }
    }

    // Pickups.
    for (const pk of pickups) {
      if (pk.taken) continue;
      const dx = G.player.pos.x - pk.x, dz = G.player.pos.z - pk.z;
      if (dx * dx + dz * dz < 2.5 * 2.5) {
        pk.taken = true;
        pk.mesh.visible = false;
        if (pk.kind === 'cash') {
          G.money += CFG.economy.cash;
          hud.setMoney(G.money);
          hud.toast(`+$${CFG.economy.cash} cash`);
          audio.cash();
        } else {
          missions.addShell();
          G.money += CFG.economy.shell;
          hud.setMoney(G.money);
          hud.toast(`Shell found! +$${CFG.economy.shell}`);
          audio.blip();
        }
      }
    }

    // Taxi side job.
    const fare = peds.fare;
    if (fare.waiting && G.player.car) {
      const dx = G.player.pos.x - fare.x, dz = G.player.pos.z - fare.z;
      if (dx * dx + dz * dz < 12 * 12) {
        fare.waiting = false;
        fare.inCar = true;
        fare.mesh.visible = false;
        const road = CFG.roads[Math.floor(Math.random() * CFG.roads.length)];
        const road2 = CFG.roads[Math.floor(Math.random() * CFG.roads.length)];
        taxi.dest = { x: road, z: road2 };
        hud.toast(`Taxi fare! Take them to (${taxi.dest.x}, ${taxi.dest.z}) — $40`);
      }
    } else if (fare.inCar && taxi.dest && G.player.car) {
      const dx = G.player.pos.x - taxi.dest.x, dz = G.player.pos.z - taxi.dest.z;
      if (dx * dx + dz * dz < 8 * 8) {
        G.money += CFG.economy.taxi;
        hud.setMoney(G.money);
        hud.toast(`Fare delivered! +$${CFG.economy.taxi}`);
        audio.cash();
        fare.inCar = false;
        taxi.dest = null;
        taxi.respawnAt = now + 8;
      }
    } else if (!fare.waiting && !fare.inCar && now > taxi.respawnAt && taxi.respawnAt > 0) {
      fare.waiting = true;
      fare.mesh.visible = true;
      taxi.respawnAt = 0;
    }

    // World systems.
    traffic.update(dt, now, G.player.car);
    peds.update(dt, now, G.player.pos, G.player.car, combat.lastShotAt);
    const busted = police.update(dt, now, G.player, (n) => damage(n));
    if (busted === 'busted' && G.state === 'playing') {
      G.state = 'busted';
      hud.showScreen('busted-screen');
      audio.busted();
    }
    missions.update(dt);
    hud.setObjective(objectiveText());
    hud.setTracker();
    hud.setSpeed(G.player.car ? Math.abs(G.player.car.speed) : 0);
    hud.setHealth(G.health);
    hud.setWanted(police.wanted);
    hud.drawMinimap(dt);

    // Smoke puffs age out.
    for (const p of puffs) {
      if (p.life > 0) {
        p.life -= dt;
        p.s.material.opacity = Math.max(0, p.life * 0.7);
        const sc = p.s.scale.x + dt * 2.2;
        p.s.scale.set(sc, sc, 1);
        if (p.life <= 0) p.s.visible = false;
      }
    }
    audio.engine(!!G.player.car, G.player.car ? Math.abs(G.player.car.speed) / 30 : 0);
    audio.siren(police.wanted > 0);

    // Autosave.
    if (now - saveAt > 20) {
      saveAt = now;
      saveGame({ money: G.money, missionIndex: missions.missionIndex, health: G.health, x: G.player.pos.x, z: G.player.pos.z, shellsTaken: missions.shellsTaken, hasPistol: combat.hasPistol });
    }
  }

  // --- camera --------------------------------------------------------------
  const camTarget = new THREE.Vector3();
  function updateCamera(dt) {
    if (G.shotCamera) {
      camera.position.set(G.shotCamera.pos[0], G.shotCamera.pos[1], G.shotCamera.pos[2]);
      camera.lookAt(G.shotCamera.look[0], G.shotCamera.look[1], G.shotCamera.look[2]);
      return;
    }
    if (G.state === 'menu') {
      const a = G.time * 0.05;
      camera.position.set(Math.sin(a) * 130, 62, Math.cos(a) * 130);
      camera.lookAt(0, 4, 20);
      return;
    }
    const p = G.player.pos;
    const h = G.player.heading;
    const dist = G.player.car ? 11.5 : 7.5;
    const height = G.player.car ? 5.2 : 3.8;
    const want = new THREE.Vector3(p.x - Math.sin(h) * dist, height, p.z - Math.cos(h) * dist);
    camera.position.lerp(want, Math.min(1, dt * 5));
    camTarget.set(p.x + Math.sin(h) * 7, 1.6, p.z + Math.cos(h) * 7);
    camera.lookAt(camTarget);
  }

  // --- wire the menu buttons ----------------------------------------------
  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.addEventListener('click', () => { audio.click(); startGame(true); });
  const contBtn = document.getElementById('continue-btn');
  if (contBtn) {
    if (!loadSave()) contBtn.style.display = 'none';
    contBtn.addEventListener('click', () => { audio.click(); startGame(false); });
  }
  const resumeBtn = document.getElementById('resume-btn');
  if (resumeBtn) resumeBtn.addEventListener('click', () => { G.state = 'playing'; hud.showScreen(null); });
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', () => resetRun());
  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) retryBtn.addEventListener('click', () => resetRun());
  const retryBtn2 = document.getElementById('retry-btn2');
  if (retryBtn2) retryBtn2.addEventListener('click', () => resetRun());
  const againBtn = document.getElementById('win-again');
  if (againBtn) againBtn.addEventListener('click', () => resetRun());
  window.addEventListener('keydown', (e) => {
    if ((e.code === 'Escape' || e.code === 'KeyP') && G.state === 'playing') {
      G.state = 'paused';
      hud.showScreen('pause-menu');
    } else if ((e.code === 'Escape' || e.code === 'KeyP') && G.state === 'paused') {
      G.state = 'playing';
      hud.showScreen(null);
    }
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- main loop -----------------------------------------------------------
  const clock = new THREE.Clock();
  let menuTime = 0;
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.1);
    const now = performance.now() / 1000;
    if (G.state === 'playing') {
      if (G.shotMode) {
        // Staged shot: the scene is alive (traffic rolls by) but the
        // police stay frozen in place and no mission can trigger.
        G.time += dt;
        traffic.update(dt, now, null);
        peds.update(dt, now, G.player.pos, G.player.car, null);
        updateCamera(dt);
      } else {
        update(dt, now);
        updateCamera(dt);
      }
    } else if (G.state === 'menu') {
      menuTime += dt;
      G.time = menuTime;
      traffic.update(dt, now, null);
      peds.update(dt, now, G.player.pos, null, null);
      updateCamera(dt);
    } else {
      // paused / busted / wasted / win: frozen frame.
      updateCamera(dt);
    }
    input.endFrame();
    renderer.render(scene, camera);
  }

  // --- boot -----------------------------------------------------------------
  const shot = stageShot(G);
  // Sync the HUD and the player mesh with whatever the shot staged
  // (money, wanted stars, mission tracker, player position).
  hud.setMoney(G.money);
  hud.setHealth(G.health);
  hud.setWanted(police.wanted);
  hud.setObjective(objectiveText());
  hud.setTracker();
  // Draw the minimap once now: in shot mode the game loop never runs,
  // so without this the minimap canvas stays blank in screenshots.
  hud.drawMinimap(1);
  playerMesh.position.set(G.player.pos.x, 0, G.player.pos.z);
  playerMesh.rotation.y = G.player.heading;
  if (G.player.car) playerMesh.visible = false;
  if (shot === 'menu' || !shot) hud.showScreen('menu');
  else hud.showScreen(null);
  window.__solmarHeat = G;
  loop();
  return G;
}
