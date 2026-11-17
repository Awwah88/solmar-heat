// Solmar Heat — the game itself.
// Owns the renderer, the state machine (menu / playing / paused / win /
// busted / wasted), the player on foot and in a car, the camera, the
// autopilot, cash pickups, shells and the Spray Shop. Every subsystem is
// built here and reached through this one object, which main.js exposes
// as window.__solmarHeat for the playtest and the screenshots.

import * as THREE from 'three';
import { CITY, ECONOMY, PLAYER_SPAWN, CASH_PICKUPS, SHELLS, TUNING, clamp, dist2d, forwardOf, wrapAngle } from './config.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { SaveSystem } from './save.js';
import { City } from './city.js';
import { VehicleSystem } from './vehicles.js';
import { PedestrianSystem } from './pedestrians.js';
import { PoliceSystem } from './police.js';
import { CombatSystem } from './combat.js';
import { MissionSystem } from './missions.js';
import { Hud } from './hud.js';
import { applyShot, readShotParams } from './shots.js';

function buildPlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xf2c14e });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.8, 0.36), jeans);
  legs.position.y = 0.4;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.72, 0.38), jacket);
  torso.position.y = 1.16;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
  head.position.y = 1.74;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0xd21f2b }));
  cap.position.y = 1.95;
  group.add(cap);
  return group;
}

export class Game {
  constructor(seed = 0) {
    this.seed = seed;
    this.state = 'menu';
    this.money = ECONOMY.startMoney;
    this.elapsed = 0;
    this.autopilot = null;
    this.shotMode = null;
    this.cameraHeading = Math.PI;
    this.menuAngle = 0;
    this.hudTimer = 0;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 80, 190);

    this.input = new Input();
    this.input.attach();
    this.audio = new AudioEngine();
    this.city = new City(this.scene, seed).build();
    this.vehicles = new VehicleSystem(this).build();
    this.pedestrians = new PedestrianSystem(this).build();
    this.police = new PoliceSystem(this);
    this.combat = new CombatSystem(this);
    this.save = new SaveSystem(this);
    this.hud = new Hud(this);
    this.missions = new MissionSystem(this).build();

    this.player = {
      pos: new THREE.Vector3(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z),
      heading: PLAYER_SPAWN.heading,
      car: null,
      walkSpeedNow: 0,
    };
    this.playerMesh = buildPlayerMesh();
    this.playerMesh.position.copy(this.player.pos);
    this.scene.add(this.playerMesh);

    this.redCar = this.vehicles.redCar;
    this.traffic = this.vehicles.traffic;
    this.pickups = [];
    this._buildPickups();

    window.addEventListener('resize', () => this._resize());
    this.hud.showScreen('menu');
    this.hud.refresh();

    const { shot } = readShotParams();
    if (shot) applyShot(this, shot);
  }

  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _buildPickups() {
    const cashGeo = new THREE.BoxGeometry(1.1, 0.5, 0.7);
    const cashMat = new THREE.MeshLambertMaterial({ color: 0x2ecc71, emissive: 0x1a7a3a });
    const shellGeo = new THREE.SphereGeometry(0.55, 8, 6);
    const shellMat = new THREE.MeshLambertMaterial({ color: 0xff9f43, emissive: 0x7a4a00 });
    for (const [x, z] of CASH_PICKUPS) {
      const mesh = new THREE.Mesh(cashGeo, cashMat);
      mesh.position.set(x, 0.6, z);
      this.scene.add(mesh);
      this.pickups.push({ x, z, value: ECONOMY.pickupValue, kind: 'cash', mesh, taken: false, respawnAt: 0 });
    }
    for (const [x, z] of SHELLS) {
      const mesh = new THREE.Mesh(shellGeo, shellMat);
      mesh.position.set(x, 0.55, z);
      this.scene.add(mesh);
      this.pickups.push({ x, z, value: ECONOMY.shellValue, kind: 'shell', mesh, taken: false, respawnAt: 0 });
    }
  }

  // ---- state changes -------------------------------------------------

  _resetRun() {
    this.money = ECONOMY.startMoney;
    this.elapsed = 0;
    this.autopilot = null;
    this.combat.health = 100;
    this.combat.hasPistol = false;
    this.missions.index = 0;
    this.missions.done = [false, false, false];
    this.missions.packageIndex = 0;
    this.missions.timer = TUNING.mission2Seconds;
    this.missions.taxiJobs = 0;
    this.missions.taxiState = 'idle';
    this.missions.taxiMarker.visible = false;
    this.police.setWanted(0);
    this.police.clearAll();
    if (this.player.car) this.exitCar(true);
    this.player.pos.set(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z);
    this.player.heading = PLAYER_SPAWN.heading;
    this.playerMesh.visible = true;
    this.playerMesh.position.copy(this.player.pos);
    this.redCar.pos.set(83, 0, -120);
    this.redCar.setHeading(Math.PI / 2);
    this.redCar.stop();
    for (const p of this.pickups) {
      p.taken = false;
      p.mesh.visible = true;
    }
    this.save.clear();
    this.missions.refreshObjective();
    this.hud.refresh();
  }

  startStory() {
    this.audio.unlock();
    this.audio.startMusic();
    this._resetRun();
    this.state = 'playing';
    this.hud.hideScreens();
    this.hud.toast('Mission 1 — Hot Wheels: steal a car, reach the Marina Garage.');
  }

  continueStory() {
    const data = this.save.load();
    if (!data) {
      this.startStory();
      return;
    }
    this.audio.unlock();
    this.audio.startMusic();
    this._resetRun();
    this.save.apply(data);
    this.state = 'playing';
    this.hud.hideScreens();
    this.hud.toast('Welcome back to Solmar Bay.');
  }

  resumeFromPause() {
    this.state = 'playing';
    this.hud.hideScreens();
  }

  freeRoam() {
    this.state = 'playing';
    this.hud.hideScreens();
    this.hud.toast('Free roam — Solmar Bay is yours.');
  }

  win() {
    this.state = 'win';
    this.audio.missionDone();
    this.save.save();
    this.hud.showWin(this.money);
  }

  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.audio.busted();
    this.police.clearAll();
    this.hud.showScreen('busted');
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.audio.busted();
    this.police.clearAll();
    this.hud.showScreen('wasted');
  }

  resumeGame() {
    this.combat.health = 100;
    this.police.setWanted(0);
    this.police.clearAll();
    this.state = 'playing';
    this.hud.hideScreens();
    this.hud.refresh();
  }

  // ---- cars ----------------------------------------------------------

  enterCar(car) {
    if (!car || this.player.car) return;
    this.player.car = car;
    this.playerMesh.visible = false;
    this.player.pos.copy(car.pos);
    this.player.heading = car.heading;
    this.audio.carDoor();
    // Taking a car that is not yours is a crime.
    if (car.kind === 'parked' || car.kind === 'taxi') {
      this.police.addWanted(1);
      this.hud.toast(`You stole the ${car.name}. The police noticed.`);
    }
    this.hud.refresh();
  }

  exitCar(silent = false) {
    const car = this.player.car;
    if (!car) return;
    car.stop();
    const f = forwardOf(car.heading);
    this.player.pos.set(car.pos.x - f.z * 3, 0, car.pos.z + f.x * 3);
    this.city.collideCircle(this.player.pos, 0.9);
    this.player.heading = car.heading;
    this.player.car = null;
    this.playerMesh.visible = true;
    this.playerMesh.position.copy(this.player.pos);
    if (!silent) this.audio.carDoor();
    this.hud.refresh();
  }

  // ---- per-frame update ----------------------------------------------

  update(dt) {
    const g = this;
    // Global keys work in every state.
    if (this.input.hit('m')) this.audio.toggleMute();
    if (this.input.hit('Escape') || this.input.hit('Escape', 'p')) {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.hud.showScreen('pause');
      } else if (this.state === 'paused') {
        this.resumeFromPause();
      }
    }
    if (this.state === 'menu') {
      this.menuAngle += dt * 0.03;
      this.camera.position.set(Math.sin(this.menuAngle) * 195, 74, Math.cos(this.menuAngle) * 195);
      this.camera.lookAt(0, 6, 20);
      this.input.endFrame();
      return;
    }
    if (this.state !== 'playing') {
      this.input.endFrame();
      return;
    }
    this.elapsed += dt;
    // Enter / exit / attack.
    if (this.input.hit('e')) {
      if (this.player.car) this.exitCar();
      else {
        const car = this.vehicles.nearestCar(this.player.pos, 4.5);
        if (car) this.enterCar(car);
      }
    }
    if (this.input.hit('f')) {
      if (this.combat.hasPistol) this.combat.shoot();
      else this.combat.punch();
    }
    // Autopilot (the playtest drives through this) or the player's keys.
    if (this.autopilot && performance.now() < this.autopilot.until) {
      this._runAutopilot(dt);
    } else {
      this.autopilot = null;
      if (this.player.car) this._drivePlayer(dt);
      else this._walkPlayer(dt);
    }
    this.vehicles.update(dt);
    this.pedestrians.update(dt);
    this.police.update(dt);
    this.combat.update(dt);
    this.missions.update(dt);
    this._updatePickups(dt);
    this._checkSprayShop();
    this.save.update(performance.now());
    this._updateCamera(dt);
    this.audio.setEngine(this.player.car ? this.player.car.speed : 0, TUNING.carMaxSpeed);
    this.hudTimer += dt;
    if (this.hudTimer > 0.25) {
      this.hudTimer = 0;
      this.hud.refresh();
    }
    this.hud.update(dt);
    this.input.endFrame();
  }

  _drivePlayer(dt) {
    const car = this.player.car;
    const { throttle, steer } = this.input.driveAxes();
    let t = throttle;
    if (this.input.down(' ')) t = car.speed > 0.5 ? -1 : t;
    car.drive(t, steer, dt);
    this.player.pos.copy(car.pos);
    this.player.heading = car.heading;
  }

  _walkPlayer(dt) {
    const axes = this.input.walkAxes(this.cameraHeading);
    const len = Math.hypot(axes.x, axes.z);
    if (len > 0.01) {
      const running = this.input.down('Shift');
      const speed = running ? TUNING.runSpeed : TUNING.walkSpeed;
      const nx = axes.x / len;
      const nz = axes.z / len;
      this.player.heading = Math.atan2(nx, nz);
      this.player.pos.x += nx * speed * dt;
      this.player.pos.z += nz * speed * dt;
      this.player.walkSpeedNow = speed;
    } else {
      this.player.walkSpeedNow = 0;
    }
    this.city.collideCircle(this.player.pos, 0.9);
    this.playerMesh.position.copy(this.player.pos);
    this.playerMesh.rotation.y = this.player.heading;
  }

  _runAutopilot(dt) {
    const ap = this.autopilot;
    if (!ap || ap.waypoints.length === 0) {
      this.autopilot = null;
      return;
    }
    const target = ap.waypoints[0];
    if (ap.onFoot) {
      const dx = target.x - this.player.pos.x;
      const dz = target.z - this.player.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 3) {
        ap.waypoints.shift();
        return;
      }
      const speed = TUNING.walkSpeed;
      this.player.heading = Math.atan2(dx / d, dz / d);
      this.player.pos.x += (dx / d) * speed * dt;
      this.player.pos.z += (dz / d) * speed * dt;
      this.player.walkSpeedNow = speed;
      this.city.collideCircle(this.player.pos, 0.9);
      this.playerMesh.position.copy(this.player.pos);
      this.playerMesh.rotation.y = this.player.heading;
      return;
    }
    if (!this.player.car) {
      this.autopilot = null;
      return;
    }
    const d = this.vehicles.autopilotDrive(this.player.car, target, dt);
    this.player.pos.copy(this.player.car.pos);
    this.player.heading = this.player.car.heading;
    if (d < 6) ap.waypoints.shift();
  }

  _updatePickups(dt) {
    const p = this.player.pos;
    for (const pk of this.pickups) {
      if (pk.taken) {
        if (this.elapsed > pk.respawnAt) {
          pk.taken = false;
          pk.mesh.visible = true;
        }
        continue;
      }
      pk.mesh.position.y = 0.6 + Math.sin(this.elapsed * 2.4 + pk.x) * 0.14;
      pk.mesh.rotation.y += dt * 1.4;
      if (dist2d(p.x, p.z, pk.x, pk.z) < TUNING.pickupRadius) {
        pk.taken = true;
        pk.mesh.visible = false;
        pk.respawnAt = this.elapsed + 120;
        this.money += pk.value;
        this.audio.pickup();
        this.hud.toast(pk.kind === 'shell' ? `Golden shell — +$${pk.value}` : `Cash pickup — +$${pk.value}`);
        this.hud.refresh();
      }
    }
  }

  _checkSprayShop() {
    if (this.police.wanted === 0) return;
    if (this.money < ECONOMY.sprayCost) return;
    if (dist2d(this.player.pos.x, this.player.pos.z, -140, 42) < TUNING.markerRadius) {
      this.money -= ECONOMY.sprayCost;
      this.police.setWanted(0);
      this.audio.cashRegister();
      this.hud.toast(`Spray Shop — new paint, clean record. -$${ECONOMY.sprayCost}`);
      this.hud.refresh();
    }
  }

  _updateCamera(dt) {
    const f = forwardOf(this.player.heading);
    const target = new THREE.Vector3(
      this.player.pos.x - f.x * 11,
      6.4,
      this.player.pos.z - f.z * 11,
    );
    const look = new THREE.Vector3(
      this.player.pos.x + f.x * 7,
      1.8,
      this.player.pos.z + f.z * 7,
    );
    const k = 1 - Math.pow(0.001, dt);
    this.camera.position.lerp(target, k);
    this.camera.lookAt(look);
    this.cameraHeading = Math.atan2(this.player.pos.x - this.camera.position.x, this.player.pos.z - this.camera.position.z);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
