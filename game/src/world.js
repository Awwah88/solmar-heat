// Game: state machine, player + car movement, collisions, pickups, spray
// shop, wanted integration, camera, autosave. This is the object the HUD,
// the screenshots and the smoke test all drive through window.__solmarHeat.
import * as THREE from 'three';
import { GRID, LANDMARKS, SPAWN, TUNING, clamp, wrapAngle } from './config.js';
import { City } from './city.js';
import { Traffic, buildCar } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { AudioBus } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { applyShot } from './shots.js';

const CASH_SPOTS = [
  [54, -126], [-54, -18], [126, 54], [-126, -90],
  [18, 126], [-18, -126], [90, 18], [-90, 90],
];

export class Game {
  constructor(opts) {
    this.scene = opts.scene;
    this.camera = opts.camera;
    this.renderer = opts.renderer;
    this.input = opts.input;
    this.audio = new AudioBus();
    this.seed = opts.seed || 7;
    this.state = 'menu';
    this.time = 0;
    this.playTime = 0;
    this._money = 0;
    this._lastDamageAt = -999;
    this._saveTimer = 0;
    this._crashCooldown = 0;
    this._sprayPromptAt = -999;
    this._danger = null;
    this._camYaw = 0;
    this._camDist = 13;
    this._camPos = new THREE.Vector3(0, 60, 180);
    this.player = { x: SPAWN.x, z: SPAWN.z, heading: SPAWN.heading, car: null, walkSpeed: 0 };

    this.city = new City(this.scene, this.seed);
    this.traffic = new Traffic(this.scene, this.city, this.seed + 4);
    this.pedestrians = new Pedestrians(this.scene, this.city, this.seed + 8);
    this.police = new Police(this.scene, this.city, this.seed + 12);
    this.combat = new Combat();
    this.parked = [];
    this.looseCars = [];
    this._makeParkedCars();
    this._makeCashPickups();
    this.missions = new Missions({
      award: (n) => { this._money += n; this._saveSoon(); },
      toast: (msg) => this.hud.toast(msg),
      jingle: () => this.audio.missionDone(),
      blip: () => this.audio.pickup(),
      setWanted: (n) => this.police.setWanted(n, this.player),
      grantPistol: () => { this.combat.hasPistol = true; this.hud.toast('Pistol unlocked — click to shoot, F to punch'); },
      onWin: () => this._win(),
    });
    this.hud = new Hud({
      onStart: (cont) => this.startNewGame(cont),
      onResume: () => this._pause(false),
      onQuitToMenu: () => this._toMenu(),
      onEndButton: () => this._afterEnd(),
      hasSave: () => hasSave(),
    });
    this.hud.show('menu');
    this.hud.setMoney(0);
    this.hud.setHealth(100);
    this.hud.setWanted(0);
    this.hud.setObjective(STORY_INTRO);
    // Staged screenshot? Apply it now, before the first rendered frame.
    const params = new URLSearchParams(window.location.search);
    this.shot = applyShot(this, params);
  }

  // ---- public API used by the HUD, screenshots and tests ----
  get money() { return this._money; }
  get health() { return this.combat.health; }

  get api() {
    const self = this;
    return {
      get state() { return self.state; },
      get money() { return self._money; },
      get health() { return self.combat.health; },
      player: self.player,
      playerPos: () => ({ x: self.player.x, z: self.player.z }),
      playerHeading: () => self.player.heading,
      traffic: self.traffic,
      police: self.police,
      missions: self.missions,
      city: self.city,
      renderer: self.renderer,
      scene: self.scene,
      camera: self.camera,
    };
  }

  setMoney(n) { this._money = n; }

  teleport(x, z, heading) {
    this.player.x = x;
    this.player.z = z;
    if (heading !== undefined) this.player.heading = heading;
    if (this.player.car) {
      this.player.car.group.position.set(x, 0, z);
      this.player.car.angle = heading;
      this.player.car.group.rotation.y = heading;
    }
    this._snapCamera();
  }

  putPlayerInCarAt(x, z, angle, color) {
    const car = buildCar(color, { kind: 'player' });
    car.group.position.set(x, 0, z);
    car.angle = angle;
    car.group.rotation.y = angle;
    this.scene.add(car.group);
    this._enterCar(car);
    return car;
  }

  startNewGame(fromSave) {
    const saved = fromSave ? loadGame() : null;
    this._money = 0;
    this.combat = new Combat();
    this.police.clear(this.player);
    this.missions = new Missions(this.missions.hooks);
    this.player.car = null;
    this.player.x = SPAWN.x;
    this.player.z = SPAWN.z;
    this.player.heading = SPAWN.heading;
    this.playTime = 0;
    if (saved) {
      this._money = saved.money;
      this.combat.health = saved.health;
      this.combat.hasPistol = !!saved.pistol;
      this.player.x = saved.x;
      this.player.z = saved.z;
      this.player.heading = saved.heading;
      this.missions.setDone(saved.done || []);
      this.police.setWanted(saved.wanted || 0, this.player);
      this.hud.toast('Save loaded — welcome back to Solmar');
    } else {
      this.missions.startMission('m1');
      this.hud.toast('Mission 1: Hot Wheels — steal the red sedan at Marina Garage');
    }
    this.audio.unlock();
    this.state = 'playing';
    this.hud.show('hud');
    this._syncHud();
    this._snapCamera();
  }

  // ---- per-frame ----
  frame(dt) {
    const input = this.input;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    if (this.state === 'menu') {
      this._menuCamera(dt);
      this.traffic.update(dt, null);
      this.pedestrians.update(dt, null, null);
      input.endFrame();
      return;
    }
    if (this.state !== 'playing') {
      input.endFrame();
      return;
    }
    this.playTime += dt;
    this._saveTimer += dt;
    this._crashCooldown = Math.max(0, this._crashCooldown - dt);
    if (input.consume('Escape')) { this._pause(true); input.endFrame(); return; }

    const axes = input.axes;
    if (this.player.car) this._driveCar(dt, axes, input);
    else this._walk(dt, axes, input);
    this._interact(input);
    this._combatKeys(input);
    this.traffic.update(dt, this.player);
    this.pedestrians.update(dt, this.player, this._danger && this.time < this._danger.until ? this._danger : null);
    this.police.update(dt, this.player, {
      onRam: (d) => this._onRam(d),
      onBusted: () => this._busted(),
    });
    this.missions.update(dt, { player: this.player, police: this.police });
    this.missions.updateTaxi(dt, { player: this.player, police: this.police });
    this.combat.update(dt);
    this._pickups(dt);
    this._regen(dt);
    this._updateCamera(dt, input);
    this._syncHud();
    this.audio.setEngine(this.player.car ? this.player.car.speed : 0, TUNING.carMaxSpeed);
    this.audio.setSiren(this.police.wanted >= 2);
    if (this._saveTimer > 15) { this._saveTimer = 0; this._saveSoon(); }
    input.endFrame();
  }
}

const STORY_INTRO = 'Dana "Dash" Reyes owes the Marlin Club $400. Four jobs stand between her and freedom.';

Game.prototype._makeParkedCars = function () {
  const defs = [
    { x: 154, z: -126, angle: Math.PI / 2, color: 0xd23b2e, isRed: true },
    { x: 46, z: -18, angle: Math.PI / 2, color: 0xd4af37, isGold: true },
    { x: -54, z: 118, angle: 0, color: 0x3b82f6 },
    { x: 126, z: -60, angle: Math.PI, color: 0x22c55e },
    { x: 18, z: 60, angle: 0, color: 0xe5e7eb },
  ];
  for (const d of defs) {
    const car = buildCar(d.color, { kind: 'parked' });
    car.group.position.set(d.x, 0, d.z);
    car.angle = d.angle;
    car.group.rotation.y = d.angle;
    car.isRed = !!d.isRed;
    car.isGold = !!d.isGold;
    this.scene.add(car.group);
    this.parked.push(car);
  }
};

Game.prototype._makeCashPickups = function () {
  this.pickups = [];
  const geo = new THREE.CylinderGeometry(0.9, 0.9, 0.25, 12);
  const mat = new THREE.MeshLambertMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.45 });
  for (const [x, z] of CASH_SPOTS) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.5, z);
    this.scene.add(mesh);
    this.pickups.push({ x, z, mesh, taken: false, timer: 0 });
  }
};

Game.prototype._walk = function (dt, axes, input) {
  const p = this.player;
  // A turns left: heading increases by -axes.x * turn * dt.
  p.heading -= axes.x * TUNING.turnSpeed * dt;
  const speed = (axes.y > 0 ? (input.sprint ? TUNING.sprintSpeed : TUNING.walkSpeed) : 0)
    + (axes.y < 0 ? -TUNING.walkSpeed * 0.6 : 0);
  p.walkSpeed = speed;
  const nx = p.x + Math.sin(p.heading) * speed * dt;
  const nz = p.z + Math.cos(p.heading) * speed * dt;
  const fixed = this.city.resolveCircle(nx, nz, TUNING.playerRadius);
  p.x = fixed.x;
  p.z = fixed.z;
};

Game.prototype._driveCar = function (dt, axes, input) {
  const car = this.player.car;
  const p = this.player;
  if (axes.y > 0) car.speed += TUNING.carAccel * dt;
  else if (axes.y < 0) {
    if (car.speed > 0.5) car.speed -= TUNING.carBrake * dt;
    else car.speed -= TUNING.carAccel * 0.6 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  if (input.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
  car.speed = clamp(car.speed, -TUNING.carReverseMax, TUNING.carMaxSpeed);
  // Steering follows the same rule as on foot: A increases the angle.
  const turnAuthority = Math.min(1, Math.abs(car.speed) / 6);
  car.angle -= axes.x * TUNING.carTurn * dt * turnAuthority * Math.sign(car.speed || 1);
  const nx = car.group.position.x + Math.sin(car.angle) * car.speed * dt;
  const nz = car.group.position.z + Math.cos(car.angle) * car.speed * dt;
  const fixed = this.city.resolveCircle(nx, nz, TUNING.carRadius);
  if (fixed.hit && Math.abs(car.speed) > 4) {
    if (this._crashCooldown <= 0) {
      this._crashCooldown = 0.6;
      this.audio.crash();
      car.speed *= 0.55;
    }
  }
  car.group.position.x = fixed.x;
  car.group.position.z = fixed.z;
  car.group.rotation.y = car.angle;
  for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.42;
  // Bump into traffic: shove apart, lose speed.
  for (const other of this.traffic.cars) {
    const dx = car.group.position.x - other.group.position.x;
    const dz = car.group.position.z - other.group.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.2 && d > 0.01) {
      car.group.position.x += (dx / d) * (4.2 - d) * 0.5;
      car.group.position.z += (dz / d) * (4.2 - d) * 0.5;
      if (Math.abs(car.speed) > 6 && this._crashCooldown <= 0) {
        this._crashCooldown = 0.7;
        this.audio.crash();
        car.speed *= 0.6;
      }
    }
  }
  p.x = car.group.position.x;
  p.z = car.group.position.z;
  p.heading = car.angle;
};

Game.prototype._enterCar = function (car) {
  this.traffic.remove(car);
  const pi = this.parked.indexOf(car);
  if (pi >= 0) this.parked.splice(pi, 1);
  const li = this.looseCars.indexOf(car);
  if (li >= 0) this.looseCars.splice(li, 1);
  this.player.car = car;
  car.kind = 'player';
  this.player.x = car.group.position.x;
  this.player.z = car.group.position.z;
  this.player.heading = car.angle;
  this.audio.setEngine(0, TUNING.carMaxSpeed);
};

Game.prototype._exitCar = function () {
  const car = this.player.car;
  if (!car) return;
  car.speed = 0;
  this.looseCars.push(car);
  this.player.car = null;
  const back = { x: -Math.sin(car.angle), z: -Math.cos(car.angle) };
  const side = { x: -Math.cos(car.angle), z: Math.sin(car.angle) };
  this.player.x = car.group.position.x + side.x * 2.4;
  this.player.z = car.group.position.z + side.z * 2.4;
  this.player.heading = car.angle;
};

Game.prototype._nearestCar = function (maxD) {
  let best = null;
  let bestD = maxD;
  const consider = (car) => {
    const dx = car.group.position.x - this.player.x;
    const dz = car.group.position.z - this.player.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD) { bestD = d; best = car; }
  };
  for (const car of this.traffic.cars) consider(car);
  for (const car of this.parked) consider(car);
  for (const car of this.looseCars) consider(car);
  return best ? { car: best, dist: bestD } : null;
};

Game.prototype._interact = function (input) {
  if (!input.consume('KeyE')) return;
  const p = this.player;
  if (p.car) {
    // Spray shop: fresh paint clears the wanted level for $75.
    const spray = LANDMARKS.find((l) => l.id === 'spray');
    const dx = p.x - spray.marker[0];
    const dz = p.z - spray.marker[1];
    if (dx * dx + dz * dz < 9 * 9 && this.police.wanted > 0) {
      if (this._money >= TUNING.sprayCost) {
        this._money -= TUNING.sprayCost;
        this.police.clear(p);
        this.audio.cash();
        this.hud.toast('Fresh paint, clean slate. -$75');
      } else {
        this.hud.toast('Spray Shop wants $75 — you are short.');
      }
      return;
    }
    this._exitCar();
    return;
  }
  const near = this._nearestCar(3.6);
  if (near) {
    this._enterCar(near.car);
    this.police.commitCrime(1, p);
    this.missions.checkEnterCar(near.car);
    this.hud.toast(near.car.isRed ? 'Nice — the red sedan is yours.' : near.car.isGold ? 'The gold Marlin GT. Drive like they are watching.' : 'Car stolen — the cops noticed (+1 star).');
  }
};

Game.prototype._combatKeys = function (input) {
  if (input.consume('KeyF') || (this.combat.hasPistol && false)) {
    const hit = this.combat.punch(this.player, this.pedestrians);
    if (hit && hit.kind === 'ped') {
      this.audio.punch();
      this.police.commitCrime(1, this.player);
      this.hud.toast('That pedestrian will remember this (+1 star).');
    } else {
      this.audio.punch();
    }
  }
  if (this.combat.hasPistol && input.consume('Mouse0') && !this.player.car) {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const origin = { x: this.player.x, z: this.player.z };
    const hit = this.combat.shoot(origin, { x: dir.x, z: dir.z }, this.pedestrians, this.police.policeCars);
    this.audio.shot();
    this._danger = { x: this.player.x, z: this.player.z, until: this.time + 2 };
    if (hit) {
      this.police.commitCrime(1, this.player);
      if (hit.kind === 'ped') this.hud.toast('Shot fired — the cops are coming (+1 star).');
    }
  }
  if (input.consume('KeyQ') && this.combat.hasPistol) {
    this.hud.toast('Pistol ready — click to shoot.');
  }
};

Game.prototype._pickups = function (dt) {
  for (const pk of this.pickups) {
    if (pk.taken) {
      pk.timer -= dt;
      if (pk.timer <= 0) {
        pk.taken = false;
        pk.mesh.visible = true;
      }
      continue;
    }
    const dx = this.player.x - pk.x;
    const dz = this.player.z - pk.z;
    if (dx * dx + dz * dz < 2.6 * 2.6) {
      pk.taken = true;
      pk.timer = 60;
      pk.mesh.visible = false;
      this._money += TUNING.cashPickup;
      this.audio.cash();
      this.hud.toast(`Cash pickup +$${TUNING.cashPickup}`);
    }
  }
};

Game.prototype._regen = function (dt) {
  if (this.time - this._lastDamageAt > 8 && this.police.wanted === 0 && this.combat.health < this.combat.maxHealth) {
    this.combat.heal(1.5 * dt);
  }
};

Game.prototype._onRam = function () {
  this._lastDamageAt = this.time;
  this.audio.crash();
  const wasted = this.combat.damage(9);
  if (this.player.car) this.player.car.speed *= 0.6;
  this.hud.toast('Police ram! Health -9');
  if (wasted) this._wasted();
};

Game.prototype._busted = function () {
  if (this.state !== 'playing') return;
  this.state = 'busted';
  this._money = Math.max(0, this._money - TUNING.bustedFine);
  this.police.clear(this.player);
  this.audio.busted();
  this.audio.setSiren(false);
  this.hud.showEnd('busted', `The Solmar PD caught up with you.<br>Bail: $${TUNING.bustedFine} &nbsp;·&nbsp; Money left: $${Math.floor(this._money)}`);
};

Game.prototype._wasted = function () {
  if (this.state !== 'playing') return;
  this.state = 'wasted';
  this._money = Math.max(0, this._money - TUNING.wastedFine);
  this.police.clear(this.player);
  this.audio.busted();
  this.audio.setSiren(false);
  this.hud.showEnd('wasted', `Dash is down — the streets of Solmar are unforgiving.<br>Hospital bill: $${TUNING.wastedFine} &nbsp;·&nbsp; Money left: $${Math.floor(this._money)}`);
};

Game.prototype._win = function () {
  if (this.state !== 'playing') return;
  this.state = 'win';
  this.police.clear(this.player);
  this.audio.setSiren(false);
  const mins = Math.floor(this.playTime / 60);
  const secs = Math.floor(this.playTime % 60);
  this.hud.showEnd('win', `All four jobs done. The Marlin Club is paid.<br>Money: $${Math.floor(this._money)} &nbsp;·&nbsp; Time: ${mins}:${String(secs).padStart(2, '0')}<br>Dana "Dash" Reyes is a Solmar Legend.`);
  this._saveSoon();
};

Game.prototype._afterEnd = function () {
  if (this.state === 'win') {
    this.startNewGame(false);
    return;
  }
  // Busted / wasted: back on your feet at the Safehouse, clean slate.
  const safe = LANDMARKS.find((l) => l.id === 'safehouse');
  this.combat.health = 100;
  this.player.car = null;
  this.teleport(safe.marker[0], safe.marker[1], Math.PI / 2);
  this.state = 'playing';
  this.hud.show('hud');
  this.hud.toast('Back on your feet at the Safehouse. Stay sharp.');
  this._syncHud();
};

Game.prototype._pause = function (on) {
  if (on && this.state === 'playing') {
    this.state = 'paused';
    this.hud.show('pause');
  } else if (!on && this.state === 'paused') {
    this.state = 'playing';
    this.hud.show('hud');
  }
};

Game.prototype._toMenu = function () {
  this.state = 'menu';
  this.police.clear(this.player);
  this.audio.setSiren(false);
  this.hud.show('menu');
};

Game.prototype._saveSoon = function () {
  saveGame({
    money: this._money,
    health: this.combat.health,
    done: this.missions.list.filter((m) => m.done).map((m) => m.id),
    pistol: this.combat.hasPistol,
    x: this.player.x,
    z: this.player.z,
    heading: this.player.heading,
    wanted: this.police.wanted,
  });
};

Game.prototype._syncHud = function () {
  this.hud.setMoney(this._money);
  this.hud.setHealth(this.combat.health);
  this.hud.setWanted(this.police.wanted);
  this.hud.setObjective(this.missions.objective().text);
  this.hud.setSpeed(this.player.car ? this.player.car.speed : 0, !!this.player.car);
  this.hud.setPistol(this.combat.hasPistol);
  this.hud.setMissions(this.missions.doneCount, this.missions.list.length);
  this.hud.drawMinimap(this);
};

Game.prototype._menuCamera = function (dt) {
  const a = this.time * 0.045;
  const r = 215;
  this.camera.position.set(Math.sin(a) * r, 95, Math.cos(a) * r);
  this.camera.lookAt(0, 0, 0);
};

Game.prototype._snapCamera = function () {
  const p = this.player;
  const dist = p.car ? 13 : 8.5;
  const h = p.car ? 6 : 4.5;
  this._camPos.set(
    p.x - Math.sin(p.heading) * dist,
    h,
    p.z - Math.cos(p.heading) * dist,
  );
  this.camera.position.copy(this._camPos);
  this.camera.lookAt(p.x + Math.sin(p.heading) * 5, 1.6, p.z + Math.cos(p.heading) * 5);
};

Game.prototype._updateCamera = function (dt, input) {
  const p = this.player;
  this._camYaw += input.dragX * 0.004;
  this._camDist = clamp(this._camDist + input.wheel * 1.5, 8, 20);
  const heading = p.heading + this._camYaw;
  const dist = p.car ? this._camDist : 8.5;
  const height = p.car ? 6 : 4.5;
  const tx = p.x - Math.sin(heading) * dist;
  const tz = p.z - Math.cos(heading) * dist;
  const k = 1 - Math.exp(-7 * dt);
  this._camPos.x += (tx - this._camPos.x) * k;
  this._camPos.y += (height - this._camPos.y) * k;
  this._camPos.z += (tz - this._camPos.z) * k;
  this.camera.position.copy(this._camPos);
  this.camera.lookAt(p.x + Math.sin(p.heading) * 5, 1.6, p.z + Math.cos(p.heading) * 5);
};
