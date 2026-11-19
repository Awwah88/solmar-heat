// Solmar Heat — the world: game loop, player, camera, and the
// systems that tie the city, traffic, police, missions, combat,
// HUD, audio, and save together.

import * as THREE from 'three';
import {
  MISSIONS, MARKERS, PRICES, SPAWN, PARKED_CARS, PICKUP_SPOTS,
  TRAFFIC_COUNT, clamp, dist2,
} from './config.js';
import { buildCity } from './city.js';
import { Car, Traffic, collideCircle } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions, PACKAGE_STOPS } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { SaveManager } from './save.js';
import { ShotStager } from './shots.js';

const PLAYER_RADIUS = 0.8;
const PICKUP_COLOR = 0x2fd673;

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5d6);
    this.scene.fog = new THREE.Fog(0x87b5d6, 180, 420);
    this.camera = new THREE.PerspectiveCamera(
      62, window.innerWidth / window.innerHeight, 0.1, 900,
    );

    const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
    sun.position.set(120, 180, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -220;
    sun.shadow.camera.right = 220;
    sun.shadow.camera.top = 220;
    sun.shadow.camera.bottom = -220;
    sun.shadow.camera.far = 600;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0x8fa8c0, 0.9));
    this.scene.add(new THREE.HemisphereLight(0xbfd9ee, 0x3a5f3a, 0.5));

    this.city = buildCity(this.scene);
    this.colliders = this.city.colliders;
    this.input = new Input();
    this.audio = new AudioEngine();
    this.hud = new HUD();
    this.save = new SaveManager();
    this.police = new Police(this.scene, this.colliders);
    this.pedestrians = new Pedestrians(this.scene);
    this.traffic = new Traffic(this.scene, TRAFFIC_COUNT);
    this.missions = new Missions(this);
    this.combat = new Combat(this);
    this.stager = new ShotStager(this);
    this.parkedCars = [];
    this._spawnParkedCars();
    this.pickups = [];
    this._spawnPickups();
    this.player = this._makePlayer();

    this.state = 'menu';
    this.money = 0;
    this.health = 100;
    this.time = 0;
    this.invulnerable = false;
    this._autosaveAt = 0;
    this._saveSoon = false;
    this._menuAngle = 0.6;
    this._clock = new THREE.Clock();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    document.getElementById('start-btn')?.addEventListener('click', () => this.startGame());
    document.getElementById('retry-btn')?.addEventListener('click', () => this.reset());
    document.getElementById('retry-btn2')?.addEventListener('click', () => this.reset());
    document.getElementById('play-again-btn')?.addEventListener('click', () => this.reset());

    this.missions.startMission(0);
    this.hud.showMenu();
    this._frame = this._frame.bind(this);
    this._frame();
  }

  _makePlayer() {
    const group = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0xef8354 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.4), jacket);
    body.position.y = 1.05;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
    head.position.y = 1.78;
    head.castShadow = true;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), pants);
    legs.position.y = 0.4;
    group.add(body, head, legs);
    group.position.set(SPAWN.x, 0, SPAWN.z);
    group.rotation.y = SPAWN.heading;
    this.scene.add(group);
    return {
      x: SPAWN.x, z: SPAWN.z, heading: SPAWN.heading,
      inCar: false, car: null, speed: 0, mesh: group,
    };
  }

  _spawnParkedCars() {
    for (const spot of PARKED_CARS) {
      const color = [0xd23c2a, 0x2a6fd2, 0xe8c832, 0x37b24d, 0x8b5cf6][
        this.parkedCars.length % 5
      ];
      this.parkedCars.push(new Car(this.scene, {
        x: spot.x, z: spot.z, heading: spot.heading, color,
      }));
    }
  }

  _spawnPickups() {
    const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const mat = new THREE.MeshLambertMaterial({ color: PICKUP_COLOR, emissive: 0x0a5c22 });
    for (const spot of PICKUP_SPOTS) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(spot.x, 0.9, spot.z);
      this.scene.add(mesh);
      this.pickups.push({
        mesh, x: spot.x, z: spot.z,
        phase: Math.random() * 10, respawnAt: 0,
      });
    }
  }

  addMoney(n) {
    this.money += n;
    this.hud.setMoney(this.money);
  }

  saveSoon() {
    this._saveSoon = true;
  }

  startGame() {
    if (this.state !== 'menu') return;
    this.audio.resume();
    this.reset();
  }

  // Fresh run from mission 1: player, money, health, police, and
  // parked cars all reset; the save is cleared.
  reset() {
    if (this.player.car) {
      this.player.car.remove();
      this.player.car = null;
    }
    this.player.inCar = false;
    this.player.x = SPAWN.x;
    this.player.z = SPAWN.z;
    this.player.heading = SPAWN.heading;
    this.player.speed = 0;
    for (const c of this.parkedCars) c.remove();
    this.parkedCars = [];
    this._spawnParkedCars();
    this.traffic.topUp();
    this.police.setWanted(0);
    this.money = 0;
    this.health = 100;
    this.time = 0;
    this.invulnerable = false;
    this._autosaveAt = 0;
    this._saveSoon = false;
    this.combat.hasPistol = false;
    this.missions.reset();
    this.save.clear();
    this.state = 'playing';
    this.hud.setMoney(0);
    this.hud.setHealth(100);
    this.hud.setWanted(0);
    this.hud.setTimer(null);
    this.hud.showPlaying();
  }

  winGame() {
    this.state = 'win';
    this.hud.showWin(this.money);
    this.save.clear();
    this.audio.win();
  }

  _busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.hud.showBusted();
    this.audio.busted();
  }

  _wasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.hud.showWasted();
    this.audio.busted();
  }

  _damage(n) {
    if (this.invulnerable || this.state !== 'playing') return;
    this.health = clamp(this.health - n, 0, 100);
    this.hud.setHealth(this.health);
    if (this.health <= 0) this._wasted();
  }

  _nearestCar(r) {
    let best = null;
    let bestD = r;
    for (const c of [...this.parkedCars, ...this.traffic.cars]) {
      const d = dist2(c.x, c.z, this.player.x, this.player.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  _enterCar(car) {
    const isGold = car === this.missions.goldCar;
    let i = this.parkedCars.indexOf(car);
    if (i >= 0) this.parkedCars.splice(i, 1);
    i = this.traffic.cars.indexOf(car);
    if (i >= 0) {
      this.traffic.cars.splice(i, 1);
      this.traffic.topUp();
    }
    // Stealing a car is a crime — unless it is the mission's gold GT.
    if (!isGold) this.police.addWanted(1);
    this.player.car = car;
    this.player.inCar = true;
    this.player.x = car.x;
    this.player.z = car.z;
    this.player.heading = car.angle;
    this.audio.door();
  }

  // Shot staging only: enter a car without wanted or audio.
  _enterCarDirect(car) {
    const i = this.parkedCars.indexOf(car);
    if (i >= 0) this.parkedCars.splice(i, 1);
    this.player.car = car;
    this.player.inCar = true;
    this.player.x = car.x;
    this.player.z = car.z;
    this.player.heading = car.angle;
  }

  _onPressE() {
    if (this.player.inCar && this.player.car) {
      // Step out on the car's left side.
      const car = this.player.car;
      car.speed = 0;
      const lx = -Math.cos(car.angle);
      const lz = Math.sin(car.angle);
      const res = collideCircle(
        car.x + lx * 2.5, car.z + lz * 2.5, PLAYER_RADIUS, this.colliders,
      );
      this.player.x = res.x;
      this.player.z = res.z;
      this.player.heading = car.angle;
      this.player.inCar = false;
      this.player.car = null;
      this.parkedCars.push(car);
      this.audio.door();
    } else {
      const car = this._nearestCar(4);
      if (car) this._enterCar(car);
    }
  }

  // Keep the player's car from overlapping other cars.
  _separateCars() {
    const pc = this.player.car;
    if (!pc) return;
    for (const other of [...this.traffic.cars, ...this.parkedCars]) {
      const dx = pc.x - other.x;
      const dz = pc.z - other.z;
      const d = Math.hypot(dx, dz);
      const min = pc.radius + other.radius;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        pc.group.position.x += (dx / d) * push;
        pc.group.position.z += (dz / d) * push;
        other.group.position.x -= (dx / d) * push;
        other.group.position.z -= (dz / d) * push;
        pc.speed *= 0.7;
      }
    }
  }

  _updatePickups(dt) {
    for (const p of this.pickups) {
      if (!p.mesh.visible) {
        if (this.time > p.respawnAt) p.mesh.visible = true;
        continue;
      }
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = 0.9 + Math.sin(this.time * 3 + p.phase) * 0.15;
      // On foot only, within 2u.
      if (!this.player.inCar && dist2(this.player.x, this.player.z, p.x, p.z) < 2) {
        this.addMoney(PRICES.pickup);
        this.audio.pickup();
        this.hud.flash(`Cash pickup  +$${PRICES.pickup}`);
        p.mesh.visible = false;
        p.respawnAt = this.time + 60;
      }
    }
  }

  _updateSpray() {
    if (!this.player.inCar || !this.player.car) return;
    if (this.police.wanted <= 0) return;
    if (this.money < PRICES.spray) return;
    if (dist2(this.player.x, this.player.z, MARKERS.spray.x, MARKERS.spray.z) < MARKERS.spray.r) {
      this.money -= PRICES.spray;
      this.police.setWanted(0);
      this.audio.pickup();
      this.hud.flash(`Spray Shop: wanted cleared  -$${PRICES.spray}`);
      this.saveSoon();
    }
  }

  _updateCamera(dt) {
    const p = this.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const dist = p.inCar ? 17 : 12;
    const height = p.inCar ? 8 : 6.5;
    const tx = p.x - fx * dist;
    const tz = p.z - fz * dist;
    const k = 1 - Math.pow(0.001, dt);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(p.x + fx * 6, 1.5, p.z + fz * 6);
  }

  _save() {
    this.save.write({
      money: this.money,
      health: this.health,
      missionIndex: this.missions.missionIndex,
      done: this.missions.done,
      shellsTaken: this.missions.shellsTaken,
      wanted: this.police.wanted,
      hasPistol: this.combat.hasPistol,
      player: { x: this.player.x, z: this.player.z, heading: this.player.heading },
    });
  }

  // Restore a saved run; returns false when there is no save.
  loadSave() {
    const d = this.save.read();
    if (!d || typeof d.money !== 'number') return false;
    this.money = d.money;
    this.health = d.health ?? 100;
    this.player.x = d.player?.x ?? SPAWN.x;
    this.player.z = d.player?.z ?? SPAWN.z;
    this.player.heading = d.player?.heading ?? SPAWN.heading;
    this.combat.hasPistol = !!d.hasPistol;
    const idx = Math.min(d.missionIndex || 0, MISSIONS.length - 1);
    this.missions.shellsTaken = d.shellsTaken || 0;
    this.missions.startMission(idx);
    if (idx === 1) {
      // startMission(1) resets the package counter; restore the saved one.
      this.missions.shellsTaken = d.shellsTaken || 0;
      this.missions.packageIndex = Math.min(this.missions.shellsTaken, 2);
      const stop = PACKAGE_STOPS[this.missions.packageIndex];
      if (stop) this.missions.marker = { x: stop.x, z: stop.z };
    }
    this.missions.setDone(d.done || []);
    this.police.setWanted(d.wanted || 0);
    this.state = 'playing';
    this.hud.setMoney(this.money);
    this.hud.setHealth(this.health);
    this.hud.showPlaying();
    return true;
  }

  stageShot(name) {
    this.stager.stage(name);
  }

  _frame() {
    const input = this.input; // TOP of _frame, before the menu early return.
    requestAnimationFrame(this._frame);
    const dt = Math.min(this._clock.getDelta(), 0.05);

    if (this.state === 'menu') {
      // Slow orbit over the city behind the menu.
      this._menuAngle += dt * 0.05;
      const r = 190;
      this.camera.position.set(
        Math.sin(this._menuAngle) * r, 95, Math.cos(this._menuAngle) * r,
      );
      this.camera.lookAt(0, 0, 10);
      input.endFrame();
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.state !== 'playing') {
      // Busted / wasted / win: freeze the world, keep rendering.
      input.endFrame();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const now = this.time;
    this.time += dt;
    const axes = input.axes;

    // --- player movement ---------------------------------------------
    if (this.player.inCar && this.player.car) {
      const hardHit = this.player.car.drivePlayer(dt, axes, this.colliders);
      if (hardHit) {
        this.audio.crash();
        this._damage(4);
      }
      this.player.x = this.player.car.x;
      this.player.z = this.player.car.z;
      this.player.heading = this.player.car.angle;
      this.player.speed = this.player.car.speed;
      this._separateCars();
    } else {
      // On foot: A turns left (heading increases), D turns right.
      this.player.heading += -axes.x * 2.6 * dt;
      const speed = axes.y * (input.run ? 9 : 6);
      this.player.speed = speed;
      let nx = this.player.x + Math.sin(this.player.heading) * speed * dt;
      let nz = this.player.z + Math.cos(this.player.heading) * speed * dt;
      nx = clamp(nx, -176, 200);
      nz = clamp(nz, -176, 205);
      const res = collideCircle(nx, nz, PLAYER_RADIUS, this.colliders);
      this.player.x = res.x;
      this.player.z = res.z;
    }
    const pp = { x: this.player.x, z: this.player.z };
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.player.mesh.rotation.y = this.player.heading;
    this.player.mesh.visible = !this.player.inCar;

    // --- E: enter / exit a car ----------------------------------------
    if (input.pressed('KeyE')) this._onPressE();

    // --- F / click: punch or shoot (on foot); horn (in a car) ---------
    if (input.pressed('KeyF') || input.mouseDown) {
      if (!this.player.inCar) {
        if (this.combat.hasPistol) {
          this.combat.shoot(now, this.player.x, this.player.z, this.player.heading);
        } else {
          this.combat.punch(now, this.player.x, this.player.z, this.player.heading);
        }
      } else {
        this.audio.horn();
      }
    }

    // --- systems -------------------------------------------------------
    const inGold = !!(this.player.car && this.player.car === this.missions.goldCar);
    this.missions.update(
      dt, pp, this.player.inCar, inGold,
      this.player.car ? this.player.car.speed : 0,
    );
    const pol = this.police.update(dt, pp, this.player.inCar, this.player.car, now);
    if (pol.damage > 0) this._damage(pol.damage);
    if (pol.busted) this._busted();
    this.pedestrians.update(dt, pp, Math.abs(this.player.speed), this.player.inCar);
    this.traffic.update(dt, [
      ...this.traffic.cars, ...this.parkedCars,
      ...(this.player.car ? [this.player.car] : []),
    ]);
    // Driving over a pedestrian knocks them down (no wanted — the
    // police are already on the case in the missions that matter).
    if (this.player.inCar && this.player.car) {
      const ped = this.pedestrians.nearest(this.player.x, this.player.z, 2.2);
      if (ped && now - (ped.lastHit || -10) > 5) {
        ped.lastHit = now;
        this.pedestrians.knockDown(ped);
        this.hud.flash('You ran over a pedestrian!');
      }
    }
    this._updatePickups(dt);
    this._updateSpray();
    this._updateCamera(dt);

    // --- HUD -----------------------------------------------------------
    this.hud.setMoney(this.money);
    this.hud.setHealth(this.health);
    this.hud.setWanted(this.police.wanted);
    if (!this.missions.current || this.missions.current.id !== 'm2') {
      this.hud.setTimer(null);
    }
    this.hud.tick(dt, {
      now,
      playerX: this.player.x,
      playerZ: this.player.z,
      playerHeading: this.player.heading,
      marker: this.missions.marker,
      taxiMarker: this.missions.taxiMarker,
      policeCars: this.police.policeCars,
      goldCar: this.missions.goldCar,
    });

    // Engine hum follows the player's speed; the siren wails while wanted.
    this.audio.setEngine(clamp(Math.abs(this.player.speed) / 30, 0, 1), this.player.inCar);
    this.audio.setSiren(this.police.wanted > 0);

    // Autosave every 20s, plus right after a mission pays out.
    if (this.time - this._autosaveAt > 20) {
      this._autosaveAt = this.time;
      this._save();
    }
    if (this._saveSoon) {
      this._saveSoon = false;
      this._save();
    }
    input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }
}
