// Solmar Heat — Game: state machine, third-person camera, arcade driving
// and on-foot movement, collisions, pickups, Spray Shop, beacons, and the
// runtime surface the tests read (window.__solmarHeat).
import * as THREE from "three";
import {
  CASH_PICKUPS,
  CASH_VALUE,
  GOLD_GT,
  LANDMARKS,
  MISSION_DEFS,
  PARKED_CARS,
  SPAWN,
  SPRAY_COST,
  TAXI_STAND,
  WORLD_HALF,
  clamp,
  dist2d,
  forwardOf,
  rightOf,
} from "./config.js";
import { City } from "./city.js";
import { Traffic, Car } from "./vehicles.js";
import { Pedestrians } from "./pedestrians.js";
import { Police } from "./police.js";
import { Missions } from "./missions.js";
import { Combat } from "./combat.js";
import { Hud } from "./hud.js";
import { AudioSys } from "./audio.js";
import { Input } from "./input.js";
import { Save } from "./save.js";

function spraySpot() {
  return LANDMARKS.find((l) => l.id === "spray");
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new Input(canvas);
    this.audio = new AudioSys();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8ec3e8);
    this.scene.fog = new THREE.Fog(0x9fc4de, 130, 420);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1000);
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x5a6a4a, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.7);
    sun.position.set(140, 190, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -210;
    sun.shadow.camera.right = 210;
    sun.shadow.camera.top = 210;
    sun.shadow.camera.bottom = -210;
    sun.shadow.camera.far = 600;
    this.scene.add(sun);

    const params = new URLSearchParams(window.location.search);
    this.seed = Number(params.get("seed") || 1);
    this.city = new City(this.scene, this.seed);
    this.traffic = new Traffic(this.scene, this.seed);
    this.pedestrians = new Pedestrians(this.scene, this.seed);
    this.police = new Police(this.scene, () => this.onBusted(), (x, z, n) => this.onRam(x, z, n));
    this.missions = new Missions(this);
    this.combat = new Combat(this);
    this.save = new Save();
    this.hud = new Hud(document.getElementById("hud-root"), this);

    this.player = { x: SPAWN.x, z: SPAWN.z, heading: SPAWN.heading, car: null };
    this.state = "menu";
    this.pickupCash = 0;
    this.sprayPaid = 0;
    this.fines = 0;
    this._goldSpawned = false;
    this._endKind = null;
    this._saveTimer = 0;
    this._runoverCooldown = 0;
    this._tracerTimer = 0;
    this._menuAngle = 0;
    this._camDist = 12;
    this._orbitYaw = 0;
    this.clock = new THREE.Clock();

    this.parkedCars = [];
    for (const p of PARKED_CARS) {
      const car = new Car(this.scene, p.color, p.x, p.z, p.sedan ? Math.PI / 2 : 0);
      car.isSedan = !!p.sedan;
      car.isGold = false;
      car.sync();
      this.parkedCars.push(car);
    }
    this.pickups = [];
    for (const p of CASH_PICKUPS) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 1.0, 0.5, 12),
        new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xaa8800, emissiveIntensity: 0.9 }),
      );
      mesh.position.set(p.x, 0.9, p.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.pickups.push({ ...p, taken: false, mesh });
    }
    const spray = spraySpot();
    const sprayRing = new THREE.Mesh(
      new THREE.RingGeometry(5.5, 7, 32),
      new THREE.MeshBasicMaterial({ color: 0x37d67a, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    sprayRing.rotation.x = -Math.PI / 2;
    sprayRing.position.set(spray.x, 0.08, spray.z);
    this.scene.add(sprayRing);
    const taxiBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 4.5, 10),
      new THREE.MeshStandardMaterial({ color: 0x2ad8d8, emissive: 0x118888, emissiveIntensity: 0.9, transparent: true, opacity: 0.75 }),
    );
    taxiBeacon.position.set(TAXI_STAND.x, 2.2, TAXI_STAND.z);
    this.scene.add(taxiBeacon);
    this._taxiBeacon = taxiBeacon;
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.25, 9, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.scene.add(this.beacon);
    this.beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(4.6, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.beaconRing);
    const tracerGeo = new THREE.BufferGeometry();
    tracerGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    this._tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
    this._tracer.visible = false;
    this.scene.add(this._tracer);

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  get money() {
    return this.missions.earned + this.pickupCash - this.sprayPaid - this.fines;
  }

  get health() {
    return this.combat.health;
  }

  get playerCarIsSedan() {
    return !!(this.player.car && this.player.car.isSedan);
  }

  get playerCarIsGold() {
    return !!(this.player.car && this.player.car.isGold);
  }

  playerPos() {
    return { x: this.player.x, z: this.player.z };
  }

  playerHeading() {
    return this.player.heading;
  }

  start() {
    this.hud.showMenu(this.save.has());
    this.clock.start();
    requestAnimationFrame(this._frame);
  }

  _frame = () => {
    const input = this.input;
    requestAnimationFrame(this._frame);
    const dt = Math.min(0.05, this.clock.getDelta());
    input.update();
    if (this.state === "menu") {
      this._menuCamera(dt);
      this.renderer.render(this.scene, this.camera);
      input.endFrame();
      return;
    }
    if (this.state === "paused") {
      this.renderer.render(this.scene, this.camera);
      input.endFrame();
      return;
    }
    if (this.state === "busted" || this.state === "wasted" || this.state === "win") {
      this.renderer.render(this.scene, this.camera);
      input.endFrame();
      return;
    }
    this._update(dt, input);
    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  };

  _menuCamera(dt) {
    this._menuAngle += dt * 0.045;
    const r = 135;
    this.camera.position.set(Math.cos(this._menuAngle) * r, 58, Math.sin(this._menuAngle) * r);
    this.camera.lookAt(0, 4, 0);
  }

  _update(dt, input) {
    if (input.pressed("Escape")) {
      this.state = "paused";
      this.hud.showPaused();
      return;
    }
    if (input.pressedKeys.size > 0 || input.clicked) this.audio.unlock();
    this._runoverCooldown = Math.max(0, this._runoverCooldown - dt);
    const p = this.player;

    if (p.car) this._driveCar(dt, input);
    else this._walk(dt, input);

    if (input.pressed("KeyE")) this._interact();
    if (input.pressed("KeyF")) this.combat.punch(p.x, p.z, p.heading);
    if (input.pressed("KeyT")) this.missions.tryStartTaxi(p.x, p.z);
    if (input.clicked) this.combat.shoot(p.x, p.z, p.heading);

    this._resolveCircle(p, p.car ? 2.3 : 0.9);
    p.x = clamp(p.x, -178, 178);
    p.z = clamp(p.z, -178, 178);
    if (p.car) {
      p.car.group.position.x = p.x;
      p.car.group.position.z = p.z;
    }

    this._carVsTraffic();
    this._carVsPeds();
    this._pickupsAndSpray();
    this.missions.update(dt, p.x, p.z, !!p.car, this.police.wanted);
    if (this.missions.index === 3 && !this._goldSpawned) this.spawnGoldGT();
    const speed = p.car ? Math.abs(p.car.speed) : input.axes.y !== 0 ? 5.5 : 0;
    this.police.update(dt, { x: p.x, z: p.z }, p.heading, !!p.car, speed);
    this.traffic.update(dt);
    this.pedestrians.update(dt, { x: p.x, z: p.z }, speed, this.police.wanted);
    this.combat.update(dt);
    this.audio.update(dt, p.car ? Math.abs(p.car.speed) / 30 : 0, this.police.wanted);
    this._updateBeacon();
    this._updateTracer(dt);
    this.hud.update(dt, this);
    this._updateCamera(dt, input);
    this._saveTimer += dt;
    if (this._saveTimer > 20) {
      this._saveTimer = 0;
      this.save.save(this);
    }
  }

  _walk(dt, input) {
    const p = this.player;
    p.heading -= input.axes.x * 2.6 * dt;
    const walk = input.sprint ? 9 : 5.5;
    const mv = input.axes.y * walk;
    const f = forwardOf(p.heading);
    p.x += f.x * mv * dt;
    p.z += f.z * mv * dt;
  }

  _driveCar(dt, input) {
    const car = this.player.car;
    const p = this.player;
    const ax = input.axes;
    if (ax.y > 0) car.speed += 16 * dt;
    else if (ax.y < 0) car.speed -= (car.speed > 0.5 ? 26 : 10) * dt;
    else car.speed -= Math.sign(car.speed) * 8 * dt;
    if (input.handbrake) car.speed -= Math.sign(car.speed) * 22 * dt;
    car.speed = clamp(car.speed, -9, 30);
    if (Math.abs(car.speed) < 0.05 && ax.y === 0) car.speed = 0;
    const factor = 1 - Math.min(0.55, (Math.abs(car.speed) / 30) * 0.55);
    car.heading -= ax.x * 1.9 * dt * factor * Math.sign(car.speed);
    const f = forwardOf(car.heading);
    car.group.position.x += f.x * car.speed * dt;
    car.group.position.z += f.z * car.speed * dt;
    car.sync();
    p.x = car.group.position.x;
    p.z = car.group.position.z;
    p.heading = car.heading;
  }

  _resolveCircle(pos, radius) {
    for (const c of this.city.colliders) {
      const cx0 = (c.xmin + c.xmax) / 2;
      const cz0 = (c.zmin + c.zmax) / 2;
      if (Math.abs(cx0 - pos.x) > 30 || Math.abs(cz0 - pos.z) > 30) continue;
      const cx = clamp(pos.x, c.xmin, c.xmax);
      const cz = clamp(pos.z, c.zmin, c.zmax);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        const pl = pos.x - c.xmin;
        const pr = c.xmax - pos.x;
        const pt = pos.z - c.zmin;
        const pb = c.zmax - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.xmin - radius;
        else if (m === pr) pos.x = c.xmax + radius;
        else if (m === pt) pos.z = c.zmin - radius;
        else pos.z = c.zmax + radius;
      }
      if (this.player.car) this.player.car.speed *= 0.55;
    }
  }

  _carVsTraffic() {
    const p = this.player;
    if (!p.car) return;
    for (const c of this.traffic.cars) {
      const d = dist2d(p.x, p.z, c.x, c.z);
      if (d < 4.4 && d > 0.01) {
        const push = (4.4 - d) / 2;
        const nx = (p.x - c.x) / d;
        const nz = (p.z - c.z) / d;
        p.x += nx * push;
        p.z += nz * push;
        p.car.speed *= 0.7;
        c.group.position.x -= nx * push;
        c.group.position.z -= nz * push;
      }
    }
  }

  _carVsPeds() {
    const p = this.player;
    if (!p.car || this._runoverCooldown > 0) return;
    const { walker, dist } = this.pedestrians.nearest(p.x, p.z, 2.6);
    if (walker && dist < 2.6) {
      this.pedestrians.knockback(walker, p.x, p.z, 8);
      this._runoverCooldown = 1.5;
      this.player.car.speed *= 0.6;
      this.addWanted(1);
      this.toast("You ran someone over — the heat is on");
    }
  }

  _pickupsAndSpray() {
    const p = this.player;
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      pk.mesh.rotation.y += 0.02;
      if (dist2d(p.x, p.z, pk.x, pk.z) < 3.4) {
        pk.taken = true;
        pk.mesh.visible = false;
        this.pickupCash += CASH_VALUE;
        this.audio.pickup();
        this.toast(`Cash pickup +$${CASH_VALUE}`);
      }
    }
    const spray = spraySpot();
    if (p.car && this.police.wanted > 0 && dist2d(p.x, p.z, spray.x, spray.z) < 7) {
      if (this.money >= SPRAY_COST) {
        this.sprayPaid += SPRAY_COST;
        this.police.clearWanted();
        this.audio.jingle();
        this.toast(`Spray Shop −$${SPRAY_COST} — wanted cleared`);
      } else {
        this.toast(`Spray Shop needs $${SPRAY_COST} — you are short`);
        this.audio.denied();
      }
    }
  }

  _interact() {
    const p = this.player;
    if (p.car) {
      const car = p.car;
      const r = rightOf(p.heading);
      p.car = null;
      p.x = car.group.position.x + r.x * 2.4;
      p.z = car.group.position.z + r.z * 2.4;
      this.parkedCars.push(car);
      return;
    }
    let best = null;
    let bestD = 3.6;
    for (const car of this.parkedCars) {
      const d = dist2d(p.x, p.z, car.x, car.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    const near = this.traffic.nearest(p.x, p.z, 3.6);
    if (near.car && near.dist < bestD) {
      best = near.car;
      bestD = near.dist;
    }
    if (best) {
      if (this.traffic.cars.includes(best)) this.traffic.removeCar(best);
      else {
        const i = this.parkedCars.indexOf(best);
        if (i >= 0) this.parkedCars.splice(i, 1);
      }
      p.car = best;
      best.stolen = true;
      p.x = best.x;
      p.z = best.z;
      p.heading = best.heading;
      this.addWanted(1);
      this.audio.unlock();
      this.toast(best.isGold ? "The gold Marlin GT is yours — run!" : best.isSedan ? "Red sedan stolen — the Marlin Club will be pleased" : "Car stolen — the cops noticed");
      return;
    }
    if (this.missions.tryStartTaxi(p.x, p.z)) return;
    this.toast("Nothing to enter here");
  }

  spawnPlayerCar(color, x, z, heading) {
    const car = new Car(this.scene, color, x, z, heading);
    car.isSedan = false;
    car.isGold = false;
    car.sync();
    this.player.car = car;
    this.player.x = x;
    this.player.z = z;
    this.player.heading = heading;
    return car;
  }

  spawnGoldGT() {
    if (this._goldSpawned) return;
    this._goldSpawned = true;
    const car = new Car(this.scene, 0xe8b84b, GOLD_GT.x, GOLD_GT.z, Math.PI / 2);
    car.isGold = true;
    car.isSedan = false;
    car.sync();
    this.parkedCars.push(car);
  }

  teleport(x, z, heading) {
    const p = this.player;
    p.x = x;
    p.z = z;
    if (heading !== undefined) p.heading = heading;
    if (p.car) {
      p.car.group.position.x = x;
      p.car.group.position.z = z;
      if (heading !== undefined) {
        p.car.heading = heading;
        p.car.sync();
      }
    }
  }

  setWanted(n) {
    this.police.setWanted(n, { x: this.player.x, z: this.player.z });
  }

  addWanted(n) {
    this.police.addWanted(n, { x: this.player.x, z: this.player.z });
  }

  unlockPistol() {
    this.combat.unlockPistol();
  }

  toast(msg) {
    this.hud.toast(msg);
  }

  nearestPolice(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of this.police.policeCars) {
      const d = dist2d(x, z, car.x, car.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  damagePoliceCar(car) {
    const p = this.player;
    const a = Math.atan2(car.x - p.x, car.z - p.z);
    const f = forwardOf(a);
    car.group.position.x += f.x * 4;
    car.group.position.z += f.z * 4;
    car.heading += 0.9;
    car.sync();
  }

  showTracer(px, pz, heading) {
    const f = forwardOf(heading);
    const pos = this._tracer.geometry.attributes.position;
    pos.setXYZ(0, px, 1.4, pz);
    pos.setXYZ(1, px + f.x * 42, 1.4, pz + f.z * 42);
    pos.needsUpdate = true;
    this._tracer.visible = true;
    this._tracerTimer = 0.09;
  }

  onRam(px, pz, n) {
    const p = this.player;
    if (p.car) {
      p.car.speed *= 0.55;
      p.x += px * 1.2;
      p.z += pz * 1.2;
      p.car.group.position.x = p.x;
      p.car.group.position.z = p.z;
    } else {
      p.x += px * 1.6;
      p.z += pz * 1.6;
    }
    this.combat.hurt(n);
  }

  onBusted() {
    if (this.state !== "playing") return;
    this.state = "busted";
    this.fines += 50;
    this._endKind = "busted";
    this.audio.busted();
    this.hud.showEnd("busted", "BUSTED", "The Solmar Bay PD caught up with you. Fine: $50.", "Pay the fine and walk free");
  }

  onWasted() {
    if (this.state !== "playing") return;
    this.state = "wasted";
    this.fines += 75;
    this._endKind = "wasted";
    this.audio.busted();
    this.hud.showEnd("wasted", "WASTED", "You got wasted on the streets of Solmar Bay. Clinic bill: $75.", "Wake up at the clinic");
  }

  onWin() {
    if (this.state !== "playing") return;
    this.state = "win";
    this._endKind = "win";
    this.audio.jingle();
    this.save.save(this);
    this.hud.showEnd("win", "SOLMAR LEGEND", `Debt paid in full. Dana “Dash” Reyes is free — $${Math.floor(this.money)} in the pocket.`, "Keep driving");
  }

  onMissionComplete(i) {
    const def = MISSION_DEFS[i];
    this.toast(`Mission complete: ${def.title} +$${def.reward}`);
    if (i === 1) this.setWanted(3);
    this.audio.jingle();
    this.save.save(this);
  }

  _updateBeacon() {
    const m = this.missions.marker();
    const vis = !!m && this.state === "playing";
    this.beacon.visible = vis;
    this.beaconRing.visible = vis;
    if (m) {
      const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.14;
      this.beacon.position.set(m.x, 4.5, m.z);
      this.beacon.scale.set(pulse, 1, pulse);
      this.beaconRing.position.set(m.x, 0.09, m.z);
    }
    this._taxiBeacon.visible = !this.missions.taxi.active && this.state === "playing";
  }

  _updateTracer(dt) {
    if (this._tracerTimer > 0) {
      this._tracerTimer -= dt;
      if (this._tracerTimer <= 0) this._tracer.visible = false;
    }
  }

  _updateCamera(dt, input) {
    this._orbitYaw = clamp(this._orbitYaw + input.orbitDelta, -1.3, 1.3);
    this._orbitYaw *= Math.max(0, 1 - dt * 0.3);
    this._camDist = clamp(this._camDist + input.zoomDelta * 1.5, 6, 18);
    const p = this.player;
    const dist = p.car ? this._camDist : Math.min(this._camDist, 10);
    const height = 4.2 + dist * 0.34;
    const f = forwardOf(p.heading + this._orbitYaw);
    const dx = p.x - f.x * dist;
    const dz = p.z - f.z * dist;
    const k = 1 - Math.pow(0.0001, dt);
    this.camera.position.x += (dx - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (dz - this.camera.position.z) * k;
    this.camera.lookAt(p.x + f.x * 5, 1.6, p.z + f.z * 5);
  }

  startNew() {
    for (const c of this.traffic.cars) c.remove();
    for (const c of this.parkedCars) c.remove();
    if (this.player.car) this.player.car.remove();
    this.traffic = new Traffic(this.scene, this.seed);
    this.parkedCars = [];
    for (const p of PARKED_CARS) {
      const car = new Car(this.scene, p.color, p.x, p.z, p.sedan ? Math.PI / 2 : 0);
      car.isSedan = !!p.sedan;
      car.isGold = false;
      car.sync();
      this.parkedCars.push(car);
    }
    this.police.clearWanted();
    this.missions.reset();
    this.combat.reset();
    this.pickupCash = 0;
    this.sprayPaid = 0;
    this.fines = 0;
    this._goldSpawned = false;
    this._endKind = null;
    this._saveTimer = 0;
    for (const pk of this.pickups) {
      pk.taken = false;
      pk.mesh.visible = true;
    }
    this.player.x = SPAWN.x;
    this.player.z = SPAWN.z;
    this.player.heading = SPAWN.heading;
    this.player.car = null;
    this.state = "playing";
    this.hud.showPlaying();
    this.audio.unlock();
    this.save.clear();
  }

  continueSaved() {
    const data = this.save.load();
    if (!data) {
      this.startNew();
      return;
    }
    this.startNew();
    this.missions.setDone(data.done);
    this.missions.bonus = data.bonus || 0;
    this.missions.earned = this.missions._missionSum() + this.missions.bonus;
    this.combat.health = data.health ?? 100;
    this.combat.pistol = !!data.pistol;
    this.pickupCash = data.pickupCash || 0;
    this.sprayPaid = data.sprayPaid || 0;
    this.fines = data.fines || 0;
    (data.taken || []).forEach((t, i) => {
      if (t && this.pickups[i]) {
        this.pickups[i].taken = true;
        this.pickups[i].mesh.visible = false;
      }
    });
    this.teleport(data.x ?? SPAWN.x, data.z ?? SPAWN.z, data.heading ?? SPAWN.heading);
    this.toast("Save loaded — welcome back to Solmar Bay");
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.hud.showPlaying();
  }

  toMenu() {
    this.state = "menu";
    this.hud.showMenu(this.save.has());
  }

  afterEnd() {
    if (this._endKind === "win") {
      this._endKind = null;
      this.hud.hideEnd();
      this.state = "playing";
      this.hud.showPlaying();
      return;
    }
    const kind = this._endKind;
    this._endKind = null;
    if (this.player.car) {
      this.parkedCars.push(this.player.car);
      this.player.car = null;
    }
    this.teleport(SPAWN.x, SPAWN.z, SPAWN.heading);
    if (kind === "wasted") this.combat.health = 60;
    this.police.clearWanted();
    this.hud.hideEnd();
    this.state = "playing";
    this.hud.showPlaying();
  }
}
