// Solmar Heat — world.js
// The game itself: state machine, the player on foot and in a car,
// the camera, pickups and shells, the Spray Shop, stunt ramps, the
// day/night clock, the autopilot the tests drive with, and the public
// window.__solmarHeat handle the tests read.

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, LANDMARKS, CASH_PICKUPS, SHELLS, RAMPS, distance2D, angleDiff, clamp } from './config.js';
import { City } from './city.js';
import { Traffic } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { SaveManager } from './save.js';

export class World {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.state = 'menu'; // menu | playing | paused | win | busted | wasted
    this.money = CONFIG.START_MONEY;
    this.score = 0;
    this.city = new City(scene);
    this.traffic = new Traffic(scene, this.city);
    this.pedestrians = new Pedestrians(scene);
    this.police = new Police(scene, this.city, this);
    this.missions = new Missions(this);
    this.combat = new Combat(this);
    this.hud = new HUD(this);
    this.input = new Input();
    this.audio = new AudioEngine();
    this.save = new SaveManager();
    this.autopilot = null;
    this.dayTime = CONFIG.DAY_START;
    this.isNight = false;
    this.shellsCollected = 0;
    this.shellsTaken = new Array(SHELLS.length).fill(false);
    this.cashTaken = new Array(CASH_PICKUPS.length).fill(false);
    this.taxiFares = 0;
    this.stuntCooldown = 0;
    this.elapsed = 0;
    this.cameraYaw = 0;
    this.cameraPitch = 0.42;
    this.cameraDist = 13;
    this.markerMesh = null;
    this.pickupMeshes = [];
    this.shellMeshes = [];
    this.player = null;
    this.redCar = null;
    this._tracer = null;
    this._tracerTimer = 0;
    this._respawnPoint = { x: -140, z: 118 };
  }

  // --- Setup -------------------------------------------------------------------

  init() {
    this.city.build();
    this.traffic.spawn();
    this.pedestrians.spawn();
    this.redCar = this.traffic.redCar;
    this._buildPlayer();
    this._buildMarker();
    this._buildPickups();
    this._buildShells();
    this.hud.build();
    this.input.attach();
    this.hud.showMenu('title');
    this._expose();
  }

  _buildPlayer() {
    const group = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0xd23b2e });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2c3a4a });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.45), jacket);
    body.position.y = 1.1;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), skin);
    head.position.y = 1.95;
    head.castShadow = true;
    group.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.6, 0.4), pants);
    legs.position.y = 0.3;
    group.add(legs);
    // A cap, so Dash reads at a distance.
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 10), new THREE.MeshLambertMaterial({ color: 0xe8c832 }));
    cap.position.y = 2.2;
    group.add(cap);
    group.position.set(CONFIG.PLAYER_START.x, 0, CONFIG.PLAYER_START.z);
    this.scene.add(group);
    this.player = {
      mesh: group,
      pos: group.position,
      heading: 0,
      speed: 0,
      car: null,
      walkPhase: 0,
    };
  }

  _buildMarker() {
    // The mission beacon: a tall glowing column plus a floating diamond,
    // so the objective is visible from across the city.
    const group = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
    );
    beam.position.y = 30;
    group.add(beam);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6),
      new THREE.MeshBasicMaterial({ color: 0xffd94a }),
    );
    diamond.position.y = 7;
    group.add(diamond);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.35, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd94a }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    group.add(ring);
    this.scene.add(group);
    this.markerMesh = group;
    this.markerMesh.visible = false;
  }

  _buildPickups() {
    for (let i = 0; i < CASH_PICKUPS.length; i++) {
      const p = CASH_PICKUPS[i];
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.5, 1.0),
        new THREE.MeshLambertMaterial({ color: 0x2e8a4a, emissive: 0x1a5a2e }),
      );
      mesh.position.set(p.x, 0.6, p.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.pickupMeshes.push(mesh);
    }
  }

  _buildShells() {
    for (let i = 0; i < SHELLS.length; i++) {
      const s = SHELLS[i];
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xffd94a, emissive: 0xcc9900 }),
      );
      mesh.scale.y = 0.55;
      mesh.position.set(s.x, 0.5, s.z);
      this.scene.add(mesh);
      this.shellMeshes.push(mesh);
    }
  }

  _expose() {
    window.__solmarHeat = this;
  }

  // --- State changes -----------------------------------------------------------

  startStory() {
    this.audio.ensure();
    this.audio.click();
    this.money = CONFIG.START_MONEY;
    this.score = 0;
    this.combat.health = CONFIG.START_HEALTH;
    this.combat.hasPistol = false;
    this.combat.ammo = 0;
    this.police.clearWanted();
    // A fresh story starts with no grace period: stealing the first car
    // must raise the heat at once, even seconds after pressing Start.
    this.police.cooldownTimer = 0;
    this.missions.start();
    this._resetPlayerToStart();
    this.state = 'playing';
    this.hud.hideMenu();
    this.hud.toast('Mission 1: Hot Wheels — steal a car');
    this.save.write(this);
  }

  startFreeRoam() {
    this.audio.ensure();
    this.audio.click();
    this.missions.index = 3;
    this.missions.done = [true, true, true];
    this.missions.refreshObjective();
    this.state = 'playing';
    this.hud.hideMenu();
    this.hud.toast('Free roam — the city is yours. Try the taxi, the shells, the ramps.');
  }

  continueSave() {
    this.audio.ensure();
    const data = this.save.read();
    if (data) this.save.apply(this, data);
    this.state = 'playing';
    this.hud.hideMenu();
    this.hud.toast('Welcome back, Dash.');
  }

  toMenu() {
    this.state = 'menu';
    this.hud.showMenu('title');
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showMenu('pause');
  }

  resumeGame() {
    if (this.state === 'playing') return;
    // Waking up after a bust or a waste: fresh legs, clean slate.
    if (this.state === 'busted' || this.state === 'wasted') {
      this.combat.health = CONFIG.START_HEALTH;
      this.police.clearWanted();
      this._respawn();
    }
    this.state = 'playing';
    this.hud.hideMenu();
  }

  win() {
    this.state = 'win';
    this.save.clear();
    this.hud.showMenu('win');
  }

  busted() {
    if (this.state !== 'playing') return;
    this.money = Math.max(0, this.money - CONFIG.BUSTED_FINE);
    this.state = 'busted';
    this.audio.busted();
    this.hud.showMenu('busted');
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.money = Math.max(0, Math.floor(this.money * 0.9));
    this.state = 'wasted';
    this.audio.busted();
    this.hud.showMenu('wasted');
  }

  _respawn() {
    this._exitCar();
    this.player.pos.x = this._respawnPoint.x;
    this.player.pos.z = this._respawnPoint.z;
    this.player.heading = 0;
    this.player.mesh.position.set(this.player.pos.x, 0, this.player.pos.z);
  }

  _resetPlayerToStart() {
    this._exitCar();
    this.player.pos.x = CONFIG.PLAYER_START.x;
    this.player.pos.z = CONFIG.PLAYER_START.z;
    this.player.heading = 0;
    this.player.mesh.position.set(this.player.pos.x, 0, this.player.pos.z);
    this.player.mesh.rotation.y = 0;
  }

  // --- Cars --------------------------------------------------------------------

  enterCar(car) {
    if (!car || this.player.car) return false;
    this.player.car = car;
    this.player.mesh.visible = false;
    if (!car.stolen) {
      car.stolen = true;
      this.police.addWanted(CONFIG.STEAL_WANTED);
      this.hud.toast(car.taxi ? 'Taxi taken — a fare is waiting. Press T for a job.' : 'Car stolen — the heat is on!');
      if (car.taxi) this.missions.startTaxi(this.player.pos);
    }
    this.audio.ensure();
    return true;
  }

  _exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.speed = 0;
    this.player.car = null;
    this.player.mesh.visible = true;
    const side = Math.cos(this.player.heading);
    this.player.pos.x = car.pos.x + (side >= 0 ? 2.5 : -2.5);
    this.player.pos.z = car.pos.z;
    this.player.mesh.position.set(this.player.pos.x, 0, this.player.pos.z);
    this.player.heading = car.heading;
  }

  // --- Per-frame update ---------------------------------------------------------

  update(rawDt) {
    const dt = Math.min(rawDt, 0.05);
    // The menu still orbits the city behind the title screen.
    if (this.state === 'menu') {
      this._orbitCamera(rawDt);
      this.dayTime = (this.dayTime + rawDt / CONFIG.DAY_LENGTH_SECONDS) % 1;
      this.isNight = this.city.applyDayTime(this.dayTime);
      this.traffic.update(dt, null);
      this._animatePickups(rawDt);
      return;
    }
    if (this.state !== 'playing') {
      this.input.endFrame();
      return;
    }
    this.elapsed += dt;
    this.dayTime = (this.dayTime + dt / CONFIG.DAY_LENGTH_SECONDS) % 1;
    this.isNight = this.city.applyDayTime(this.dayTime);
    this.stuntCooldown = Math.max(0, this.stuntCooldown - dt);
    this.combat.update(dt);

    if (this.input.pausePressed()) {
      this.pauseGame();
      this.input.endFrame();
      return;
    }
    if (this.input.radioPressed()) {
      const name = this.audio.cycleStation();
      this.hud.toast(`Radio: ${name}`);
    }
    if (this.input.hornPressed() && this.player.car) this.audio.horn();

    if (this.autopilot) this._runAutopilot(dt);
    else this._runPlayerInput(dt);

    this.traffic.update(dt, this.player.car);
    const shooting = this._combatInput();
    this.pedestrians.update(dt, this.player.pos, this.player.car ? Math.abs(this.player.car.speed) : 0, shooting);
    this._checkPedestrianHits();
    this.police.update(dt, this.player.pos, this.player.car, this.player.car ? Math.abs(this.player.car.speed) : 0, !this.player.car);
    this.missions.update(dt, this.player.pos, !!this.player.car);
    this._checkPickups();
    this._checkShells();
    this._checkSprayShop();
    this._checkRamps();
    this._updateMarker(rawDt);
    this._animatePickups(rawDt);
    this._updateCamera(dt);
    this._updateTracer(dt);
    this.audio.update(this.player.car ? this.player.car.speed : 0, !!this.player.car, this.police.wanted);
    this.save.autosave(this);
    this.hud.update();
    this.input.endFrame();
  }

  _runPlayerInput(dt) {
    const input = this.input;
    const player = this.player;
    if (input.actionPressed()) {
      if (player.car) {
        this._exitCar();
      } else {
        const car = this.traffic.nearestParked(player.pos.x, player.pos.z, 4);
        if (car) this.enterCar(car);
        else this.combat.punch(player.pos, player.heading);
      }
    }
    if (player.car) {
      const car = player.car;
      car.drive(input.throttle, input.steer, dt, this.city);
      if (input.handbrake) car.speed *= Math.max(0, 1 - 3 * dt);
      player.pos.x = car.pos.x;
      player.pos.z = car.pos.z;
      player.heading = car.heading;
    } else {
      const speed = input.running ? CONFIG.PLAYER_RUN_SPEED : CONFIG.PLAYER_WALK_SPEED;
      const move = input.throttle;
      const strafe = input.steer;
      if (move !== 0 || strafe !== 0) {
        const camAngle = this.cameraYaw;
        const fx = Math.sin(camAngle);
        const fz = Math.cos(camAngle);
        const rx = Math.cos(camAngle);
        const rz = -Math.sin(camAngle);
        let dx = fx * move + rx * strafe;
        let dz = fz * move + rz * strafe;
        const len = Math.sqrt(dx * dx + dz * dz);
        dx /= len;
        dz /= len;
        player.heading = Math.atan2(dx, dz);
        player.pos.x += dx * speed * dt;
        player.pos.z += dz * speed * dt;
        player.walkPhase += dt * speed;
        player.mesh.position.y = Math.abs(Math.sin(player.walkPhase * 1.4)) * 0.12;
      } else {
        player.mesh.position.y = 0;
      }
      player.pos.x = clamp(player.pos.x, -185, 185);
      player.pos.z = clamp(player.pos.z, -185, 250);
      this.city.resolveCircle(player.pos, CONFIG.PLAYER_RADIUS);
      player.mesh.rotation.y = player.heading;
    }
    // Mouse look orbits the camera around the player.
    this.cameraYaw += this.input.lookDeltaX * 0.003;
    this.cameraPitch = clamp(this.cameraPitch + this.input.lookDeltaY * 0.002, 0.15, 1.1);
  }

  _combatInput() {
    if (this.player.car) return false;
    if (this.input.shootPressed() && this.combat.hasPistol) {
      const ok = this.combat.shoot(this.player.pos, this.player.heading);
      if (ok) {
        this._tracer = this.combat.tracerFrom(this.player.pos, this.player.heading);
        this._tracerTimer = 0.12;
      }
      return ok;
    }
    return false;
  }

  _checkPedestrianHits() {
    if (!this.player.car) return;
    const hits = this.pedestrians.checkCarHits(this.player.car);
    if (hits > 0) {
      this.police.addWanted(CONFIG.PED_HIT_WANTED);
      this.audio.crash();
      this.hud.toast('You hit a pedestrian! The heat is on.');
    }
  }

  // --- Autopilot (tests drive with this) ---------------------------------------

  _runAutopilot(dt) {
    const ap = this.autopilot;
    if (performance.now() > ap.until) {
      this.autopilot = null;
      return;
    }
    if (!ap.waypoints || ap.waypoints.length === 0) {
      this.autopilot = null;
      return;
    }
    const target = ap.waypoints[0];
    const d = distance2D(this.player.pos.x, this.player.pos.z, target.x, target.z);
    if (d < 6) {
      ap.waypoints.shift();
      return;
    }
    if (ap.onFoot) {
      if (!this.player.car) {
        const want = Math.atan2(target.x - this.player.pos.x, target.z - this.player.pos.z);
        const diff = angleDiff(this.player.heading, want);
        this.player.heading += clamp(diff, -3 * dt, 3 * dt);
        this.player.pos.x += Math.sin(this.player.heading) * CONFIG.PLAYER_WALK_SPEED * dt;
        this.player.pos.z += Math.cos(this.player.heading) * CONFIG.PLAYER_WALK_SPEED * dt;
        this.city.resolveCircle(this.player.pos, CONFIG.PLAYER_RADIUS);
        this.player.mesh.rotation.y = this.player.heading;
      } else {
        this._exitCar();
      }
    } else {
      if (!this.player.car) {
        const car = this.traffic.nearestParked(this.player.pos.x, this.player.pos.z, 5);
        if (car) this.enterCar(car);
        else {
          // Walk toward the waypoint until a car is in reach.
          const want = Math.atan2(target.x - this.player.pos.x, target.z - this.player.pos.z);
          this.player.heading = want;
          this.player.pos.x += Math.sin(want) * CONFIG.PLAYER_WALK_SPEED * dt;
          this.player.pos.z += Math.cos(want) * CONFIG.PLAYER_WALK_SPEED * dt;
          this.city.resolveCircle(this.player.pos, CONFIG.PLAYER_RADIUS);
          this.player.mesh.rotation.y = want;
        }
      } else {
        // Stuck recovery: if the car has barely moved in 3 seconds of
        // game time (wedged on a wall, pinned by a police ram), reverse
        // out for a second instead of grinding against the obstacle.
        if (ap.lastCheckElapsed === undefined) {
          ap.lastCheckElapsed = this.elapsed;
          ap.lastPos = { x: this.player.pos.x, z: this.player.pos.z };
        }
        if (this.elapsed - ap.lastCheckElapsed > 3) {
          const moved = distance2D(this.player.pos.x, this.player.pos.z, ap.lastPos.x, ap.lastPos.z);
          if (moved < 2) ap.reverseUntilElapsed = this.elapsed + 1.0;
          ap.lastPos = { x: this.player.pos.x, z: this.player.pos.z };
          ap.lastCheckElapsed = this.elapsed;
        }
        if (ap.reverseUntilElapsed && this.elapsed < ap.reverseUntilElapsed) {
          this.player.car.drive(-0.8, -0.8, dt, this.city);
        } else {
          this.traffic.autopilotDrive(this.player.car, target, dt, this.city);
        }
        this.player.pos.x = this.player.car.pos.x;
        this.player.pos.z = this.player.car.pos.z;
        this.player.heading = this.player.car.heading;
      }
    }
  }

  // --- Pickups, shells, spray shop, ramps ---------------------------------------

  _checkPickups() {
    const pos = this.player.pos;
    for (let i = 0; i < CASH_PICKUPS.length; i++) {
      if (this.cashTaken[i]) continue;
      const p = CASH_PICKUPS[i];
      if (distance2D(pos.x, pos.z, p.x, p.z) < 4) {
        this.cashTaken[i] = true;
        this.pickupMeshes[i].visible = false;
        this.money += CONFIG.CASH_PICKUP_VALUE;
        this.score += CONFIG.CASH_PICKUP_VALUE;
        this.audio.pickup();
        this.hud.toast(`Cash found — +$${CONFIG.CASH_PICKUP_VALUE}`);
      }
    }
  }

  _checkShells() {
    const pos = this.player.pos;
    for (let i = 0; i < SHELLS.length; i++) {
      if (this.shellsTaken[i]) continue;
      const s = SHELLS[i];
      if (distance2D(pos.x, pos.z, s.x, s.z) < 3.5) {
        this.shellsTaken[i] = true;
        this.shellMeshes[i].visible = false;
        this.shellsCollected += 1;
        this.money += CONFIG.SHELL_VALUE;
        this.score += CONFIG.SHELL_VALUE;
        this.audio.shell();
        this.hud.toast(`Golden shell ${this.shellsCollected}/10 — +$${CONFIG.SHELL_VALUE}`);
      }
    }
  }

  _checkSprayShop() {
    if (!this.player.car) return;
    if (this.police.wanted === 0) return;
    const m = LANDMARKS.spray.marker;
    if (distance2D(this.player.pos.x, this.player.pos.z, m.x, m.z) < 8) {
      if (this.money < CONFIG.SPRAY_COST) {
        this.hud.hint(`Spray Shop costs $${CONFIG.SPRAY_COST} — you can't afford it yet.`);
        return;
      }
      this.money -= CONFIG.SPRAY_COST;
      this.police.clearWanted();
      this.audio.pickup();
      this.hud.toast(`Spray Shop — clean car, clean slate (-$${CONFIG.SPRAY_COST})`);
    }
  }

  _checkRamps() {
    const car = this.player.car;
    if (!car || car.airborne || this.stuntCooldown > 0) return;
    for (const ramp of RAMPS) {
      if (distance2D(car.pos.x, car.pos.z, ramp.x, ramp.z) < 5 && Math.abs(car.speed) > 15) {
        car.launch();
        this.stuntCooldown = 3;
        // The bonus lands when the car comes back down.
        this._pendingStunt = true;
        this.hud.toast('Airtime! Land it for a stunt bonus.');
      }
    }
    if (this._pendingStunt && car && !car.airborne && car.airTime > 0.7) {
      this._pendingStunt = false;
      this.money += CONFIG.STUNT_BONUS;
      this.score += CONFIG.STUNT_BONUS;
      this.audio.shell();
      this.hud.toast(`Stunt jump! +$${CONFIG.STUNT_BONUS}`);
    } else if (this._pendingStunt && car && !car.airborne) {
      this._pendingStunt = false;
    }
  }

  _updateMarker(dt) {
    const marker = this.missions.marker || this.missions.taxiMarker;
    if (!marker || (this.missions.index >= 3 && !this.missions.taxi.active)) {
      this.markerMesh.visible = false;
      return;
    }
    this.markerMesh.visible = true;
    this.markerMesh.position.set(marker.x, 0, marker.z);
    const bob = Math.sin(this.elapsed * 3) * 0.5;
    this.markerMesh.children[1].position.y = 7 + bob;
    this.markerMesh.children[1].rotation.y += dt * 2;
  }

  _animatePickups(dt) {
    const t = performance.now() / 500;
    for (let i = 0; i < this.pickupMeshes.length; i++) {
      if (this.cashTaken[i]) continue;
      this.pickupMeshes[i].rotation.y += dt * 2;
      this.pickupMeshes[i].position.y = 0.6 + Math.sin(t + i) * 0.15;
    }
    for (let i = 0; i < this.shellMeshes.length; i++) {
      if (this.shellsTaken[i]) continue;
      this.shellMeshes[i].rotation.y += dt * 1.5;
    }
    // Gentle sea shimmer.
    if (this.city.seaMesh) {
      this.city.seaMesh.material.color.setHex(this.isNight ? 0x143a55 : 0x2e7fa8);
    }
  }

  // --- Camera -------------------------------------------------------------------

  // Snap the camera straight to its chase position instead of lerping
  // there — screenshot staging needs the framing at once, not after
  // seconds of slow headless frames.
  snapCamera() {
    const player = this.player;
    const behind = player.car ? 12 : 9;
    const height = player.car ? 6 : 5;
    const yaw = player.car ? player.heading + Math.PI : this.cameraYaw + Math.PI;
    this.camera.position.set(
      player.pos.x + Math.sin(yaw) * behind,
      height + Math.sin(this.cameraPitch) * 4,
      player.pos.z + Math.cos(yaw) * behind,
    );
    this.camera.lookAt(player.pos.x, 1.5, player.pos.z);
  }

  _orbitCamera(dt) {
    const t = performance.now() / 1000;
    const radius = 150;
    this.camera.position.set(Math.sin(t * 0.05) * radius, 55, Math.cos(t * 0.05) * radius);
    this.camera.lookAt(0, 0, 0);
  }

  _updateCamera(dt) {
    const player = this.player;
    const behind = player.car ? 12 : 9;
    const height = player.car ? 6 : 5;
    const yaw = player.car ? player.heading + Math.PI : this.cameraYaw + Math.PI;
    const tx = player.pos.x + Math.sin(yaw) * behind;
    const tz = player.pos.z + Math.cos(yaw) * behind;
    const ty = height + Math.sin(this.cameraPitch) * 4;
    this.camera.position.x += (tx - this.camera.position.x) * Math.min(1, dt * 6);
    this.camera.position.y += (ty - this.camera.position.y) * Math.min(1, dt * 6);
    this.camera.position.z += (tz - this.camera.position.z) * Math.min(1, dt * 6);
    this.camera.lookAt(player.pos.x, 1.5, player.pos.z);
  }

  _updateTracer(dt) {
    if (this._tracerTimer > 0) {
      this._tracerTimer -= dt;
      if (this._tracerTimer <= 0 && this._tracerMesh) {
        this.scene.remove(this._tracerMesh);
        this._tracerMesh = null;
      }
    }
    if (this._tracer && !this._tracerMesh) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(this._tracer.x1, 1.4, this._tracer.z1),
        new THREE.Vector3(this._tracer.x2, 1.4, this._tracer.z2),
      ]);
      this._tracerMesh = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
      this.scene.add(this._tracerMesh);
      this._tracer = null;
    }
  }
}
