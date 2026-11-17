// Solmar Heat — world.js
// One clear job: the Game itself — the state machine (menu / playing /
// paused / busted / wasted / win), the third-person camera, on-foot and
// driving movement, collisions, pickups, the spray shop, and the frame loop
// that wires every system together.
import * as THREE from 'three';
import { CITY, SIDE_JOBS, clamp, distance2D, lerp } from './config.js';
import { buildCity } from './city.js';
import { Car, TrafficSystem } from './vehicles.js';
import { PedestrianSystem } from './pedestrians.js';
import { PoliceSystem } from './police.js';
import { MissionSystem } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { loadGame, saveGame as persistSave } from './save.js';

function makePlayerMesh() {
  const group = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.0, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x1f8a70, roughness: 0.85 }),
  );
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 }),
  );
  head.position.y = 1.95;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.16, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xd23b3b, roughness: 0.8 }),
  );
  cap.position.y = 2.22;
  group.add(cap);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.7, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x2c3e55, roughness: 0.95 }),
  );
  legs.position.y = 0.35;
  group.add(legs);
  return group;
}

function resolveCircle(pos, radius, colliders) {
  colliders.forEach((c) => {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const px = c.hx + radius - Math.abs(dx);
    const pz = c.hz + radius - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) pos.x = c.x + Math.sign(dx || 1) * (c.hx + radius);
      else pos.z = c.z + Math.sign(dz || 1) * (c.hz + radius);
    }
  });
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 900);
    this.cameraYaw = Math.PI;
    this.cameraPitch = 0.32;
    this.state = 'menu';
    this.menuOrbit = true;
    this.money = 0;
    this.score = 0;
    this.timePlayed = 0;
    this.autopilot = null;
    this.saveTimer = 0;

    this.city = buildCity(this.scene);
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.traffic = new TrafficSystem(this.scene);
    this.pedestrians = new PedestrianSystem(this.scene);
    this.police = new PoliceSystem(this.scene);
    this.hud = new HUD(this);
    this.missions = new MissionSystem(this);
    this.combat = new Combat(this.scene, this);

    // The player, on foot to start.
    this.player = {
      mesh: makePlayerMesh(),
      pos: new THREE.Vector3(this.city.markers.playerStart.x, 0, this.city.markers.playerStart.z),
      angle: Math.PI,
      speed: 0,
      car: null,
      walkPhase: 0,
    };
    this.player.mesh.position.copy(this.player.pos);
    this.scene.add(this.player.mesh);

    // Parked cars the player can steal, including the red Comet at the Marina.
    this.parkedCars = [];
    // Parked cars sit on road lines (a road coordinate is a multiple of
    // 40), never inside a block, so the player can always walk up to one.
    const parkedSpots = [
      { x: 80, z: -120, color: 0xd23b3b, angle: 0 },
      { x: -40, z: 60, color: 0x2a6fd6, angle: Math.PI / 2 },
      { x: 40, z: -60, color: 0xf2c230, angle: 0 },
      { x: -40, z: 120, color: 0x37b268, angle: -Math.PI / 2 },
      { x: 140, z: 40, color: 0xe8e8e8, angle: Math.PI },
    ];
    parkedSpots.forEach((spot) => {
      const car = new Car(this.scene, spot.color, spot.x, spot.z, spot.angle);
      car.parked = true;
      this.parkedCars.push(car);
    });
    this.redCar = this.parkedCars[0];

    // Cash pickups scattered around the city ($25 each, respawn).
    this.cashPickups = [];
    const cashSpots = [
      [0, -80], [-80, -40], [80, 40], [-40, 120], [120, -40],
      [-120, 80], [40, -120], [0, 160],
    ];
    const cashGeo = new THREE.OctahedronGeometry(0.7);
    const cashMat = new THREE.MeshStandardMaterial({ color: 0x37d67a, emissive: 0x1d8a4a, emissiveIntensity: 0.9 });
    cashSpots.forEach(([x, z]) => {
      const mesh = new THREE.Mesh(cashGeo, cashMat);
      mesh.position.set(x, 1.2, z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.cashPickups.push({ mesh, x, z, taken: false, respawn: 0 });
    });

    // The gold mission beacon: a tall translucent pillar at the objective.
    const beaconGeo = new THREE.CylinderGeometry(2.2, 2.2, 34, 12, 1, true);
    this.beacon = new THREE.Mesh(
      beaconGeo,
      new THREE.MeshBasicMaterial({ color: 0xffd23b, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
    );
    this.beacon.position.set(0, 17, 0);
    this.scene.add(this.beacon);
    const ringGeo = new THREE.TorusGeometry(5, 0.35, 8, 32);
    this.beaconRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23b }));
    this.beaconRing.rotation.x = Math.PI / 2;
    this.scene.add(this.beaconRing);

    this.hud.setMoney(0);
    this.hud.setHealth(100);
    this.hud.setWanted(0);
    this.hud.showMenu(true);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  addMoney(amount) {
    this.money += amount;
    this.score = Math.floor(this.money) + this.missions.done.filter(Boolean).length * 100;
    this.hud.setMoney(this.money);
  }

  // --- State changes -------------------------------------------------
  startNewGame(silent = false) {
    this.money = 0;
    this.score = 0;
    this.timePlayed = 0;
    this.combat.health = 100;
    this.combat.armed = false;
    this.combat.ammo = 0;
    this.police.clearWanted();
    this.missions.done = [false, false, false];
    this.missions.index = 0;
    this.missions.taxi = null;
    this.missions.timer = 0;
    this.player.pos.set(this.city.markers.playerStart.x, 0, this.city.markers.playerStart.z);
    this.player.angle = Math.PI;
    this.player.car = null;
    this.player.mesh.visible = true;
    this.cameraYaw = Math.PI;
    this.state = 'playing';
    this.hud.showMenu(false);
    this.hud.hideEnd();
    this.hud.showPause(false);
    this.hud.setMoney(0);
    this.hud.setHealth(100);
    this.hud.setWanted(0);
    this.hud.setTimer(0);
    this.missions.start();
    this.audio.ensure();
    if (!silent) this.hud.toast('Story started — steal a car and reach the Marina Garage.');
    this.saveGame();
  }

  continueGame() {
    const data = loadGame();
    if (!data) {
      this.startNewGame();
      return;
    }
    this.applySave(data);
    this.state = 'playing';
    this.hud.showMenu(false);
    this.hud.hideEnd();
    this.hud.toast('Save loaded — welcome back to Solmar Bay.');
  }

  applySave(data) {
    this.money = data.money || 0;
    this.missions.done = data.missionsDone || [false, false, false];
    this.missions.index = data.missionIndex || 0;
    this.combat.health = data.health || 100;
    this.combat.armed = !!data.armed;
    this.combat.ammo = data.ammo || 0;
    this.player.pos.set(data.playerX || 80, 0, data.playerZ || -120);
    this.player.angle = data.playerAngle || Math.PI;
    this.player.car = null;
    this.player.mesh.visible = true;
    this.hud.setMoney(this.money);
    this.hud.setHealth(this.combat.health);
    this.missions.active = true;
    this.missions.setObjective();
  }

  restartFromSave() {
    const data = loadGame();
    if (data) this.applySave(data);
    else this.startNewGame(true);
    this.state = 'playing';
    this.hud.showPause(false);
    this.hud.hideEnd();
  }

  quitToMenu() {
    this.state = 'menu';
    this.menuOrbit = true;
    this.hud.showPause(false);
    this.hud.hideEnd();
    this.hud.showMenu(true);
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showPause(true);
  }

  resumeGame() {
    if (this.state === 'playing') return;
    this.state = 'playing';
    this.hud.showPause(false);
    this.hud.hideEnd();
    this.hud.showMenu(false);
    this.audio.ensure();
  }

  saveGame() {
    if (persistSave(this)) this.hud.setMoney(this.money);
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.money = Math.max(0, this.money - SIDE_JOBS.wastedFine);
    this.hud.setMoney(this.money);
    this.hud.showEnd('WASTED', `Dana went down in Solmar Bay. The hospital took $${SIDE_JOBS.wastedFine} off you. Your missions are saved — get back out there.`);
    this.respawn();
  }

  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.money = Math.max(0, this.money - SIDE_JOBS.bustedFine);
    this.police.clearWanted();
    this.hud.setMoney(this.money);
    this.hud.setWanted(0);
    this.hud.showEnd('BUSTED', `The Solmar Bay police caught Dana. Bail cost $${SIDE_JOBS.bustedFine}. Your missions are saved — get back out there.`);
    this.respawn();
  }

  respawn() {
    this.combat.health = 100;
    this.hud.setHealth(100);
    this.player.car = null;
    this.player.mesh.visible = true;
    this.player.pos.set(this.city.markers.playerStart.x, 0, this.city.markers.playerStart.z);
    this.player.angle = Math.PI;
    this.saveGame();
  }

  winGame() {
    this.state = 'win';
    this.hud.showEnd(
      'SOLMAR LEGEND',
      `All three missions done. Dana paid the Marlin Club and owns the night — $${Math.floor(this.money)} earned, score ${this.score}. Free roam continues.`,
    );
    this.saveGame();
  }

  // --- Cars ----------------------------------------------------------
  enterCar(car) {
    if (this.player.car) return;
    if (car.driver === 'traffic') {
      this.police.addWanted(1, 'stolen car');
      this.hud.toast('CAR STOLEN — the cops noticed. ★');
      this.audio.blip(220, 0.15, 'square', 0.2);
      car.driver = 'player';
      const idx = this.traffic.cars.indexOf(car);
      if (idx >= 0) this.traffic.cars.splice(idx, 1);
    } else if (car.parked) {
      car.parked = false;
      car.driver = 'player';
      const idx = this.parkedCars.indexOf(car);
      if (idx >= 0) this.parkedCars.splice(idx, 1);
    } else if (car.driver === 'police') {
      return;
    }
    this.player.car = car;
    this.player.mesh.visible = false;
    this.player.pos.copy(car.pos);
    this.hud.toast('You are driving. Space = handbrake, E = get out.');
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.speed = 0;
    this.player.car = null;
    this.player.mesh.visible = true;
    this.player.pos.set(car.pos.x + 3, 0, car.pos.z);
    this.player.angle = car.angle;
    this.player.mesh.position.copy(this.player.pos);
  }

  nearestCar(maxDist) {
    const p = this.player.pos;
    let best = null;
    let bestD = maxDist;
    [...this.parkedCars, ...this.traffic.cars].forEach((car) => {
      const d = distance2D(p.x, p.z, car.pos.x, car.pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    });
    return best;
  }

  hitNearby(dist, damage) {
    // Punch: knock down the nearest pedestrian in front of the player.
    const p = this.player.pos;
    const fx = Math.sin(this.player.angle);
    const fz = Math.cos(this.player.angle);
    this.pedestrians.peds.forEach((ped) => {
      if (ped.down) return;
      const dx = ped.x - p.x;
      const dz = ped.z - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < dist && dx * fx + dz * fz > 0) {
        ped.down = true;
        ped.downTimer = 6;
        this.police.addWanted(1, 'assault');
        this.hud.toast('You knocked someone down — the cops noticed. ★');
      }
    });
  }

  shootHit(start, dir) {
    // Hits the nearest traffic or police car roughly along the shot line.
    let best = null;
    let bestD = 60;
    const targets = [...this.traffic.cars, ...this.police.policeCars];
    targets.forEach((car) => {
      const dx = car.pos.x - start.x;
      const dz = car.pos.z - start.z;
      const along = dx * dir.x + dz * dir.z;
      if (along < 2 || along > bestD) return;
      const perp = Math.abs(dx * dir.z - dz * dir.x);
      if (perp < 3) {
        best = car;
        bestD = along;
      }
    });
    if (best) {
      if (best.isPolice) {
        best.speed = 0;
        this.police.addWanted(1, 'shooting at police');
        this.hud.toast('You shot a police car! ★★');
      } else {
        best.speed = 0;
        this.hud.toast('You shot out a car.');
      }
    }
    this.police.addWanted(0, 'shot fired');
  }

  // --- Frame loop ----------------------------------------------------
  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.lastTime) / 1000 || 0.016);
    this.lastTime = now;
    if (this.state === 'menu') {
      const t = now * 0.00008;
      this.camera.position.set(Math.sin(t) * 150, 70, Math.cos(t) * 150);
      this.camera.lookAt(0, 0, 0);
      this.city.water.position.y = 0.02 + Math.sin(now * 0.0006) * 0.05;
      this.renderer.render(this.scene, this.camera);
      this.input.consumeFrame();
      return;
    }
    if (this.state !== 'playing') {
      this.renderer.render(this.scene, this.camera);
      this.input.consumeFrame();
      return;
    }
    this.timePlayed += dt;
    this.update(dt, now);
    this.renderer.render(this.scene, this.camera);
    this.input.consumeFrame();
  }

  update(dt, now) {
    const input = this.input;
    this.audio.ensure();
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      this.pauseGame();
      return;
    }
    if (input.wasPressed('KeyR')) {
      this.restartFromSave();
      return;
    }
    if (input.wasPressed('KeyM')) {
      const on = this.audio.toggleMusic();
      this.hud.toast(on ? 'Music on' : 'Music off');
    }

    // Camera orbit from mouse drag.
    this.cameraYaw -= input.mouseDX * 0.004;
    this.cameraPitch = clamp(this.cameraPitch + input.mouseDY * 0.003, 0.08, 0.9);

    // Autopilot (screenshot staging): follow road waypoints toward a target.
    // Waypoints sit on road lines so the car never has to cut through a
    // building; the driver slows for sharp turns to stay on the road.
    let autopilotInput = null;
    let autopilotAngle = null;
    if (this.autopilot && now < this.autopilot.until) {
      const wp = this.autopilot.waypoints;
      while (wp.length > 0 && distance2D(this.player.pos.x, this.player.pos.z, wp[0].x, wp[0].z) < 7) {
        wp.shift();
      }
      if (wp.length === 0) {
        this.autopilot = null;
      } else {
        const target = wp[0];
        const dx = target.x - this.player.pos.x;
        const dz = target.z - this.player.pos.z;
        const wantAngle = Math.atan2(dx, dz);
        let diff = wantAngle - this.player.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        autopilotAngle = { wantAngle, diff };
        const throttle = Math.abs(diff) > 0.7 ? 0.35 : 1;
        // A positive angle difference needs a left turn, which is negative
        // steering input in this convention.
        autopilotInput = { moveY: () => throttle, moveX: () => clamp(-diff * 2, -1, 1), isDown: () => false };
        this.cameraYaw = lerp(this.cameraYaw, this.player.angle + Math.PI, 0.1);
      }
    } else if (this.autopilot) {
      this.autopilot = null;
    }
    const driveInput = autopilotInput || input;

    // Enter / exit cars.
    if (input.wasPressed('KeyE')) {
      if (this.player.car) this.exitCar();
      else {
        const car = this.nearestCar(4.5);
        if (car) this.enterCar(car);
      }
    }
    // Taxi side job.
    if (input.wasPressed('KeyT')) this.missions.tryTaxi();

    // --- Movement ----------------------------------------------------
    const playerSpeed = this.player.car ? Math.abs(this.player.car.speed) : 0;
    if (this.player.car) {
      const car = this.player.car;
      car.drive(driveInput, dt);
      // The screenshot autopilot keeps a modest speed so turns stay clean.
      if (autopilotInput) car.speed = clamp(car.speed, -8, 20);
      resolveCircle(car.pos, 1.6, this.city.colliders);
      this.player.pos.copy(car.pos);
      this.player.angle = car.angle;
      // Bump into traffic cars.
      [...this.traffic.cars, ...this.police.policeCars].forEach((other) => {
        if (other === car) return;
        const d = distance2D(car.pos.x, car.pos.z, other.pos.x, other.pos.z);
        if (d < 3.4 && d > 0.01) {
          const push = (3.4 - d) / 2;
          const nx = (car.pos.x - other.pos.x) / d;
          const nz = (car.pos.z - other.pos.z) / d;
          car.pos.x += nx * push;
          car.pos.z += nz * push;
          car.speed *= 0.6;
          if (other.isPolice) {
            other.speed *= 0.5;
          } else {
            other.speed *= 0.5;
            if (Math.abs(car.speed) > 8 && car.hitCooldown <= 0) {
              car.hitCooldown = 1;
              this.audio.crash();
              this.combat.takeDamage(4);
            }
          }
        }
      });
      this.audio.setEngine(car.speed, driveInput.moveY() !== 0);
      this.hud.setSpeed(car.speed, true);
    } else {
      const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      const speed = sprint ? 10 : 6;
      // The screenshot autopilot walks straight toward its waypoint instead
      // of using camera-relative controls, so it never walks into the sea.
      let vx = 0;
      let vz = 0;
      if (autopilotAngle) {
        this.player.angle += clamp(autopilotAngle.diff, -3 * dt, 3 * dt);
        vx = Math.sin(this.player.angle) * speed;
        vz = Math.cos(this.player.angle) * speed;
        this.player.walkPhase += dt * 9;
      } else {
        const mx = input.moveX();
        const my = input.moveY();
        // Movement is relative to the camera yaw.
        const forwardX = Math.sin(this.cameraYaw + Math.PI);
        const forwardZ = Math.cos(this.cameraYaw + Math.PI);
        const rightX = Math.sin(this.cameraYaw + Math.PI - Math.PI / 2);
        const rightZ = Math.cos(this.cameraYaw + Math.PI - Math.PI / 2);
        vx = forwardX * my + rightX * mx;
        vz = forwardZ * my + rightZ * mx;
        const len = Math.sqrt(vx * vx + vz * vz);
        if (len > 0) {
          vx = (vx / len) * speed;
          vz = (vz / len) * speed;
          this.player.angle = Math.atan2(vx, vz);
          this.player.walkPhase += dt * (sprint ? 13 : 9);
        }
      }
      this.player.pos.x += vx * dt;
      this.player.pos.z += vz * dt;
      this.player.pos.x = clamp(this.player.pos.x, -185, 185);
      this.player.pos.z = clamp(this.player.pos.z, -185, 200);
      resolveCircle(this.player.pos, 0.8, this.city.colliders);
      this.player.mesh.position.copy(this.player.pos);
      this.player.mesh.position.y = Math.abs(Math.sin(this.player.walkPhase)) * 0.08;
      this.player.mesh.rotation.y = this.player.angle;
      this.audio.setEngine(0, false);
      this.hud.setSpeed(0, false);
    }

    // Spray Shop: drive in with wanted stars and $75 to go clean.
    const spray = this.city.markers.spray;
    if (this.player.car && this.police.wanted > 0 && distance2D(this.player.pos.x, this.player.pos.z, spray.x, spray.z) < 9) {
      if (this.money >= SIDE_JOBS.sprayCost) {
        this.money -= SIDE_JOBS.sprayCost;
        this.police.clearWanted();
        this.hud.setMoney(this.money);
        this.hud.setWanted(0);
        this.hud.toast('Spray Shop: new paint, clean record. -$75');
        this.audio.coin();
        this.player.car.mesh.children[0].material = new THREE.MeshStandardMaterial({
          color: [0xd23b3b, 0x2a6fd6, 0xf2c230, 0x37b268][Math.floor(Math.random() * 4)],
          roughness: 0.35,
          metalness: 0.5,
        });
      } else {
        this.hud.toast('Spray Shop needs $75 — you are short.');
      }
    }

    // Cash pickups.
    this.cashPickups.forEach((pk) => {
      if (pk.taken) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) {
          pk.taken = false;
          pk.mesh.visible = true;
        }
        return;
      }
      pk.mesh.rotation.y += dt * 2;
      pk.mesh.position.y = 1.2 + Math.sin(now * 0.003 + pk.x) * 0.25;
      if (distance2D(this.player.pos.x, this.player.pos.z, pk.x, pk.z) < 2.6) {
        pk.taken = true;
        pk.respawn = 60;
        pk.mesh.visible = false;
        this.addMoney(SIDE_JOBS.cashPickup);
        this.audio.coin();
        this.hud.toast(`Cash pickup +$${SIDE_JOBS.cashPickup}`);
      }
    });

    // Systems.
    this.traffic.update(dt, this.player.car, this.police.policeCars);
    this.pedestrians.update(dt, this.player.pos, playerSpeed, (reason) => {
      this.police.addWanted(1, reason);
      this.hud.toast('You hit a pedestrian! ★');
      this.audio.crash();
    });
    const nearestPolice = this.police.update(
      dt,
      this.player,
      this.player.car,
      () => this.busted(),
      () => {
        this.combat.takeDamage(6);
        this.audio.crash();
      },
    );
    // Police cars must not clip through buildings either.
    this.police.policeCars.forEach((car) => resolveCircle(car.pos, 1.6, this.city.colliders));
    this.missions.update(dt);
    this.missions.updateTaxi(dt);
    this.combat.update(dt, input, this.player.pos, this.player.angle, this.camera);
    this.combat.heal(dt * 0.8);

    // Mission beacon follows the current objective marker.
    if (this.hud.marker) {
      this.beacon.visible = true;
      this.beaconRing.visible = true;
      this.beacon.position.set(this.hud.marker.x, 17, this.hud.marker.z);
      this.beaconRing.position.set(this.hud.marker.x, 0.3, this.hud.marker.z);
      this.beaconRing.scale.setScalar(1 + Math.sin(now * 0.004) * 0.15);
    } else {
      this.beacon.visible = false;
      this.beaconRing.visible = false;
    }

    // Camera: third-person chase behind the player.
    const camDist = this.player.car ? 13 : 9;
    const camHeight = this.player.car ? 5.5 : 3.8;
    const backX = Math.sin(this.cameraYaw);
    const backZ = Math.cos(this.cameraYaw);
    const targetPos = new THREE.Vector3(
      this.player.pos.x + backX * camDist,
      camHeight,
      this.player.pos.z + backZ * camDist,
    );
    this.camera.position.lerp(targetPos, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(this.player.pos.x, this.player.car ? 1.6 : 1.4, this.player.pos.z);

    // HUD + audio.
    this.hud.setHealth(this.combat.health);
    this.hud.setWanted(this.police.wanted);
    this.hud.drawMinimap(this);
    this.audio.setSiren(this.police.wanted > 0, nearestPolice);
    this.city.water.position.y = 0.02 + Math.sin(now * 0.0006) * 0.05;
    this.city.lighthouseTop.rotation.y += dt * 0.8;

    // Autosave every 30 seconds.
    this.saveTimer += dt;
    if (this.saveTimer > 30) {
      this.saveTimer = 0;
      this.saveGame();
    }
  }
}
