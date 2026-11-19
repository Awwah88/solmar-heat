// Wanted level 0-5 and the police who answer it. Police cars spawn near the
// player, chase, and ram. On foot, getting cornered means Busted.
import * as THREE from 'three';
import { GRID, TUNING, makeRng, clamp, wrapAngle } from './config.js';
import { buildCar } from './vehicles.js';

export class Police {
  constructor(scene, city, seed) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed || 31);
    this.wanted = 0;
    this.policeCars = [];
    this.lastCrimeAt = -999;
    this.decayTimer = 0;
    this.bustedTimer = 0;
    this.time = 0;
  }

  setWanted(n, playerPos) {
    this.wanted = clamp(Math.round(n), 0, 5);
    this.lastCrimeAt = this.time;
    this._syncCars(playerPos);
  }

  commitCrime(amount, playerPos) {
    this.wanted = clamp(this.wanted + amount, 0, 5);
    this.lastCrimeAt = this.time;
    this._syncCars(playerPos);
  }

  clear(playerPos) {
    this.wanted = 0;
    this.bustedTimer = 0;
    this._syncCars(playerPos);
  }

  _syncCars(playerPos) {
    const want = Math.min(this.wanted, TUNING.maxPolice);
    while (this.policeCars.length < want) {
      const car = buildCar(0x111827, { police: true, kind: 'police' });
      // Spawn on a road 45-60u away from the player.
      let x = playerPos.x;
      let z = playerPos.z;
      for (let tries = 0; tries < 12; tries++) {
        const road = GRID.roads[Math.floor(this.rng() * GRID.roads.length)];
        const along = -162 + this.rng() * 324;
        if (this.rng() < 0.5) { x = road; z = along; } else { x = along; z = road; }
        const d = Math.hypot(x - playerPos.x, z - playerPos.z);
        if (d > 42 && d < 65) break;
      }
      car.group.position.set(x, 0, z);
      car.angle = Math.atan2(playerPos.x - x, playerPos.z - z);
      car.speed = 10;
      car.ramCooldown = 0;
      this.scene.add(car.group);
      this.policeCars.push(car);
    }
    while (this.policeCars.length > want) {
      const car = this.policeCars.pop();
      this.scene.remove(car.group);
    }
  }

  update(dt, player, hooks) {
    this.time += dt;
    if (this.wanted <= 0) return;
    // Wanted decays when the player has been quiet and no cruiser is near.
    const near = this.policeCars.some((c) => {
      const dx = c.group.position.x - player.x;
      const dz = c.group.position.z - player.z;
      return dx * dx + dz * dz < 35 * 35;
    });
    if (this.time - this.lastCrimeAt > 15 && !near) {
      this.decayTimer += dt;
      if (this.decayTimer > 12) {
        this.decayTimer = 0;
        this.setWanted(this.wanted - 1, player);
      }
    } else {
      this.decayTimer = 0;
    }
    this._syncCars(player);
    let cornered = false;
    for (const car of this.policeCars) {
      const p = car.group.position;
      const dx = player.x - p.x;
      const dz = player.z - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const desired = Math.atan2(dx, dz);
      const err = wrapAngle(desired - car.angle);
      car.angle += clamp(err, -2.6 * dt, 2.6 * dt);
      const targetSpeed = d > 6 ? 23 : 12;
      car.speed += clamp(targetSpeed - car.speed, -18 * dt, 10 * dt);
      p.x += Math.sin(car.angle) * car.speed * dt;
      p.z += Math.cos(car.angle) * car.speed * dt;
      const fixed = this.city.resolveCircle(p.x, p.z, TUNING.carRadius);
      p.x = fixed.x;
      p.z = fixed.z;
      car.group.rotation.y = car.angle;
      for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.42;
      car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
      // Ram the player's car, or corner the player on foot.
      if (d < 4.6 && car.ramCooldown <= 0) {
        car.ramCooldown = 1.1;
        car.speed *= 0.55;
        if (hooks && hooks.onRam) hooks.onRam(d);
      }
      if (!player.car && d < 3.2) cornered = true;
      // A cruiser that lost the player far away respawns closer.
      if (d > 130) {
        const road = GRID.roads[Math.floor(this.rng() * GRID.roads.length)];
        const along = player.z + (this.rng() < 0.5 ? -50 : 50);
        if (this.rng() < 0.5) { p.x = road; p.z = clamp(along, -170, 170); }
        else { p.x = clamp(player.x + (this.rng() < 0.5 ? -50 : 50), -170, 170); p.z = road; }
      }
    }
    if (cornered) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 1.2 && hooks && hooks.onBusted) {
        this.bustedTimer = 0;
        hooks.onBusted();
      }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
  }
}
