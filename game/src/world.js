// Solmar Heat — the Game. Owns the renderer, sky, camera, the player
// (on foot and in a car), collisions, cash pickups, beacons, the Spray
// Shop, the downed/Busted/Wasted flow and the frame loop, and wires every
// subsystem together. The runtime hooks the playtest drivers use live
// here: window.__solmarHeat, g.state, g.money, g.health, g.playerPos(),
// g.playerHeading(), g.traffic, g.police, g.missions, g.city, g.parked.
import * as THREE from 'three';
import { SPAWN, MARINA_RESPAWN, LANDMARKS, TUNING, CASH_PICKUPS, DOUBLOONS, M5 } from './config.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { City } from './city.js';
import { Traffic, ParkedCars } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { SaveManager } from './save.js';

export class Game {
  constructor() {
    this.state = 'menu';
    this.money = 0;
    this.health = 100;
    this.downTimer = 0;
    this.elapsed = 0;
    this.input = new Input();
    this.audio = new AudioEngine();
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-canvas').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    // Improved R16 sky: warm gradient blue with haze at the horizon.
    this.scene.background = new THREE.Color(0x8ec8e8);
    this.scene.fog = new THREE.Fog(0x9ec8e0, 130, 430);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(90, 50, -60);
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a4a3a, 0.95);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
    this.sun.position.set(140, 190, -80);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -220; this.sun.shadow.camera.right = 220;
    this.sun.shadow.camera.top = 220; this.sun.shadow.camera.bottom = -220;
    this.scene.add(this.sun);
    const sunBall = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff6c9 }));
    sunBall.position.set(260, 190, -160);
    this.scene.add(sunBall);
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(9 + (i % 3) * 4, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 }));
      cloud.scale.y = 0.4;
      cloud.position.set(-180 + i * 55, 95 + (i % 3) * 12, -140 + (i % 4) * 80);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
    this.city = new City(this.scene);
    this.traffic = new Traffic(this.scene);
    this.parked = new ParkedCars(this.scene);
    this.pedestrians = new Pedestrians(this.scene);
    this.police = new Police(this.scene, this);
    this.missions = new MissionManager(this);
    this.combat = new Combat(this);
    this.hud = new Hud(this);
    this.save = new SaveManager(this);
    // The player, on foot.
    this.player = { x: SPAWN.x, z: SPAWN.z, heading: 0, car: null, mesh: null };
    const pm = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.45), new THREE.MeshStandardMaterial({ color: 0x37e08b, roughness: 0.8 }));
    torso.position.y = 1.05; torso.castShadow = true;
    pm.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 }));
    head.position.y = 1.9;
    pm.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.95 }));
    legs.position.y = 0.3;
    pm.add(legs);
    pm.position.set(SPAWN.x, 0, SPAWN.z);
    this.scene.add(pm);
    this.player.mesh = pm;
    // Cash pickups, doubloons and beacons.
    this.cashMeshes = CASH_PICKUPS.map((c) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1), new THREE.MeshStandardMaterial({ color: 0x37e08b, emissive: 0x1a8a52, emissiveIntensity: 0.7 }));
      m.position.set(c.x, 0.6, c.z);
      this.scene.add(m);
      return { mesh: m, value: c.value, taken: false, respawnIn: 0 };
    });
    this.doubloonMeshes = DOUBLOONS.map((d) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.25, 20), new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xd9a514, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.25 }));
      m.rotation.x = Math.PI / 2;
      m.position.set(d.x, 1.2, d.z);
      this.scene.add(m);
      return m;
    });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.55 });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 22, 16, 1, true), beaconMat);
    this.beacon.position.set(0, 11, 0);
    this.scene.add(this.beacon);
    this.packageBeacons = [0, 1, 2].map(() => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 18, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0x37e08b, transparent: true, opacity: 0.5 }));
      b.position.set(0, 9, 0);
      this.scene.add(b);
      return b;
    });
    this.fareBeacon = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 18, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0x14b8a6, transparent: true, opacity: 0.5 }));
    this.fareBeacon.position.set(0, 9, 0);
    this.scene.add(this.fareBeacon);
    this.menuAngle = 0;
    this.camPos = new THREE.Vector3(90, 50, -60);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this._last = performance.now();
    this.renderer.setAnimationLoop(() => this._frame());
    this.hud.showMenu();
    this.audio.startMusic();
  }
  playerPos() {
    if (this.player.car) return { x: this.player.car.x, z: this.player.car.z };
    return { x: this.player.x, z: this.player.z };
  }
  playerHeading() {
    return this.player.car ? this.player.car.heading : this.player.heading;
  }
  teleport(x, z) {
    this.player.x = x;
    this.player.z = z;
    this.player.mesh.position.set(x, 0, z);
    if (this.player.car) {
      this.player.car.group.position.set(x, 0, z);
      this.player.car.speed = 0;
    }
  }
  damagePlayer(amount, source) {
    if (this.state !== 'playing' || this.downTimer > 0) return;
    let a = amount;
    if (source === 'police') {
      a *= this.combat.chaseDamageScale();
      // Armored Marlin limo: police rams hurt half as much while driving it.
      if (this.player.car && this.player.car.kind === 'limo') a *= 0.5;
    }
    this.health -= a;
    if (this.health <= 0) {
      this.health = 0;
      this._goDown();
    }
  }
  _goDown() {
    this.downTimer = TUNING.downSeconds;
    this.audio.busted();
    this.audio.setSiren(false);
    const busted = this.police.wanted > 0;
    this.hud.showDown(busted ? 'BUSTED!' : 'WASTED!');
    this.hud.toast(busted ? 'Busted! The Marlin Club is not pleased.' : 'Wasted! Dana wakes up at the Marina.');
  }
  _respawn() {
    this.downTimer = 0;
    this.hud.hideDown();
    this.player.car = null;
    this.teleport(MARINA_RESPAWN.x, MARINA_RESPAWN.z);
    this.health = TUNING.respawnHealth;
    this.police.clear();
    this.money = Math.max(0, this.money - TUNING.respawnFine);
    // M5 bust reset (R16 fix #2): a bust in stage 1/2 strands the limo far
    // away with no recovery path (soft-lock). Reset M5 to the steal
    // (stage 0) and park the limo back at the Casino, so a bust is just
    // "retry M5 from the steal" — the flow the driver already handles.
    const m = this.missions;
    if (m.current && m.current.id === 5 && (m.stage === 1 || m.stage === 2)) {
      m.stage = 0;
      m.timer = 0;
      const limo = this.parked.limo;
      limo.group.position.set(M5.limo.x, 0, M5.limo.z);
      limo.group.rotation.y = Math.PI / 2;
      limo.heading = Math.PI / 2;
      limo.speed = 0;
      this.hud.toast('M5 reset — steal the limo at the Casino again!');
    }
    this.hud.toast(`Respawned at the Marina — $${TUNING.respawnFine} fine, health ${TUNING.respawnHealth}.`);
    this.save.save();
  }
  _collide(x, z, radius) {
    for (const c of this.city.colliders) {
      const cx = Math.max(c.xmin, Math.min(x, c.xmax));
      const cz = Math.max(c.zmin, Math.min(z, c.zmax));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 < 0.0001) { x = c.xmax + radius; continue; }
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      }
    }
    x = Math.max(-192, Math.min(212, x));
    z = Math.max(-192, Math.min(192, z));
    return { x, z };
  }
  _nearestCar(maxD) {
    const p = this.playerPos();
    let best = null;
    let bd = maxD;
    const all = [...this.traffic.cars, ...this.parked.all(), ...this.police.policeCars];
    for (const c of all) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  _tryEnterCar() {
    const car = this._nearestCar(4.5);
    if (!car) return;
    this.player.car = car;
    car.stolen = true;
    this.player.mesh.visible = false;
    this.police.addWanted(1);
    this.audio.engineStart();
    this.hud.toast(car.isPolice ? 'You stole a police car!' : 'Car stolen — wanted up!');
  }
  _exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.speed = 0;
    this.player.x = car.x + Math.cos(car.heading) * 2.5;
    this.player.z = car.z - Math.sin(car.heading) * 2.5;
    this.player.heading = car.heading;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    this.player.mesh.visible = true;
    this.player.car = null;
  }
  _checkSpray() {
    const car = this.player.car;
    if (!car) return;
    const d = Math.hypot(LANDMARKS.spray.x - car.x, LANDMARKS.spray.z - car.z);
    if (d < 7 && this.police.wanted > 0 && this.money >= TUNING.sprayCost) {
      this.money -= TUNING.sprayCost;
      this.police.clear();
      this.audio.spray();
      this.hud.toast(`Spray Shop: fresh paint -$${TUNING.sprayCost}, wanted cleared!`);
      this.save.save();
    }
  }
  _checkCash() {
    const p = this.playerPos();
    for (const c of this.cashMeshes) {
      if (c.taken) continue;
      if (Math.hypot(c.mesh.position.x - p.x, c.mesh.position.z - p.z) < 3) {
        c.taken = true;
        c.mesh.visible = false;
        c.respawnIn = 45;
        this.money += c.value;
        this.audio.cash();
        this.hud.toast(`Cash pickup +$${c.value}`);
      }
    }
  }
  startNewGame() {
    this.audio.ensure();
    this.audio.startMusic();
    this.money = 0;
    this.health = 100;
    this.downTimer = 0;
    this.player.car = null;
    this.player.mesh.visible = true;
    this.police.clear();
    this.missions.setDone([]);
    this.missions.doubloons.collected = new Set();
    this.missions.taxi = { active: null, streak: 0, done: 0, respawnIn: 2 };
    this.missions.refreshDoubloonMeshes();
    this.combat.hasPistol = false;
    this.teleport(SPAWN.x, SPAWN.z);
    this.player.heading = 0;
    this.missions.startMission(1);
    this.state = 'playing';
    this.hud.showPlaying();
    this.hud.toast('Dana "Dash" Reyes owes the Marlin Club $400. Get to work.');
    this.save.save();
  }
  continueGame() {
    const data = this.save.load();
    this.audio.ensure();
    if (!data) { this.startNewGame(); return; }
    this.state = 'playing';
    this.hud.showPlaying();
    this.save.apply(data);
    this.hud.toast('Save loaded — welcome back to Solmar Bay.');
  }
  showMenu() {
    this.state = 'menu';
    this.hud.showMenu();
  }
  resume() {
    this.state = 'playing';
    this.hud.showPlaying();
  }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.hud.showPause();
  }
  win() {
    this.state = 'end';
    this.audio.win();
    this.audio.setSiren(false);
    this.save.clear();
    this.hud.showEnd('win', 'SOLMAR LEGEND', `All 5 missions done — the Marlin debt is paid. Final cash: $${Math.floor(this.money)}. Dana Reyes owns Solmar Bay.`);
  }
  _frame() {
    const input = this.input;
    const now = performance.now();
    let dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    if (this.state === 'menu') {
      this.menuAngle += dt * 0.08;
      this.camera.position.set(Math.sin(this.menuAngle) * 130, 62, Math.cos(this.menuAngle) * 130);
      this.camera.lookAt(0, 6, 0);
      this.city.animate(dt, now / 1000);
      this.renderer.render(this.scene, this.camera);
      input.endFrame();
      return;
    }
    if (this.state === 'paused') {
      if (input.pause) this.resume();
      this.renderer.render(this.scene, this.camera);
      input.endFrame();
      return;
    }
    if (this.state === 'end') {
      this.hud.update(dt);
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
    // Playing.
    this.elapsed += dt;
    if (input.pause) { this.pause(); input.endFrame(); return; }
    const axes = input.axes;
    if (input.interact) {
      if (this.player.car) this._exitCar();
      else this._tryEnterCar();
    }
    if (this.player.car) {
      const car = this.player.car;
      const throttle = axes.y;
      car.drive(dt, throttle, axes.x);
      const after = this._collide(car.x, car.z, 2.2);
      if (Math.hypot(after.x - car.x, after.z - car.z) > 0.01 && Math.abs(car.speed) > 6) {
        this.audio.crash();
        car.speed *= 0.4;
      }
      car.group.position.x = after.x;
      car.group.position.z = after.z;
      this.player.mesh.position.set(car.x, 0, car.z);
      // Running over a pedestrian at speed is a crime, and it hurts.
      for (const ped of this.pedestrians.list) {
        if (ped.down > 0) continue;
        if (Math.hypot(ped.group.position.x - car.x, ped.group.position.z - car.z) < 2.2 && Math.abs(car.speed) > 5) {
          ped.knockDown();
          this.police.addWanted(1);
        }
      }
    } else {
      this.player.heading += axes.x * 2.7 * dt;
      const speed = axes.y * (input.sprint ? TUNING.sprintSpeed : TUNING.walkSpeed);
      let nx = this.player.x + Math.sin(this.player.heading) * speed * dt;
      let nz = this.player.z + Math.cos(this.player.heading) * speed * dt;
      const after = this._collide(nx, nz, 0.8);
      this.player.x = after.x;
      this.player.z = after.z;
      this.player.mesh.position.set(this.player.x, 0, this.player.z);
      this.player.mesh.rotation.y = this.player.heading;
    }
    this._checkSpray();
    this._checkCash();
    this.missions.update(dt);
    this.police.update(dt);
    this.traffic.update(dt, this.city.colliders, this.player.car);
    this.pedestrians.update(dt, this.playerPos(), this.player.car ? Math.abs(this.player.car.speed) : 0, this.police.wanted);
    this.combat.update(dt);
    this.city.animate(dt, now / 1000);
    for (const c of this.cashMeshes) {
      if (c.taken) {
        c.respawnIn -= dt;
        if (c.respawnIn <= 0) { c.taken = false; c.mesh.visible = true; }
      } else {
        c.mesh.rotation.y += dt * 2;
      }
    }
    for (const m of this.doubloonMeshes) if (m.visible) m.rotation.z += dt * 1.5;
    for (const c of this.clouds) { c.position.x += dt * 0.8; if (c.position.x > 220) c.position.x = -220; }
    // Chase camera: behind the heading, higher and further in a car.
    const p = this.playerPos();
    const h = this.playerHeading();
    const dist = this.player.car ? 13.5 : 9.5;
    const height = this.player.car ? 6 : 5;
    const tx = p.x - Math.sin(h) * dist;
    const tz = p.z - Math.cos(h) * dist;
    this.camPos.x += (tx - this.camPos.x) * Math.min(1, dt * 5);
    this.camPos.y += (height - this.camPos.y) * Math.min(1, dt * 5);
    this.camPos.z += (tz - this.camPos.z) * Math.min(1, dt * 5);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(p.x, 2, p.z);
    this.hud.update(dt);
    this.save.autosave(dt);
    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  }
}
