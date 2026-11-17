// Solmar Heat — cars: the player's ride, parked cars, traffic and the
// road autopilot that drives the story missions in the playtest.
// Physics are arcade on purpose: throttle, brake, steering that scales
// with speed, and circle-vs-building collisions from the city.

import * as THREE from 'three';
import { CITY, TUNING, PARKED_CARS, RED_CAR, TAXI, clamp, wrapAngle, dist2d, forwardOf, mulberry32 } from './config.js';

const CAR_COLORS = [0x2e6fb7, 0xe8e8e8, 0x3fa34d, 0xf2a541, 0x8e44ad, 0x5d6d7e, 0xc0392b, 0x16a085];

function buildCarMesh(color, kind) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c1e22 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc4d8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.3), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.08, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2d2d }));
    bar.position.set(0, 1.45, -0.25);
    bar.name = 'lightbar';
    group.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.18, 4.32), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sign.position.set(0, 1.5, -0.25);
    group.add(sign);
  }
  return group;
}

export class Car {
  constructor(game, opts) {
    this.game = game;
    this.kind = opts.kind || 'parked';
    this.name = opts.name || 'Car';
    this.color = opts.color ?? 0x888888;
    this.pos = new THREE.Vector3(opts.x, 0, opts.z);
    this.heading = opts.heading || 0;
    this.speed = 0;
    this.steerVisual = 0;
    this.mesh = buildCarMesh(this.color, this.kind);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    game.scene.add(this.mesh);
    this.stuckTimer = 0;
    this.lastX = this.pos.x;
    this.lastZ = this.pos.z;
    this.reverseTimer = 0;
    this.trafficTarget = null;
    this.waitTimer = 0;
  }

  setHeading(h) {
    this.heading = h;
    this.mesh.rotation.y = h;
  }

  // One physics step for a driven car. throttle -1..1, steer -1..1.
  drive(throttle, steer, dt) {
    const wasMoving = Math.abs(this.speed) > 0.5;
    if (throttle > 0) {
      this.speed += TUNING.carAccel * throttle * dt;
    } else if (throttle < 0) {
      if (this.speed > 0.5) this.speed += TUNING.carBrake * throttle * dt;
      else this.speed += TUNING.carReverseAccel * throttle * dt;
    }
    this.speed -= this.speed * TUNING.carDrag * dt;
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    this.speed = clamp(this.speed, -TUNING.carMaxReverse, TUNING.carMaxSpeed);
    const turn = clamp(this.speed / 10, -1, 1);
    this.heading += steer * turn * TUNING.carTurnRate * dt;
    this.heading = wrapAngle(this.heading);
    const f = forwardOf(this.heading);
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    if (this.game.city.collideCircle(this.pos, 2.2)) {
      if (wasMoving && Math.abs(this.speed) > 4) {
        this.speed *= 0.45;
        this.game.combat.damage(0, true);
      } else {
        this.speed *= 0.6;
      }
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }

  stop() {
    this.speed = 0;
  }
}

export class VehicleSystem {
  constructor(game) {
    this.game = game;
    this.cars = [];
    this.traffic = { cars: [] };
    this.redCar = null;
    this.taxiCar = null;
    this.rng = game.seed ? mulberry32(game.seed) : Math.random;
  }

  build() {
    const g = this.game;
    this.redCar = new Car(g, { kind: 'parked', name: RED_CAR.name, color: RED_CAR.color, x: RED_CAR.x, z: RED_CAR.z, heading: RED_CAR.heading });
    this.cars.push(this.redCar);
    for (const p of PARKED_CARS) {
      const car = new Car(g, { kind: 'parked', name: p.name, color: p.color, x: p.x, z: p.z, heading: p.heading });
      this.cars.push(car);
    }
    this.taxiCar = new Car(g, { kind: 'taxi', name: 'Taxi', color: TAXI.color, x: TAXI.x, z: TAXI.z, heading: TAXI.heading });
    this.cars.push(this.taxiCar);
    for (let i = 0; i < TUNING.trafficCount; i++) {
      const car = new Car(g, {
        kind: 'traffic',
        name: 'Traffic',
        color: CAR_COLORS[i % CAR_COLORS.length],
        x: this._roadCoord(),
        z: this._roadCoord(),
        heading: (Math.floor(this.rng() * 4) * Math.PI) / 2,
      });
      car.trafficTarget = this._nextIntersection(car);
      this.cars.push(car);
      this.traffic.cars.push(car);
    }
    return this;
  }

  _roadCoord() {
    return -160 + Math.floor(this.rng() * 9) * 40;
  }

  _nextIntersection(car) {
    // Pick a neighbouring intersection on the road grid.
    const x = Math.round(car.pos.x / 40) * 40;
    const z = Math.round(car.pos.z / 40) * 40;
    const options = [];
    if (x > -160) options.push({ x: x - 40, z });
    if (x < 160) options.push({ x: x + 40, z });
    if (z > -160) options.push({ x, z: z - 40 });
    if (z < 160) options.push({ x, z: z + 40 });
    return options[Math.floor(this.rng() * options.length)] || { x, z };
  }

  // Cars the player can steal: parked cars and the taxi, not traffic in
  // motion and never a police car.
  stealableCars() {
    return this.cars.filter((c) => c.kind === 'parked' || c.kind === 'taxi');
  }

  nearestCar(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.stealableCars()) {
      if (c === this.game.player.car) continue;
      const d = dist2d(pos.x, pos.z, c.pos.x, c.pos.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  // The road autopilot: steer a car toward a waypoint, braking for sharp
  // turns and for the final approach, and reversing out when stuck.
  autopilotDrive(car, target, dt) {
    const dx = target.x - car.pos.x;
    const dz = target.z - car.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const desired = Math.atan2(dx, dz);
    const diff = wrapAngle(desired - car.heading);
    // Stuck detection: barely moved in 3 game-seconds while trying.
    const moved = dist2d(car.pos.x, car.pos.z, car.lastX, car.lastZ);
    if (moved < 0.5) car.stuckTimer += dt;
    else car.stuckTimer = 0;
    car.lastX = car.pos.x;
    car.lastZ = car.pos.z;
    if (car.stuckTimer > 3 && car.reverseTimer <= 0) {
      car.reverseTimer = 1.0;
      car.stuckTimer = 0;
    }
    if (car.reverseTimer > 0) {
      car.reverseTimer -= dt;
      car.drive(-1, diff > 0 ? -0.7 : 0.7, dt);
      return dist;
    }
    const steer = clamp(diff * 2.4, -1, 1);
    let throttle = 1;
    // Brake for a sharp turn ahead, or while closing on the waypoint.
    if (Math.abs(diff) > 0.6 && car.speed > 8) throttle = -1;
    else if (dist < 25 && car.speed > 8) throttle = -1;
    else if (dist < 25) throttle = 0.45;
    else if (Math.abs(diff) > 0.6) throttle = 0.3;
    car.drive(throttle, steer, dt);
    return dist;
  }

  update(dt) {
    const g = this.game;
    for (const car of this.traffic.cars) {
      if (!car.trafficTarget) car.trafficTarget = this._nextIntersection(car);
      const d = this.autopilotDrive(car, car.trafficTarget, dt);
      if (d < 5) car.trafficTarget = this._nextIntersection(car);
    }
    // Gentle car-vs-car separation so traffic and police never fuse.
    const all = this.cars.filter((c) => c.kind === 'traffic' || c.kind === 'police' || c === g.player.car);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (!a || !b) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 16 && d2 > 0.001) {
          const d = Math.sqrt(d2);
          const push = (4 - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          if (a !== g.player.car) {
            a.pos.x -= nx * push;
            a.pos.z -= nz * push;
          }
          if (b !== g.player.car) {
            b.pos.x += nx * push;
            b.pos.z += nz * push;
          }
          a.mesh.position.copy(a.pos);
          b.mesh.position.copy(b.pos);
        }
      }
    }
  }
}
