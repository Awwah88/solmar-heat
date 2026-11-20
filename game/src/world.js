// Solmar Heat — Game: state machine, camera, movement, collisions (Round 17).
// Dusk setting: low warm sun, lamps on, working headlights on the player's
// car. The player drives/walks on the road grid; buildings are solid,
// the Spray Shop clears wanted automatically in a car, and going down
// respawns at the Marina.
import * as THREE from 'three';
import { City } from './city.js';
import { Traffic, Parked, driveCar } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { SaveSys } from './save.js';
import { Shots } from './shots.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { SPAWN, LANDMARKS, PARKED, RACES, TUNING, clamp, dist2d } from './config.js';

export class Game {
  constructor() {
    this.state = 'menu';
    this.money = 0;
    this.health = 100;
    this.downTimer = 0;
    this.menuOrbit = false;
    this.time = 0;
    this._saveTimer = 0;
    this._sprayCooldown = 0;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x3b2f4a);
    this.scene.fog = new THREE.Fog(0x3b2f4a, 120, 420);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(120, 60, 120);

    // Dusk lighting: low warm sun + cool ambient so neon and headlights read.
    const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
    sun.position.set(-120, 70, -80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0x8a6a9a, 0x2a2118, 0.85));
    const fill = new THREE.DirectionalLight(0x6a7ab8, 0.35);
    fill.position.set(100, 60, 120);
    this.scene.add(fill);

    this.input = new Input();
    this.audio = new AudioSys();
    this.city = new City(this.scene);
    this.traffic = new Traffic(this.scene, this.city);
    this.parked = new Parked(this.scene);
    this.parked.placeAll([
      { key: 'red', ...PARKED.red, heading: 0 },
      { key: 'gold', ...PARKED.gold, heading: Math.PI / 2 },
      { key: 'limo', ...PARKED.limo, heading: Math.PI / 2 },
      { key: 'van', ...PARKED.van, heading: 0 },
    ]);
    this.pedestrians = new Pedestrians(this.scene, this.city);
    this.police = new Police(this.scene, this.city);
    this.combat = new Combat(this);
    this.missions = new Missions(this);
    this.hud = new Hud(this);
    this.saveSys = new SaveSys(this);
    this.shots = new Shots(this);

    // Player avatar (visible on foot, hidden in a car).
    this.player = { x: SPAWN.x, z: SPAWN.z, heading: Math.PI, car: null, mesh: null };
    const pmesh = new THREE.Group();
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 1.1, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x274b73, roughness: 0.85 }),
    );
    torso.position.y = 1.05;
    torso.castShadow = true;
    pmesh.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.8 }),
    );
    head.position.y = 1.9;
    pmesh.add(head);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.75, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x1c1e26, roughness: 1 }),
    );
    legs.position.y = 0.38;
    pmesh.add(legs);
    pmesh.position.set(this.player.x, 0, this.player.z);
    this.scene.add(pmesh);
    this.player.mesh = pmesh;

    // Headlight spotlight for the player's car (off until driving).
    this.headlight = new THREE.SpotLight(0xffe9b0, 0, 70, 0.55, 0.45, 1.2);
    this.headlightTarget = new THREE.Object3D();
    this.scene.add(this.headlightTarget);
    this.headlight.target = this.headlightTarget;
    this.scene.add(this.headlight);

    this.hud.showMenu();
    this._last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;
      this._frame(dt);
    };
    requestAnimationFrame(loop);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  playerPos() {
    return { x: this.player.x, z: this.player.z };
  }

  playerHeading() {
    return this.player.heading;
  }

  setWanted(n) {
    this.police.setWanted(n);
  }

  startGame() {
    this.audio.ensure();
    const saved = this.saveSys.load();
    if (saved) this.saveSys.apply(saved);
    else this.missions.startMission(1);
    this.state = 'playing';
    this.menuOrbit = false;
    this.hud.showPlaying();
    this.hud.setObjective(this.missions.objective());
    this.hud.toast('Welcome to Solmar Bay — Dana Reyes owes the Marlin Club $400.');
  }

  win() {
    this.state = 'end';
    this.audio.missionDone();
    this.saveSys.clear();
    this.hud.showEnd(true, this.money);
  }

  saveGame() {
    if (this.state === 'playing') this.saveSys.save();
  }

  damagePlayer(n, cause) {
    if (this.state !== 'playing' || this.downTimer > 0) return;
    // Armored van plating: during the M6 vault crack, police rams barely
    // dent Dash — the van takes the hit instead.
    if (
      cause === 'ram' &&
      this.player.car &&
      this.player.car.kind === 'van' &&
      this.missions.current &&
      this.missions.current.id === 6 &&
      this.missions.stage === 1
    ) {
      n = Math.ceil(n * 0.25);
    }
    this.health -= n;
    if (this.health <= 0) {
      this.health = 0;
      this._goDown(cause === 'ram' ? 'BUSTED' : 'WASTED');
    }
  }

  _goDown(text) {
    this.downTimer = TUNING.downTime;
    this.audio.busted();
    this.audio.engineOff();
    this.hud.showDown(text);
  }

  _respawn() {
    this.downTimer = 0;
    this.hud.hideDown();
    this.health = 60;
    this.police.clearWanted();
    this.money = Math.max(0, this.money - TUNING.respawnFine);
    if (this.player.car) {
      this.player.car.speed = 0;
      this.player.car = null;
    }
    this.player.x = 150;
    this.player.z = -126;
    this.player.heading = Math.PI / 2;
    this.player.mesh.visible = true;
    this.hud.toast(`Back on your feet at the Marina. -$${TUNING.respawnFine} fine.`);
  }

  enterCar(car, staged) {
    if (!car) return;
    if (car.parked) car.parked = false;
    const ti = this.traffic.cars.indexOf(car);
    if (ti >= 0) this.traffic.cars.splice(ti, 1);
    this.player.car = car;
    car.speed = 0;
    this.player.x = car.x;
    this.player.z = car.z;
    this.player.heading = car.heading;
    this.player.mesh.visible = false;
    this.audio.door();
    if (!staged) this.missions.onEnterCar(car);
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.speed = 0;
    const side = 2.6;
    this.player.x = car.x + Math.cos(car.heading) * side;
    this.player.z = car.z - Math.sin(car.heading) * side;
    this.player.heading = car.heading;
    this.player.car = null;
    this.player.mesh.visible = true;
    this.audio.door();
  }

  _nearestCar(maxDist) {
    const p = this.playerPos();
    let best = null;
    let bd = maxDist;
    const consider = (car) => {
      const d = dist2d(car.x, car.z, p.x, p.z);
      if (d < bd) {
        bd = d;
        best = car;
      }
    };
    for (const c of this.traffic.cars) consider(c);
    for (const c of this.parked.all) consider(c);
    return best;
  }

  _collideCircle(x, z, r) {
    let nx = x;
    let nz = z;
    for (const c of this.city.colliders) {
      if (nx + r > c.xmin && nx - r < c.xmax && nz + r > c.zmin && nz - r < c.zmax) {
        const pushL = nx + r - c.xmin;
        const pushR = c.xmax - (nx - r);
        const pushU = nz + r - c.zmin;
        const pushD = c.zmax - (nz - r);
        const m = Math.min(pushL, pushR, pushU, pushD);
        if (m === pushL) nx = c.xmin - r;
        else if (m === pushR) nx = c.xmax + r;
        else if (m === pushU) nz = c.zmin - r;
        else nz = c.zmax + r;
      }
    }
    return { x: clamp(nx, -178, 178), z: clamp(nz, -178, 178) };
  }

  updateCamera(dt) {
    if (this.state === 'menu' || this.menuOrbit) {
      const a = this.time * 0.08;
      const cx = Math.cos(a) * 130;
      const cz = Math.sin(a) * 130;
      this.camera.position.lerp(new THREE.Vector3(cx, 62, cz), 1 - Math.exp(-2 * dt));
      this.camera.lookAt(0, 0, 0);
      return;
    }
    const p = this.playerPos();
    const h = this.playerHeading();
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const dist = this.player.car ? 11.5 : 7.5;
    const height = this.player.car ? 5 : 3.6;
    const tx = p.x - fx * dist;
    const tz = p.z - fz * dist;
    if (dt === 0) {
      // Staging snap: place the camera exactly (screenshot setup).
      this.camera.position.set(tx, height, tz);
      this.camera.lookAt(p.x + fx * 9, 1.4, p.z + fz * 9);
      return;
    }
    const k = 1 - Math.exp(-5 * dt);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(p.x + fx * 9, 1.4, p.z + fz * 9);
  }

  _frame(dt) {
    const input = this.input;
    this.time += dt;
    if (this.state === 'menu') {
      this.city.update(dt, this.time);
      this.updateCamera(dt);
      this.renderer.render(this.scene, this.camera);
      input.endFrame();
      return;
    }
    if (this.state === 'end') {
      this.city.update(dt, this.time);
      this.updateCamera(dt);
      this.renderer.render(this.scene, this.camera);
      input.endFrame();
      return;
    }
    if (this.state === 'paused') {
      if (input.wasPressed('Escape')) {
        this.state = 'playing';
        this.hud.toast('Resumed.');
      }
      this.renderer.render(this.scene, this.camera);
      input.endFrame();
      return;
    }
    // Down / respawn.
    if (this.downTimer > 0) {
      this.downTimer -= dt;
      if (this.downTimer <= 0) this._respawn();
      this.updateCamera(dt);
      this.renderer.render(this.scene, this.camera);
      input.endFrame();
      return;
    }
    // Edge-triggered keys.
    if (input.wasPressed('KeyM')) this.audio.setMuted(!this.audio.muted);
    if (input.wasPressed('Escape')) {
      this.state = 'paused';
      this.hud.toast('Paused — press Escape to resume.');
      input.endFrame();
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (input.wasPressed('KeyE')) {
      if (this.player.car) this.exitCar();
      else {
        const car = this._nearestCar(4.5);
        if (car) this.enterCar(car, false);
      }
    }
    if (input.wasPressed('KeyF')) {
      if (!this.player.car) {
        if (this.combat.hasPistol) this.combat.tryShoot();
        else this.combat.tryPunch();
      }
    }
    if (input.wasPressed('KeyR')) {
      const p = this.playerPos();
      const started = this.missions.startRace(this._nearestRaceIndex(p));
      if (started) this.hud.toast('Race started!');
    }
    // Movement.
    const steer = input.steerAxis();
    const drive = input.driveAxis();
    if (this.player.car) {
      const hit = driveCar(this.player.car, steer, drive, input.handbrake(), dt, this.city.colliders);
      if (hit) this.audio.crash();
      this.player.x = this.player.car.x;
      this.player.z = this.player.car.z;
      this.player.heading = this.player.car.heading;
      this.audio.engine(Math.abs(this.player.car.speed) / 30);
      // Headlights on while driving at dusk.
      this.headlight.intensity = 900;
      const fx = Math.sin(this.player.heading);
      const fz = Math.cos(this.player.heading);
      this.headlight.position.set(this.player.x + fx * 2, 1.4, this.player.z + fz * 2);
      this.headlightTarget.position.set(this.player.x + fx * 26, 0.5, this.player.z + fz * 26);
    } else {
      this.headlight.intensity = 0;
      this.audio.engine(0);
      this.player.heading += steer * 2.6 * dt;
      const speed = input.sprint() ? TUNING.sprintSpeed : TUNING.walkSpeed;
      const fx = Math.sin(this.player.heading);
      const fz = Math.cos(this.player.heading);
      const nx = this.player.x + fx * drive * speed * dt;
      const nz = this.player.z + fz * drive * speed * dt;
      const res = this._collideCircle(nx, nz, 0.9);
      this.player.x = res.x;
      this.player.z = res.z;
      this.player.mesh.position.set(this.player.x, 0, this.player.z);
      this.player.mesh.rotation.y = -this.player.heading + Math.PI / 2;
      // Scare pedestrians when sprinting into them.
      if (input.sprint() && drive !== 0) this.pedestrians.scare(this.player.x, this.player.z, 2.5);
    }
    // Spray Shop: auto-clear wanted in a car, radius 7, $75.
    this._sprayCooldown = Math.max(0, this._sprayCooldown - dt);
    if (this.player.car && this.police.wanted > 0 && this.money >= TUNING.sprayCost && this._sprayCooldown <= 0) {
      const s = LANDMARKS.spray.marker;
      if (dist2d(this.player.x, this.player.z, s.x, s.z) < TUNING.sprayRadius) {
        this.money -= TUNING.sprayCost;
        this.police.clearWanted();
        this._sprayCooldown = 2;
        this.audio.coin();
        this.hud.toast(`Spray Shop — fresh paint, clean record. -$${TUNING.sprayCost}`);
      }
    }
    // World updates.
    this.traffic.update(dt, this.player.car, this.playerPos());
    this.police.update(dt, this);
    this.pedestrians.update(dt, this.playerPos(), this.player.car ? Math.abs(this.player.car.speed) : 0, !!this.player.car);
    this.combat.update(dt);
    this.missions.update(dt, this.time);
    this.city.update(dt, this.time);
    this.updateCamera(dt);
    this.hud.update();
    // Autosave every 25s.
    this._saveTimer += dt;
    if (this._saveTimer > 25) {
      this._saveTimer = 0;
      this.saveGame();
    }
    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  }

  _nearestRaceIndex(p) {
    let best = -1;
    let bd = 12;
    RACES.forEach((def, i) => {
      const d = dist2d(p.x, p.z, def.start.x, def.start.z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }
}
