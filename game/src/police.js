// Solmar Heat — the wanted system and the police.
// Wanted runs 0–5. Stealing cars and hurting pedestrians raise it;
// the Spray Shop and quiet time lower it. Police cars spawn near
// the player, chase, and ram; on foot, a cop that corners the
// player for a couple of seconds busts them.

import * as THREE from 'three';
import { ROADS, clamp, wrapAngle, dist2 } from './config.js';
import { Car, collideCircle } from './vehicles.js';

export class Police {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.wanted = 0;
    this.policeCars = [];
    this._decayTimer = 0;
    this._bustedTimer = 0;
    this._lastCrimeAt = -100;
    this._ramCooldown = new Map();
  }

  setWanted(n) {
    this.wanted = clamp(Math.round(n), 0, 5);
    this._decayTimer = 0;
  }

  addWanted(n) {
    this.setWanted(this.wanted + n);
    this._lastCrimeAt = this._now();
  }

  _now() {
    return performance.now() / 1000;
  }

  // Create a police car at an exact spot (used by the shot stager).
  spawnAt(x, z) {
    const car = new Car(this.scene, { x, z, heading: 0, color: 0x1a1d22 });
    car.speed = 0;
    car.ramAt = 0;
    // Light bar: red and blue beacons on the roof.
    const barGeo = new THREE.BoxGeometry(0.5, 0.22, 0.5);
    car.beaconR = new THREE.Mesh(barGeo, new THREE.MeshLambertMaterial({
      color: 0xdd1111, emissive: 0x881111,
    }));
    car.beaconR.position.set(-0.45, 1.62, -0.25);
    car.beaconB = new THREE.Mesh(barGeo, new THREE.MeshLambertMaterial({
      color: 0x2244ff, emissive: 0x112288,
    }));
    car.beaconB.position.set(0.45, 1.62, -0.25);
    car.group.add(car.beaconR, car.beaconB);
    car.flash = Math.random() * 10;
    this.policeCars.push(car);
    return car;
  }

  _spawnCarNear(playerPos) {
    // Pick a road point 40–60u from the player.
    for (let tries = 0; tries < 12; tries++) {
      const alongRoad = Math.random() < 0.5;
      const line = ROADS[Math.floor(Math.random() * ROADS.length)];
      const a = Math.random() * Math.PI * 2;
      const r = 42 + Math.random() * 16;
      const x = playerPos.x + Math.cos(a) * r;
      const z = playerPos.z + Math.sin(a) * r;
      const px = alongRoad ? x : line;
      const pz = alongRoad ? line : z;
      if (Math.abs(px) > 176 || Math.abs(pz) > 176) continue;
      if (dist2(px, pz, playerPos.x, playerPos.z) < 35) continue;
      return this.spawnAt(px, pz);
    }
    return null;
  }

  _removeCar(car) {
    const i = this.policeCars.indexOf(car);
    if (i >= 0) this.policeCars.splice(i, 1);
    car.remove();
  }

  // dt seconds of policing. Returns { damage, busted } for this frame.
  update(dt, playerPos, playerInCar, playerCar, now) {
    let damage = 0;
    let busted = false;

    // Keep the fleet at the wanted level.
    const want = Math.min(this.wanted, 5);
    while (this.policeCars.length < want) {
      if (!this._spawnCarNear(playerPos)) break;
    }
    while (this.policeCars.length > want) {
      this._removeCar(this.policeCars[this.policeCars.length - 1]);
    }

    for (const car of [...this.policeCars]) {
      const d = dist2(car.x, car.z, playerPos.x, playerPos.z);
      // A cop that lost the player teleports back into the chase.
      if (d > 110) {
        const c = this._spawnCarNear(playerPos);
        if (c) {
          this._removeCar(car);
          continue;
        }
      }
      // Steer at the player and floor it (slightly faster than the
      // player's car, so the chase never just gives up). A turns left
      // = heading increases, so steer toward the error.
      const desired = Math.atan2(playerPos.x - car.x, playerPos.z - car.z);
      const err = wrapAngle(desired - car.angle);
      car.angle = wrapAngle(car.angle + clamp(err, -1, 1) * 2.4 * dt);
      const targetSpeed = 32;
      car.speed += clamp(targetSpeed - car.speed, -20 * dt, 14 * dt);
      const f = car.forward();
      let nx = car.x + f.x * car.speed * dt;
      let nz = car.z + f.z * car.speed * dt;
      const res = collideCircle(nx, nz, car.radius, this.colliders);
      if (res.hit) car.speed *= 0.6;
      car.group.position.x = res.x;
      car.group.position.z = res.z;
      car.group.rotation.y = car.angle;

      // Ram: contact with the player hurts (once per car every 1.5s).
      if (d < 4.2 && now - (car.ramAt || 0) > 1.5) {
        car.ramAt = now;
        damage += 5;
        car.speed *= 0.4;
      }
      // Beacons flash.
      car.flash += dt * 6;
      const on = Math.sin(car.flash) > 0;
      car.beaconR.material.emissive.setHex(on ? 0xff2222 : 0x330000);
      car.beaconB.material.emissive.setHex(on ? 0x111188 : 0x2233ff);

      // Busted: on foot, wanted 2+, a cop stays on top of the player.
      if (!playerInCar && this.wanted >= 2 && d < 4.5) {
        this._bustedTimer += dt;
        if (this._bustedTimer > 2.5) busted = true;
      }
    }
    if (!(this.wanted >= 2 && !playerInCar)) this._bustedTimer = 0;

    // Wanted decays when the heat is off: no cop nearby, no fresh crime.
    if (this.wanted > 0 && now - this._lastCrimeAt > 5) {
      let nearest = Infinity;
      for (const car of this.policeCars) {
        nearest = Math.min(nearest, dist2(car.x, car.z, playerPos.x, playerPos.z));
      }
      if (nearest > 40 || this.policeCars.length === 0) {
        this._decayTimer += dt;
        if (this._decayTimer > 8) {
          this._decayTimer = 0;
          this.setWanted(this.wanted - 1);
        }
      } else {
        this._decayTimer = 0;
      }
    }
    return { damage, busted };
  }
}
