// Solmar Heat — pedestrians.js
// The people of Solmar Bay: walkers who stroll the sidewalks, cross at
// intersections, and run for cover when a gun goes off or a car comes
// at them. A pedestrian is a simple two-part figure — body and head —
// with a walking bob and a shirt colour picked from a beach palette.

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, distance2D } from './config.js';

const SHIRTS = [0xe86a2e, 0x3b6fd2, 0x2e8a4a, 0xd9a441, 0x8a5fb5, 0xe8e4d8, 0xc94a6a, 0x4a9a8a];
const SKINS = [0xe8b98a, 0xc98a5e, 0x8a5a3a, 0xf2c9a0];

export class Pedestrian {
  constructor(scene, x, z, seed) {
    this.scene = scene;
    this.group = new THREE.Group();
    const shirt = SHIRTS[seed % SHIRTS.length];
    const skin = SKINS[seed % SKINS.length];
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.1, 0.4),
      new THREE.MeshLambertMaterial({ color: shirt }),
    );
    body.position.y = 1.05;
    body.castShadow = true;
    this.group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 8),
      new THREE.MeshLambertMaterial({ color: skin }),
    );
    head.position.y = 1.85;
    head.castShadow = true;
    this.group.add(head);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.5, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x2c3a4a }),
    );
    legs.position.y = 0.25;
    this.group.add(legs);
    this.group.position.set(x, 0, z);
    scene.add(this.group);
    this.pos = this.group.position;
    this.heading = seed * 1.7;
    this.speed = 1.2 + (seed % 5) * 0.35;
    this.state = 'walk'; // walk | flee | down
    this.fleeTimer = 0;
    this.bobPhase = seed * 2.1;
    this.walkTarget = null;
    this._pickTarget(seed);
  }

  _pickTarget(seed) {
    // Sidewalk spots sit just off the road lines, so walkers stay out of
    // the traffic's way unless something scares them.
    const road = -160 + (seed % 9) * 40;
    const along = -160 + ((seed * 7) % 9) * 40;
    if (seed % 2 === 0) this.walkTarget = { x: road + 8, z: along };
    else this.walkTarget = { x: along, z: road + 8 };
  }

  scare() {
    if (this.state === 'down') return;
    this.state = 'flee';
    this.fleeTimer = 4;
    this.speed = 5.5;
  }

  knockDown() {
    this.state = 'down';
    this.group.rotation.x = Math.PI / 2;
    this.group.position.y = 0.4;
  }

  update(dt, danger) {
    if (this.state === 'down') return;
    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      if (this.fleeTimer <= 0) {
        this.state = 'walk';
        this.speed = 1.5;
        this._pickTarget(Math.floor(Math.random() * 100));
      }
    }
    if (danger) this.scare();
    const target = this.walkTarget;
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 3) {
      this._pickTarget(Math.floor(Math.random() * 200) + 1);
      return;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    this.pos.x = Math.max(-175, Math.min(175, this.pos.x));
    this.pos.z = Math.max(-175, Math.min(205, this.pos.z));
    // Walking bob.
    this.bobPhase += dt * this.speed * 3;
    this.group.position.y = Math.abs(Math.sin(this.bobPhase)) * 0.08;
    this.group.rotation.y = this.heading;
  }
}

export class Pedestrians {
  constructor(scene) {
    this.scene = scene;
    this.people = [];
    this._seed = 99;
  }

  _rand() {
    this._seed = (this._seed * 48271) % 2147483647;
    return this._seed / 2147483647;
  }

  spawn() {
    for (let i = 0; i < CONFIG.PEDESTRIAN_COUNT; i++) {
      const road = -160 + (i % 9) * 40;
      const along = -160 + Math.floor(this._rand() * 9) * 40;
      const x = i % 2 === 0 ? road + 8 : along;
      const z = i % 2 === 0 ? along : road + 8;
      this.people.push(new Pedestrian(this.scene, x, z, i + 1));
    }
  }

  update(dt, playerPos, playerSpeed, shooting) {
    for (const person of this.people) {
      if (person.state === 'down') continue;
      const nearPlayer = distance2D(person.pos.x, person.pos.z, playerPos.x, playerPos.z);
      const danger = shooting || (nearPlayer < 6 && playerSpeed > 12);
      person.update(dt, danger);
    }
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const person of this.people) {
      if (person.state === 'down') continue;
      const d = distance2D(x, z, person.pos.x, person.pos.z);
      if (d < bestD) {
        bestD = d;
        best = person;
      }
    }
    return best;
  }

  // A car ploughing through a crowd: knock down anyone it touches.
  // Returns how many were hit, so the game can raise the wanted level.
  checkCarHits(car) {
    let hits = 0;
    if (Math.abs(car.speed) < 4) return 0;
    for (const person of this.people) {
      if (person.state === 'down') continue;
      const d = distance2D(car.pos.x, car.pos.z, person.pos.x, person.pos.z);
      if (d < 2.2) {
        person.knockDown();
        hits += 1;
      }
    }
    return hits;
  }

  get downCount() {
    return this.people.filter((p) => p.state === 'down').length;
  }
}
