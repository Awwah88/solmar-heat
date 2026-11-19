// Solmar Heat — Game: state machine, camera, collisions, pickups, spray
// shop, taxi, save/autosave and the runtime hooks the tools read
// (window.__solmarHeat, state/money/health getters, playerPos,
// playerHeading, traffic, police, missions, city, renderer, scene).

import * as THREE from 'three';
import { CASH_SPOTS, HEALTH_SPOTS, LANDMARKS, PACKAGES, SPAWN, TAXI_RANKS, TUNING, clamp, mulberry32, wrapAngle } from './config.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity } from './city.js';
import { TrafficSystem, parkedCars } from './vehicles.js';
import { PedestrianSystem } from './pedestrians.js';
import { PoliceSystem } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { SaveSystem } from './save.js';

function markerOf(id) {
  const lm = LANDMARKS.find((l) => l.id === id);
  return lm ? lm.marker : [0, 0];
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

export class Game {
  constructor(container, opts = {}) {
    this.container = container;
    const params = new URLSearchParams(window.location.search);
    const seed = parseInt(params.get('seed') || '', 10) || ((Date.now() / 1000) | 0);
    this.rng = mulberry32(seed);
    this._state = 'menu';
    this._money = 0;
    this.playSeconds = 0;
    this.px = SPAWN.x;
    this.pz = SPAWN.z;
    this.heading = SPAWN.heading;
    this.downTimer = 0;
    this._saveT = 0;
    this._trafficHitCd = 0;
    this._sprayNagT = 0;
    this._menuAngle = 0;
    this._camPos = new THREE.Vector3(0, 90, 220);
    this._camLook = new THREE.Vector3(0, 0, 0);
    this.parkedExtras = [];

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf2a35e);
    this.scene.fog = new THREE.Fog(0xf2a35e, 140, 560);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 90, 220);

    const hemi = new THREE.HemisphereLight(0xffe0b3, 0x3a5a3a, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd9a0, 1.7);
    sun.position.set(140, 190, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -220;
    sun.shadow.camera.right = 220;
    sun.shadow.camera.top = 220;
    sun.shadow.camera.bottom = -220;
    sun.shadow.camera.far = 600;
    this.scene.add(sun);

    this.city = buildCity(THREE, this.scene, this.rng);
    this.traffic = new TrafficSystem(THREE, this.scene, this.rng);
    this.parked = parkedCars(THREE, this.scene);
    this.peds = new PedestrianSystem(THREE, this.scene, this.rng);
    TAXI_RANKS.forEach(([x, z], i) => this.peds.makeTaxi(i * 7 + 2, x, z));
    this.police = new PoliceSystem(THREE, this.scene, this.rng);
    this.police.onRam = () => this._onRam();
    this.police.onBusted = () => this._goDown('busted');
    this.combat = new Combat({
      onPlayerDown: () => this._goDown(this.police.wanted > 0 ? 'busted' : 'wasted'),
      toast: (m) => this.hud.toast(m),
      sound: (s) => this.audio && this.audio[s] && this.audio[s](),
      addWanted: (n) => this.police.addWanted(n),
    });
    this._missionHooks = {
      addMoney: (n) => { this._money += n; },
      setWanted: (n) => this.police.setWanted(n),
      grantPistol: () => {
        this.combat.hasPistol = true;
        this.hud.toast('Pistol earned — click to shoot');
      },
      toast: (m) => this.hud.toast(m),
      sound: (s) => this.audio && this.audio[s] && this.audio[s](),
      onWin: () => this._onWin(),
    };
    this.missions = new Missions(this._missionHooks);
    this.hud = new HUD(document);
    this.hud.onStart = () => this.startGame(false);
    this.hud.onContinue = () => this.startGame(true);
    this.hud.onResume = () => this._resume();
    this.hud.onRestart = () => this.startGame(false);
    this.hud.onEnd = () => this._freeRoam();
    this.save = new SaveSystem();
    this.input = new Input();
    this.audio = new AudioEngine();

    // Player on-foot mesh: red jacket, easy to spot.
    this.player = { car: null, mesh: null };
    const pm = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0xc22a2a });
    const dark = new THREE.MeshLambertMaterial({ color: 0x22242e });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.9, 8), dark);
    legs.position.y = 0.45;
    pm.add(legs);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.8, 8), jacket);
    torso.position.y = 1.25;
    pm.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
    head.position.y = 1.88;
    pm.add(head);
    pm.position.set(this.px, 0, this.pz);
    pm.rotation.y = this.heading;
    this.scene.add(pm);
    this.player.mesh = pm;

    this._buildPickups();
    this._buildBeacons();

    this.clock = new THREE.Clock();
    this.hud.showMenu(this.save.hasSave());
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.renderer.setAnimationLoop(() => this._frame());
  }

  get state() { return this._state; }
  get money() { return this._money; }
  get health() { return this.combat.health; }
  get score() { return Math.floor(this._money) + this.missions.doneCount * 100; }

  playerPos() { return { x: this.px, z: this.pz }; }
  playerHeading() { return this.heading; }

  missionTarget() {
    const t = this.missions.taxi;
    if (t.active) return t.stage === 0 ? t.pickup : t.dropoff.marker;
    const m = this.missions.current;
    if (!m) return null;
    if (m.id === 1) return [this.parked.redSedan.group.position.x, this.parked.redSedan.group.position.z];
    if (m.id === 2) {
      for (let i = 0; i < PACKAGES.length; i++) {
        if (!this.missions.delivered.has(i)) return PACKAGES[i];
      }
      return null;
    }
    if (m.id === 3) return this.police.wanted > 0 ? markerOf('spray') : markerOf('safehouse');
    if (m.id === 4) {
      if (this.missions.stage === 0) return [this.parked.goldGt.group.position.x, this.parked.goldGt.group.position.z];
      if (this.missions.stage === 1) return markerOf('lighthouse');
      return markerOf('safehouse');
    }
    return null;
  }

  teleportPlayer(x, z, heading) {
    this.px = x;
    this.pz = z;
    if (heading !== undefined) this.heading = heading;
    if (this.player.car) {
      this.player.car.group.position.set(x, 0, z);
      this.player.car.group.rotation.y = this.heading;
      this.player.car.heading = this.heading;
    }
    this.player.mesh.position.set(x, 0, z);
    this.player.mesh.rotation.y = this.heading;
  }

  enterCar(car) {
    if (this.player.car) return;
    if (car.traffic) {
      const i = this.traffic.cars.indexOf(car);
      if (i >= 0) this.traffic.cars.splice(i, 1);
      this.parkedExtras.push(car);
      car.traffic = false;
      this.police.addWanted(1);
      this.hud.toast('You stole a car — wanted up');
    }
    this.player.car = car;
    car.speed = 0;
    this.px = car.group.position.x;
    this.pz = car.group.position.z;
    this.heading = car.heading;
    this.player.mesh.visible = false;
    this.audio.engine(0);
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    const rx = -Math.cos(this.heading);
    const rz = Math.sin(this.heading);
    this.px = car.group.position.x + rx * 2.8;
    this.pz = car.group.position.z + rz * 2.8;
    car.speed = 0;
    this.player.car = null;
    this.player.mesh.visible = true;
    this.player.mesh.position.set(this.px, 0, this.pz);
    this.player.mesh.rotation.y = this.heading;
  }

  setWanted(n) {
    this.police.setWanted(n);
  }

  showPlaying() {
    this._state = 'playing';
    this.hud.showPlaying();
  }

  startGame(fromSave) {
    this.audio.ensure();
    this.missions = new Missions(this._missionHooks);
    this.combat.reset();
    this.combat.hasPistol = false;
    this.police.clearWanted();
    this.player.car = null;
    this.player.mesh.visible = true;
    this._money = 0;
    this.playSeconds = 0;
    this.px = SPAWN.x;
    this.pz = SPAWN.z;
    this.heading = SPAWN.heading;
    this.player.mesh.position.set(this.px, 0, this.pz);
    this.player.mesh.rotation.y = this.heading;
    for (const p of this.pickups) { p.taken = false; p.respawnT = 0; p.mesh.visible = true; }
    if (fromSave) {
      const s = this.save.load();
      if (s) {
        this._money = s.money || 0;
        this.combat.health = s.health || 100;
        this.combat.hasPistol = !!s.hasPistol;
        this.playSeconds = s.playSeconds || 0;
        this.missions.setDone(s.missionsDone || []);
        if (s.player) this.teleportPlayer(s.player.x, s.player.z, s.player.heading);
        if (this.missions.current) this.missions.startMission(this.missions.current);
        this.hud.toast('Welcome back to Solmar Bay.');
      }
    } else {
      this.save.clear();
      this.hud.toast('Dana "Dash" Reyes owes the Marlin Club $400. Get to work.');
    }
    this.showPlaying();
  }

  _resume() {
    this._state = 'playing';
    this.hud.showPlaying();
  }

  _freeRoam() {
    this._state = 'playing';
    this.hud.showPlaying();
    this.hud.toast('Free roam — Solmar Bay is yours.');
  }

  _onWin() {
    this._money += 25;
    this._state = 'end';
    this.hud.showEnd('win', { money: Math.floor(this._money), missions: this.missions.doneCount, time: fmtTime(this.playSeconds) });
    this.audio.missionDone();
    this._saveSnapshot();
  }

  _goDown(kind) {
    if (this._state !== 'playing' || this.downTimer > 0) return;
    const fine = TUNING.bustedFine;
    this._money = Math.max(0, this._money - fine);
    this.hud.showDown(kind.toUpperCase(), fine);
    this.downTimer = 2.6;
  }

  _respawn() {
    if (this.player.car) {
      this.player.car.speed = 0;
      this.player.car = null;
    }
    this.player.mesh.visible = true;
    this.combat.reset();
    this.combat.health = 60;
    this.police.clearWanted();
    this.teleportPlayer(SPAWN.x, SPAWN.z, SPAWN.heading);
    this.hud.hideDown();
    this.hud.toast('You wake up at the Marina — $75 fine.');
  }

  _onRam() {
    const now = performance.now();
    if (now - (this._lastRam || 0) < 1200) return;
    this._lastRam = now;
    this.combat.hurt(6, 'ram');
    this.audio.ram();
    if (this.player.car) {
      this.player.car.speed *= 0.6;
    }
  }

  _buildPickups() {
    this.pickups = [];
    const cashGeo = new THREE.OctahedronGeometry(0.9);
    const cashMat = new THREE.MeshBasicMaterial({ color: 0x39d353 });
    const healthGeo = new THREE.BoxGeometry(1.1, 1.1, 0.4);
    const healthMat = new THREE.MeshBasicMaterial({ color: 0xff4d4d });
    for (const [x, z] of CASH_SPOTS) {
      const mesh = new THREE.Mesh(cashGeo, cashMat);
      mesh.position.set(x, 1.2, z);
      this.scene.add(mesh);
      this.pickups.push({ x, z, kind: 'cash', taken: false, respawnT: 0, mesh });
    }
    for (const [x, z] of HEALTH_SPOTS) {
      const mesh = new THREE.Mesh(healthGeo, healthMat);
      mesh.position.set(x, 1.2, z);
      this.scene.add(mesh);
      this.pickups.push({ x, z, kind: 'health', taken: false, respawnT: 0, mesh });
    }
  }

  _buildBeacons() {
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 30, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.set(0, 15, -500);
    this.scene.add(this.beacon);
    this.packageBeacons = PACKAGES.map(([x, z]) => {
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.4, 18, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x39d353, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
      );
      b.position.set(x, 9, z);
      this.scene.add(b);
      return b;
    });
  }

  _saveSnapshot() {
    this.save.save({
      money: this._money,
      health: this.combat.health,
      score: this.score,
      missionsDone: this.missions.doneIds,
      player: { x: this.px, z: this.pz, heading: this.heading },
      hasPistol: this.combat.hasPistol,
      playSeconds: this.playSeconds,
    });
  }

  // Circle vs building colliders: push out along the smallest penetration.
  _collide(x, z, r) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.city.colliders) {
        const cx = clamp(x, c.xmin, c.xmax);
        const cz = clamp(z, c.zmin, c.zmax);
        let dx = x - cx;
        let dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = (r - d) / d;
          x += dx * push;
          z += dz * push;
        } else {
          const l = x - c.xmin;
          const rr = c.xmax - x;
          const t = z - c.zmin;
          const b = c.zmax - z;
          const m = Math.min(l, rr, t, b);
          if (m === l) x = c.xmin - r;
          else if (m === rr) x = c.xmax + r;
          else if (m === t) z = c.zmin - r;
          else z = c.zmax + r;
        }
      }
    }
    return { x, z, hit };
  }

  _enterableCars() {
    return [...this.traffic.cars, this.parked.redSedan, this.parked.goldGt, ...this.parkedExtras];
  }

  _nearestCar(maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of this._enterableCars()) {
      const d = Math.hypot(car.group.position.x - this.px, car.group.position.z - this.pz);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  _frame() {
    const input = this.input;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (input.hit('Escape') || input.hit('KeyP')) {
      if (this._state === 'playing') {
        this._state = 'paused';
        this.hud.showPaused();
      } else if (this._state === 'paused') {
        this._resume();
      }
    }
    if (input.hit('KeyM')) {
      this.audio.setMuted(!this.audio.muted);
      this.hud.toast(this.audio.muted ? 'Sound off' : 'Sound on');
    }
    if (this._state === 'menu') {
      this._menuAngle += dt * 0.05;
      const r = 230;
      this.camera.position.set(Math.sin(this._menuAngle) * r, 95, Math.cos(this._menuAngle) * r);
      this.camera.lookAt(0, 0, 0);
      this.traffic.update(dt);
      this.peds.update(dt, this.px, this.pz, false, 0);
      this.renderer.render(this.scene, this.camera);
      input.endFrame();
      return;
    }
    if (this._state === 'paused') {
      input.endFrame();
      return;
    }
    if (this._state === 'end') {
      this._menuAngle += dt * 0.03;
      const r = 180;
      this.camera.position.set(this.px + Math.sin(this._menuAngle) * r, 70, this.pz + Math.cos(this._menuAngle) * r);
      this.camera.lookAt(this.px, 0, this.pz);
      this.renderer.render(this.scene, this.camera);
      input.endFrame();
      return;
    }
    if (this.downTimer > 0) {
      this.downTimer -= dt;
      if (this.downTimer <= 0) this._respawn();
      this.renderer.render(this.scene, this.camera);
      input.endFrame();
      return;
    }
    this._update(dt, input);
    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  }

  _update(dt, input) {
    this.playSeconds += dt;
    this._saveT += dt;
    if (this._saveT > 15) {
      this._saveT = 0;
      this._saveSnapshot();
    }
    this._trafficHitCd = Math.max(0, this._trafficHitCd - dt);
    this._sprayNagT = Math.max(0, this._sprayNagT - dt);
    const axes = input.axes();
    const car = this.player.car;

    if (car) {
      // Driving.
      if (axes.y > 0) car.speed += TUNING.carAccel * dt;
      else if (axes.y < 0) car.speed -= (car.speed > 0.5 ? TUNING.carBrake : TUNING.carAccel * 0.6) * dt;
      else car.speed *= Math.exp(-0.5 * dt);
      if (input.down('Space')) car.speed *= Math.exp(-2.6 * dt);
      car.speed = clamp(car.speed, -TUNING.carReverseMax, TUNING.carMaxSpeed);
      const steerAuthority = 0.35 + 0.65 * Math.min(1, Math.abs(car.speed) / 12);
      car.heading = wrapAngle(car.heading - axes.x * TUNING.carTurn * steerAuthority * dt * Math.sign(car.speed || 1));
      const nx = car.group.position.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.group.position.z + Math.cos(car.heading) * car.speed * dt;
      const solved = this._collide(nx, nz, TUNING.carRadius);
      if (solved.hit) {
        // Hard crash: bleed speed and take damage. Gentle contact just
        // slides along the wall so the car can work around the corner.
        if (Math.abs(car.speed) > 8) {
          car.speed *= 0.55;
          this.combat.hurt(4, 'crash');
          this.audio.ram();
        }
      }
      car.group.position.x = solved.x;
      car.group.position.z = solved.z;
      car.group.rotation.y = car.heading;
      this.px = solved.x;
      this.pz = solved.z;
      this.heading = car.heading;
      this.player.mesh.position.set(this.px, 0, this.pz);
      if (input.hit('KeyE')) this.exitCar();
      if (input.hit('KeyT')) this._tryTaxi();
      // Run over a pedestrian: they flee, wanted rises (once per ped).
      for (const w of this.peds.walkers) {
        if (w.taxi) continue;
        const d = Math.hypot(w.group.position.x - this.px, w.group.position.z - this.pz);
        if (d < 2.6 && Math.abs(car.speed) > 5 && (!w._lastRunOver || performance.now() - w._lastRunOver > 5000)) {
          w._lastRunOver = performance.now();
          this.peds.fleeFrom(w.group.position.x, w.group.position.z, 2);
          this.police.addWanted(1);
          this.hud.toast('You hit a pedestrian — wanted up');
        }
      }
    } else {
      // On foot.
      this.heading = wrapAngle(this.heading - axes.x * 2.6 * dt);
      const run = input.down('ShiftLeft') || input.down('ShiftRight');
      const speed = axes.y > 0 ? (run ? TUNING.runSpeed : TUNING.walkSpeed) : axes.y < 0 ? 4 : 0;
      const nx = this.px + Math.sin(this.heading) * speed * dt;
      const nz = this.pz + Math.cos(this.heading) * speed * dt;
      const solved = this._collide(nx, nz, TUNING.playerRadius);
      // City bounds (pier corridor lets the player walk the deck).
      let bx = clamp(solved.x, -178, 178);
      let bz = clamp(solved.z, -178, 178);
      if (solved.z > 116 && solved.z < 134) bx = clamp(solved.x, -178, 212);
      if (solved.x > 116 && solved.x < 134) bz = clamp(solved.z, -178, 212);
      this.px = bx;
      this.pz = bz;
      this.player.mesh.position.set(this.px, 0, this.pz);
      this.player.mesh.rotation.y = this.heading;
      if (input.hit('KeyE')) {
        const near = this._nearestCar(4.5);
        if (near) this.enterCar(near);
      }
      if (input.hit('KeyF')) {
        this.combat.punch(this.px, this.pz, this.heading, this.peds, this.police.policeCars);
      }
      if (input.mouseClicked && this.combat.hasPistol) {
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        this.combat.shoot({ x: this.px, z: this.pz }, { x: dir.x, z: dir.z }, this.peds, this.police.policeCars);
      }
      if (input.hit('KeyT')) this._tryTaxi();
      // Traffic car clips the player on foot.
      if (this._trafficHitCd <= 0) {
        for (const c of this.traffic.cars) {
          const d = Math.hypot(c.group.position.x - this.px, c.group.position.z - this.pz);
          if (d < 2.4) {
            this._trafficHitCd = 1.2;
            this.combat.hurt(10, 'traffic');
            this.px += Math.sin(c.heading) * 2;
            this.pz += Math.cos(c.heading) * 2;
            this.audio.ram();
            break;
          }
        }
      }
    }

    // Spray Shop: drive in with heat and cash, drive out clean.
    const [sx, sz] = markerOf('spray');
    if (this.player.car && this.police.wanted > 0 && Math.hypot(this.px - sx, this.pz - sz) < TUNING.sprayRadius) {
      if (this._money >= TUNING.sprayCost) {
        this._money -= TUNING.sprayCost;
        this.police.clearWanted();
        this.audio.pickup();
        this.hud.toast(`Spray Shop — wanted cleared (−$${TUNING.sprayCost})`);
      } else if (this._sprayNagT <= 0) {
        this._sprayNagT = 4;
        this.hud.toast(`Spray Shop needs $${TUNING.sprayCost} — you are short.`);
      }
    }

    // Pickups.
    for (const p of this.pickups) {
      if (p.taken) {
        p.respawnT -= dt;
        if (p.respawnT <= 0) {
          p.taken = false;
          p.mesh.visible = true;
        }
        continue;
      }
      p.mesh.rotation.y += dt * 1.5;
      p.mesh.position.y = 1.2 + Math.sin(performance.now() / 300 + p.x) * 0.15;
      if (Math.hypot(this.px - p.x, this.pz - p.z) < 2.4) {
        p.taken = true;
        p.respawnT = 45;
        p.mesh.visible = false;
        if (p.kind === 'cash') {
          this._money += TUNING.cashPickup;
          this.hud.toast(`Cash pickup +$${TUNING.cashPickup}`);
        } else {
          this.combat.heal(TUNING.healthPickup);
          this.hud.toast(`Health +${TUNING.healthPickup}`);
        }
        this.audio.pickup();
      }
    }

    // Mission beacon + package beacons.
    const tgt = this.missionTarget();
    if (tgt) {
      this.beacon.visible = true;
      this.beacon.position.set(tgt[0], 15, tgt[1]);
    } else {
      this.beacon.visible = false;
    }
    const m2 = this.missions.current && this.missions.current.id === 2;
    this.packageBeacons.forEach((b, i) => {
      b.visible = !!(m2 && !this.missions.delivered.has(i));
    });

    this.traffic.update(dt);
    // Keep traffic and police out of the buildings: push them out of any
    // collider they clip while turning a corner or cutting across a block.
    for (const c of this.traffic.cars) {
      const s = this._collide(c.group.position.x, c.group.position.z, TUNING.carRadius);
      c.group.position.x = s.x;
      c.group.position.z = s.z;
    }
    for (const c of this.police.policeCars) {
      const s = this._collide(c.group.position.x, c.group.position.z, TUNING.carRadius);
      c.group.position.x = s.x;
      c.group.position.z = s.z;
    }
    this.peds.update(dt, this.px, this.pz, !!this.player.car, this.player.car ? Math.abs(this.player.car.speed) : 0);
    this.police.update(dt, { x: this.px, z: this.pz, car: this.player.car }, this.audio);
    this.missions.update(dt, {
      x: this.px,
      z: this.pz,
      inCar: !!this.player.car,
      car: this.player.car,
      wanted: this.police.wanted,
      redSedan: this.parked.redSedan,
      goldGt: this.parked.goldGt,
    });
    this.combat.update(dt);
    this.audio.engine(this.player.car ? Math.abs(this.player.car.speed) / TUNING.carMaxSpeed : 0);
    this.audio.siren(this.police.wanted > 0);
    this._updateCamera(dt, input);
    this.hud.update(this);
  }

  _tryTaxi() {
    if (this.missions.taxi.active) return;
    if (!this.player.car) {
      this.hud.toast('You need a car for a taxi fare.');
      return;
    }
    let best = null;
    let bestD = 7;
    for (const w of this.peds.walkers) {
      if (!w.taxi) continue;
      const d = Math.hypot(w.group.position.x - this.px, w.group.position.z - this.pz);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    if (!best) {
      this.hud.toast('No passenger waiting nearby — find a yellow taxi sign.');
      return;
    }
    const dest = LANDMARKS[Math.floor(this.rng() * LANDMARKS.length)];
    this.missions.startTaxi(best, [best.group.position.x, best.group.position.z], dest, TUNING.taxiBase);
  }

  _updateCamera(dt, input) {
    const look = input.consumeLook();
    this._camYaw = (this._camYaw || 0) + look.x * 0.004;
    this._camYaw *= Math.exp(-1.2 * dt);
    const behind = this.player.car ? 12 : 8.5;
    const height = this.player.car ? 6.5 : 5;
    const yaw = this.heading + this._camYaw;
    const tx = this.px - Math.sin(yaw) * behind;
    const tz = this.pz - Math.cos(yaw) * behind;
    const k = 1 - Math.exp(-5 * dt);
    this._camPos.x += (tx - this._camPos.x) * k;
    this._camPos.y += (height - this._camPos.y) * k;
    this._camPos.z += (tz - this._camPos.z) * k;
    this.camera.position.copy(this._camPos);
    this._camLook.set(this.px + Math.sin(this.heading) * 6, 1.6, this.pz + Math.cos(this.heading) * 6);
    this.camera.lookAt(this._camLook);
  }

  _menuCamera(dt) {
    this._menuAngle += dt * 0.05;
    const r = 230;
    this.camera.position.set(Math.sin(this._menuAngle) * r, 95, Math.cos(this._menuAngle) * r);
    this.camera.lookAt(0, 0, 0);
  }
}
