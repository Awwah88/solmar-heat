// Solmar Heat — pedestrians.
// Twenty-four walkers drift along the sidewalks, turn at intersections,
// and run from any car that gets too close. They can be punched or shot
// (which the police notice), and a knocked-down walker gets back up.

import * as THREE from 'three';
import { CITY, TUNING, clamp, wrapAngle, dist2d, mulberry32 } from './config.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xfd79a8];
const PANTS = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x5d4037];

export class Pedestrian {
  constructor(game, x, z, rng) {
    this.game = game;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = (Math.floor(rng() * 4) * Math.PI) / 2;
    this.speed = 1.4 + rng() * 1.1;
    this.health = 30;
    this.down = false;
    this.downTimer = 0;
    this.fleeTimer = 0;
    this.rng = rng;
    const shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)];
    const pants = PANTS[Math.floor(rng() * PANTS.length)];
    const skin = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac][Math.floor(rng() * 4)];
    const group = new THREE.Group();
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.34), new THREE.MeshLambertMaterial({ color: pants }));
    legs.position.y = 0.4;
    group.add(legs);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.36), new THREE.MeshLambertMaterial({ color: shirt }));
    torso.position.y = 1.15;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: skin }));
    head.position.y = 1.72;
    head.castShadow = true;
    group.add(head);
    group.position.copy(this.pos);
    this.mesh = group;
    this.walkPhase = rng() * Math.PI * 2;
    game.scene.add(group);
  }

  // A punch or a bullet. Returns true when this walker goes down.
  hurt(amount) {
    if (this.down) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.down = true;
      this.downTimer = 6;
      this.mesh.rotation.x = Math.PI / 2;
      this.mesh.position.y = 0.3;
      return true;
    }
    this.fleeTimer = 3;
    return false;
  }

  update(dt) {
    if (this.down) {
      this.downTimer -= dt;
      if (this.downTimer <= 0) {
        this.down = false;
        this.health = 30;
        this.mesh.rotation.x = 0;
        this.mesh.position.y = 0;
        // Get up somewhere else, away from trouble.
        const g = this.game;
        this.pos.set(g.player.pos.x + 30, 0, g.player.pos.z - 40);
        this.pos.x = clamp(this.pos.x, -150, 150);
        this.pos.z = clamp(this.pos.z, -150, 150);
      }
      return;
    }
    const g = this.game;
    // Flee from the player's car, or from any car that comes close.
    let fleeX = 0;
    let fleeZ = 0;
    const cars = [g.player.car, ...g.vehicles.traffic.cars, ...g.police.policeCars];
    for (const car of cars) {
      if (!car) continue;
      const d = dist2d(this.pos.x, this.pos.z, car.pos.x, car.pos.z);
      if (d < 9) {
        fleeX += (this.pos.x - car.pos.x) / Math.max(1, d);
        fleeZ += (this.pos.z - car.pos.z) / Math.max(1, d);
      }
    }
    let speed = this.speed;
    if (fleeX !== 0 || fleeZ !== 0 || this.fleeTimer > 0) {
      this.fleeTimer -= dt;
      speed = 4.2;
      if (fleeX !== 0 || fleeZ !== 0) {
        this.heading = Math.atan2(fleeX, fleeZ);
      }
    } else if (this.rng() < dt * 0.05) {
      // Wander: turn at an intersection now and then.
      this.heading = wrapAngle(this.heading + (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2));
    }
    const nx = this.pos.x + Math.sin(this.heading) * speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * speed * dt;
    // Stay on the sidewalks: keep to the road grid, off the beach road.
    if (Math.abs(nx) < 168 && nz > -168 && nz < 168) {
      this.pos.x = nx;
      this.pos.z = nz;
    } else {
      this.heading = wrapAngle(this.heading + Math.PI);
    }
    this.walkPhase += dt * speed * 3.2;
    this.mesh.position.set(this.pos.x, Math.abs(Math.sin(this.walkPhase)) * 0.05, this.pos.z);
    this.mesh.rotation.y = this.heading;
  }
}

export class PedestrianSystem {
  constructor(game) {
    this.game = game;
    this.walkers = [];
    this.rng = game.seed ? mulberry32(game.seed + 7) : Math.random;
  }

  build() {
    const rng = this.rng;
    for (let i = 0; i < TUNING.pedestrianCount; i++) {
      // Sidewalk spots: just off a road line.
      const onVertical = rng() < 0.5;
      const line = -160 + Math.floor(rng() * 9) * 40;
      const along = -160 + rng() * 320;
      const off = (rng() < 0.5 ? -1 : 1) * 7.5;
      const x = onVertical ? line + off : along;
      const z = onVertical ? along : line + off;
      this.walkers.push(new Pedestrian(this.game, x, z, rng));
    }
    return this;
  }

  update(dt) {
    for (const w of this.walkers) w.update(dt);
  }

  // Nearest standing walker in front of `from`, inside `maxDist` and a
  // 60-degree cone. Used by the punch and the pistol.
  nearestInFront(from, heading, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const w of this.walkers) {
      if (w.down) continue;
      const dx = w.pos.x - from.x;
      const dz = w.pos.z - from.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > bestD) continue;
      const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - heading));
      if (ang > 0.55) continue;
      bestD = d;
      best = w;
    }
    return best;
  }
}
