// Solmar Heat — police.js
// The wanted system and the police who respond to it. Stars rise with
// crimes and fall only after the player has stayed quiet for a while;
// police cars spawn near the player, chase, and ram. On foot, a police
// car sitting on the player for long enough means Busted.
//
// The chase itself is three small steps per car per frame: steer toward
// the player, drive forward at a speed that grows with the wanted
// level, and ram on contact.

import { Car } from './vehicles.js';
import { clamp, distance2D } from './config.js';

export class PoliceSystem {
  constructor(scene) {
    this.scene = scene;
    this.wanted = 0;
    this.policeCars = [];
    this.heatTimer = 0; // time since the last crime
    this.decayTimer = 0;
    this.bustedTimer = 0;
    this.spawnTimer = 0;
  }

  addWanted(amount, reason) {
    if (amount <= 0) return reason;
    this.wanted = clamp(this.wanted + amount, 0, 5);
    this.heatTimer = 0;
    this.decayTimer = 0;
    return reason;
  }

  clearWanted() {
    this.wanted = 0;
    this.heatTimer = 0;
    this.decayTimer = 0;
    this.policeCars.forEach((car) => {
      this.scene.remove(car.mesh);
    });
    this.policeCars = [];
  }

  // Force-spawn one police car at a chosen spot (used by screenshot staging).
  spawnPoliceCar(x, z, angle = 0) {
    const car = new Car(this.scene, 0x1c2733, clamp(x, -175, 175), clamp(z, -175, 195), angle, true);
    car.driver = 'police';
    car.speed = 20;
    this.policeCars.push(car);
    return car;
  }

  // Wanted decays one star at a time, but only after the player has
  // been quiet for 20 seconds, and then only every 8 seconds.
  decayWanted(dt) {
    if (this.wanted <= 0 || this.heatTimer <= 20) return;
    this.decayTimer += dt;
    if (this.decayTimer > 8) {
      this.decayTimer = 0;
      this.wanted = Math.max(0, this.wanted - 1);
      if (this.wanted === 0) this.clearWanted();
    }
  }

  // Keep the right number of police cars on the road: at most one per
  // star, capped at four. New cars spawn some distance from the player.
  maintainFleet(dt, player) {
    const want = this.wanted > 0 ? Math.min(this.wanted, 4) : 0;
    this.spawnTimer -= dt;
    if (this.policeCars.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      const angle = Math.random() * Math.PI * 2;
      const x = player.pos.x + Math.sin(angle) * 75;
      const z = player.pos.z + Math.cos(angle) * 75;
      this.spawnPoliceCar(x, z, angle);
    }
    if (this.policeCars.length > want) {
      const extra = this.policeCars.pop();
      this.scene.remove(extra.mesh);
    }
  }

  // Steer one police car toward the player and drive it forward.
  chaseCar(car, dt, player) {
    const targetAngle = Math.atan2(player.pos.x - car.pos.x, player.pos.z - car.pos.z);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += clamp(diff, -1.6 * dt, 1.6 * dt);
    const speed = Math.min(17 + this.wanted * 1.6, 26);
    car.speed += (speed - car.speed) * Math.min(1, dt * 0.8);
    const f = car.forward();
    car.pos.x += f.x * car.speed * dt;
    car.pos.z += f.z * car.speed * dt;
    car.pos.x = clamp(car.pos.x, -185, 185);
    car.pos.z = clamp(car.pos.z, -185, 200);
    car.mesh.rotation.y = car.angle;
    return f;
  }

  update(dt, player, playerCar, onBusted, onRam) {
    this.heatTimer += dt;
    this.decayWanted(dt);
    this.maintainFleet(dt, player);
    // Chase: steer at the player, ram on contact.
    let nearest = 999;
    this.policeCars.forEach((car) => {
      const d = distance2D(car.pos.x, car.pos.z, player.pos.x, player.pos.z);
      nearest = Math.min(nearest, d);
      const f = this.chaseCar(car, dt, player);
      // Ram on contact: damage the player (or their car) with a short
      // cooldown, and shove the player's car sideways.
      car.hitCooldown -= dt;
      if (d < 3.4 && car.hitCooldown <= 0) {
        car.hitCooldown = 1.2;
        onRam();
        if (playerCar) {
          playerCar.speed *= 0.45;
          playerCar.pos.x += f.x * 6 * 0.15;
          playerCar.pos.z += f.z * 6 * 0.15;
        }
      }
    });
    // Busted: a police car sits on the on-foot player while wanted.
    if (!playerCar && this.wanted >= 2 && nearest < 3.2) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 2.5) {
        this.bustedTimer = 0;
        onBusted();
      }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
    return nearest;
  }
}
