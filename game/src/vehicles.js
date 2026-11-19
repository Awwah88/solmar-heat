// Solmar Heat — cars and traffic.
// A Car is a simple arcade vehicle: a mesh group plus speed and
// heading. Player-driven cars use arcade physics (accelerate, steer
// with a speed-scaled turn rate, slide along building faces); the
// Traffic class drives 14 cars around the road grid, turning at
// intersections and stopping for the car ahead.

import * as THREE from 'three';
import { ROADS, PALETTE, clamp, wrapAngle, dist2 } from './config.js';

// Push a circle (x, z, radius r) out of every AABB collider it
// overlaps. Returns the corrected position and whether a hit happened.
export function collideCircle(x, z, r, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.xmin, Math.min(x, c.xmax));
    const nz = Math.max(c.zmin, Math.min(z, c.zmax));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r;
      z = nz + (dz / d) * r;
    } else {
      // Centre inside the box: push out along the smallest penetration.
      const pl = x - (c.xmin - r);
      const pr = (c.xmax + r) - x;
      const pt = z - (c.zmin - r);
      const pb = (c.zmax + r) - z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) x = c.xmin - r;
      else if (m === pr) x = c.xmax + r;
      else if (m === pt) z = c.zmin - r;
      else z = c.zmax + r;
    }
  }
  return { x, z, hit };
}

const bodyGeo = new THREE.BoxGeometry(2.0, 0.7, 4.2);
const cabinGeo = new THREE.BoxGeometry(1.7, 0.6, 2.1);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
const lightGeo = new THREE.BoxGeometry(0.4, 0.22, 0.1);

export class Car {
  constructor(scene, { x, z, heading = 0, color = 0xd23c2a, gold = false } = {}) {
    this.scene = scene;
    this.speed = 0;
    this.angle = heading;
    this.radius = 1.6;
    this.gold = gold;
    this.group = new THREE.Group();
    const paint = new THREE.MeshLambertMaterial({ color });
    const glass = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
    const body = new THREE.Mesh(bodyGeo, paint);
    body.position.y = 0.62;
    body.castShadow = true;
    this.group.add(body);
    const cabin = new THREE.Mesh(cabinGeo, glass);
    cabin.position.set(0, 1.2, -0.25);
    cabin.castShadow = true;
    this.group.add(cabin);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      this.group.add(wheel);
    }
    const headMat = new THREE.MeshLambertMaterial({
      color: 0xfff6c0, emissive: 0x555533,
    });
    for (const sx of [-0.65, 0.65]) {
      const head = new THREE.Mesh(lightGeo, headMat);
      head.position.set(sx, 0.62, 2.12);
      this.group.add(head);
    }
    const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0x330000 });
    for (const sx of [-0.65, 0.65]) {
      const tail = new THREE.Mesh(lightGeo, tailMat);
      tail.position.set(sx, 0.62, -2.12);
      this.group.add(tail);
    }
    if (gold) {
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(2.05, 0.18, 4.25),
        new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x664400 }),
      );
      trim.position.y = 1.0;
      this.group.add(trim);
    }
    this.group.position.set(x, 0, z);
    this.group.rotation.y = heading;
    scene.add(this.group);
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  forward() {
    return { x: Math.sin(this.angle), z: Math.cos(this.angle) };
  }

  // Arcade driving for the player's car. Returns true on a hard hit.
  drivePlayer(dt, axes, colliders) {
    const MAX_FWD = 30;
    const MAX_REV = -8;
    if (axes.y > 0) this.speed += 13 * dt;
    else if (axes.y < 0) this.speed -= 17 * dt;
    else {
      // Coast down.
      const drag = 7 * dt;
      if (Math.abs(this.speed) <= drag) this.speed = 0;
      else this.speed -= Math.sign(this.speed) * drag;
    }
    this.speed = clamp(this.speed, MAX_REV, MAX_FWD);
    // Steering: A turns left (heading increases), D turns right.
    // The turn tightens with speed and flips when reversing.
    const steer = clamp(Math.abs(this.speed) / 10, 0, 1);
    this.angle -= axes.x * 2.0 * dt * steer * Math.sign(this.speed || 1);
    const f = this.forward();
    let nx = this.x + f.x * this.speed * dt;
    let nz = this.z + f.z * this.speed * dt;
    // Stay inside the island.
    nx = clamp(nx, -176, 200);
    nz = clamp(nz, -176, 205);
    const before = this.speed;
    const res = collideCircle(nx, nz, this.radius, colliders);
    const hardHit = res.hit && Math.abs(before) > 12;
    if (res.hit) this.speed *= 0.55;
    this.group.position.x = res.x;
    this.group.position.z = res.z;
    this.group.rotation.y = this.angle;
    return hardHit;
  }

  setPose(x, z, heading) {
    this.group.position.x = x;
    this.group.position.z = z;
    this.angle = heading;
    this.group.rotation.y = heading;
    this.speed = 0;
  }

  remove() {
    this.scene.remove(this.group);
  }
}

export class Traffic {
  constructor(scene, count) {
    this.scene = scene;
    this.target = count;
    this.cars = [];
    for (let i = 0; i < count; i++) {
      this.cars.push(this._spawnCar());
    }
  }

  // Top the fleet back up to its target count (a stolen car is
  // replaced so the streets never thin out).
  topUp() {
    while (this.cars.length < this.target) {
      this.cars.push(this._spawnCar());
    }
  }

  _spawnCar() {
    const alongRoad = Math.random() < 0.5;
    const line = ROADS[Math.floor(Math.random() * ROADS.length)];
    const along = -170 + Math.random() * 340;
    const heading = alongRoad
      ? (Math.random() < 0.5 ? 0 : Math.PI)
      : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const x = alongRoad ? along : line;
    const z = alongRoad ? line : along;
    const color = PALETTE.car[Math.floor(Math.random() * PALETTE.car.length)];
    const car = new Car(this.scene, { x, z, heading, color });
    car.cruise = 6 + Math.random() * 3;
    car.speed = car.cruise;
    car._turnKey = '';
    return car;
  }

  // One traffic car follows its road; at intersections it sometimes
  // turns, and it stops for the car directly ahead of it.
  update(dt, others) {
    for (const car of this.cars) {
      const f = car.forward();
      // Car ahead? (traffic + the player's car)
      let blocked = false;
      for (const other of others) {
        if (other === car) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const ahead = dx * f.x + dz * f.z;
        const side = Math.abs(dx * f.z - dz * f.x);
        if (ahead > 0 && ahead < 10 && side < 2.6) { blocked = true; break; }
      }
      const target = blocked ? 0 : car.cruise;
      car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
      let nx = car.x + f.x * car.speed * dt;
      let nz = car.z + f.z * car.speed * dt;
      // Intersection turn: when both coordinates sit near road lines.
      const nearX = ROADS.reduce((a, b) => (Math.abs(b - nx) < Math.abs(a - nx) ? b : a));
      const nearZ = ROADS.reduce((a, b) => (Math.abs(b - nz) < Math.abs(a - nz) ? b : a));
      const key = `${nearX},${nearZ}`;
      if (Math.abs(nearX - nx) < 1.6 && Math.abs(nearZ - nz) < 1.6 && key !== car._turnKey) {
        car._turnKey = key;
        if (Math.abs(nx) > 168 || Math.abs(nz) > 168 || Math.random() < 0.3) {
          // Turn left or right (or back toward the city at the edge).
          const turn = (Math.abs(nx) > 168 || Math.abs(nz) > 168)
            ? (Math.random() < 0.5 ? 1 : -1)
            : (Math.random() < 0.5 ? 1 : -1);
          car.angle = wrapAngle(car.angle + turn * Math.PI / 2);
          // Snap onto the road line we just turned onto.
          if (Math.abs(Math.sin(car.angle)) > 0.7) { nz = nearZ; }
          else { nx = nearX; }
          const nf = car.forward();
          nx = car.x + nf.x * car.speed * dt;
          nz = car.z + nf.z * car.speed * dt;
        }
      }
      nx = clamp(nx, -176, 200);
      nz = clamp(nz, -176, 205);
      car.group.position.x = nx;
      car.group.position.z = nz;
      car.group.rotation.y = car.angle;
    }
  }
}
