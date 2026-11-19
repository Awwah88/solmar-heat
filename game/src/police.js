// Police for Solmar Heat: wanted level 0-5, patrol cars that spawn, chase
// and ram, and the Busted rule when they corner the player on foot.

import { ROADS, TUNING, clamp, wrapAngle } from './config.js';
import { makeCarMesh } from './vehicles.js';

export class PoliceSystem {
  constructor(THREE, scene, rng) {
    this.THREE = THREE;
    this.scene = scene;
    this.rng = rng;
    this.wanted = 0;
    this.policeCars = [];
    this._decayT = 0;
    this._bustedT = 0;
    this._sirenT = 0;
    this.onBusted = null;
    this.onRam = null;
  }

  setWanted(n) {
    this.wanted = clamp(Math.round(n), 0, TUNING.maxWanted);
    this._decayT = 0;
    this._syncCars();
  }

  addWanted(n) {
    this.setWanted(this.wanted + n);
  }

  clearWanted() {
    this.setWanted(0);
  }

  _syncCars() {
    const want = Math.min(this.wanted, 4);
    while (this.policeCars.length < want) this._spawnCar();
    while (this.policeCars.length > want) {
      const c = this.policeCars.pop();
      this.scene.remove(c.group);
    }
  }

  _spawnCar() {
    const group = makeCarMesh(this.THREE, 0x1a1a22);
    // Black-and-white cruiser: white doors, light bar.
    const door = new this.THREE.Mesh(
      new this.THREE.BoxGeometry(2.04, 0.5, 2.2),
      new this.THREE.MeshLambertMaterial({ color: 0xe8e8e8 }),
    );
    door.position.y = 0.62;
    group.add(door);
    const bar = new this.THREE.Mesh(
      new this.THREE.BoxGeometry(1.2, 0.22, 0.5),
      new this.THREE.MeshBasicMaterial({ color: 0x3a6fd8 }),
    );
    bar.position.set(0, 1.68, -0.25);
    group.add(bar);
    this.scene.add(group);
    this.policeCars.push({
      group,
      speed: 0,
      heading: this.rng() * Math.PI * 2,
      stuckT: 0,
    });
  }

  // Place a fresh police car on a road 30-50u from the player.
  _placeNear(car, px, pz) {
    const road = ROADS[Math.floor(this.rng() * ROADS.length)];
    const along = (Math.floor(this.rng() * 9) - 4) * 36;
    const a = this.rng() * Math.PI * 2;
    let x = px + Math.sin(a) * (32 + this.rng() * 16);
    let z = pz + Math.cos(a) * (32 + this.rng() * 16);
    if (this.rng() < 0.5) { x = road; z = along; }
    else { x = along; z = road; }
    car.group.position.set(clamp(x, -170, 170), 0, clamp(z, -170, 170));
    car.heading = Math.atan2(px - x, pz - z);
    car.group.rotation.y = car.heading;
    car.speed = 6;
  }

  update(dt, player, audio) {
    if (this.wanted <= 0) {
      for (const c of this.policeCars) {
        c.speed = Math.max(0, c.speed - 8 * dt);
      }
      return;
    }
    // Decay: one star per 22s with no cruiser close by.
    const px = player.x;
    const pz = player.z;
    let nearest = Infinity;
    for (const c of this.policeCars) {
      const d = Math.hypot(c.group.position.x - px, c.group.position.z - pz);
      if (d < nearest) nearest = d;
    }
    if (nearest > 45) {
      this._decayT += dt;
      if (this._decayT > 22) {
        this._decayT = 0;
        this.setWanted(this.wanted - 1);
      }
    } else {
      this._decayT = 0;
    }
    this._sirenT -= dt;
    if (this._sirenT <= 0) {
      this._sirenT = 1.6;
      if (audio) audio.sirenBlip();
    }
    for (const c of this.policeCars) {
      const dx = px - c.group.position.x;
      const dz = pz - c.group.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 70) this._placeNear(c, px, pz);
      const target = Math.atan2(dx, dz);
      const turn = clamp(wrapAngle(target - c.heading), -2.6 * dt, 2.6 * dt);
      c.heading = wrapAngle(c.heading + turn);
      const wantSpeed = Math.min(TUNING.policeTopSpeed, 9 + this.wanted * 1.6);
      c.speed += (wantSpeed - c.speed) * Math.min(1, dt * 1.2);
      c.group.position.x += Math.sin(c.heading) * c.speed * dt;
      c.group.position.z += Math.cos(c.heading) * c.speed * dt;
      c.group.rotation.y = c.heading;
      // Ram: contact with the player's car hurts and shoves it.
      if (d < 4.6 && player.car) {
        if (this.onRam) this.onRam(c);
        c.speed *= 0.55;
        c.group.position.x -= Math.sin(c.heading) * 2.2;
        c.group.position.z -= Math.cos(c.heading) * 2.2;
      }
      // Cornered on foot at 2+ stars: busted.
      if (!player.car && d < 3.2 && this.wanted >= 2) {
        this._bustedT += dt;
        if (this._bustedT > 1.4) {
          this._bustedT = 0;
          if (this.onBusted) this.onBusted();
        }
      } else {
        this._bustedT = Math.max(0, this._bustedT - dt * 2);
      }
    }
  }
}
