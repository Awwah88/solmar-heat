// Solmar Heat — vehicles: car meshes, traffic AI, parked story cars (Round 17).
// Heading convention: forward = (sin h, cos h) in (x, z); A increases heading.
// driveCar() is the shared player-car physics used by world.js.
import * as THREE from 'three';
import { ROADS, TUNING, mulberry32, clamp } from './config.js';

const CAR_COLORS = [0xc22424, 0x2e6fc2, 0xe0a52e, 0x3f9e4d, 0x8a8f96, 0x6a4a9e, 0xd8d8d8, 0x222222];

export function makeCarMesh(kind, color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x11131a, roughness: 0.2, metalness: 0.6 });
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  let len = 4.4;
  let bodyH = 1.0;
  let bodyY = 0.75;
  if (kind === 'limo') { len = 6.6; bodyH = 1.1; }
  if (kind === 'van') { len = 5.0; bodyH = 2.0; bodyY = 1.25; }
  if (kind === 'truck') { len = 5.2; bodyH = 1.4; bodyY = 1.0; }
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, bodyH, 2.0), bodyMat);
  body.position.y = bodyY;
  body.castShadow = true;
  g.add(body);
  if (kind !== 'van') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(len * 0.45, 0.75, 1.8), darkMat);
    cabin.position.set(-len * 0.05, bodyY + bodyH / 2 + 0.32, 0);
    cabin.castShadow = true;
    g.add(cabin);
  } else {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(len * 0.9, 0.3, 2.02), new THREE.MeshBasicMaterial({ color: 0xffc233 }));
    stripe.position.set(0, 1.9, 0);
    g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 1.6), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(-0.5, 2.35, 0);
    g.add(bar);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.28, 1.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(-0.2, bodyY + bodyH / 2 + 0.85, -0.4);
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.28, 1.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar2.position.set(-0.2, bodyY + bodyH / 2 + 0.85, 0.4);
    g.add(bar2);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 });
  for (const [wx, wz] of [[len / 2 - 0.8, 0.95], [len / 2 - 0.8, -0.95], [-len / 2 + 0.8, 0.95], [-len / 2 + 0.8, -0.95]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
  }
  // Headlights (front = +x in local space) and taillights.
  for (const wz of [0.6, -0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.42), lensMat);
    hl.position.set(len / 2 + 0.02, 0.85, wz);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.42), tailMat);
    tl.position.set(-len / 2 - 0.02, 0.85, wz);
    g.add(tl);
  }
  // Face the group along +z when heading = 0: rotate so local +x maps to heading.
  g.rotation.y = 0;
  return g;
}

export class Car {
  constructor(scene, kind, color, x, z, heading) {
    this.kind = kind;
    this.color = color;
    this.speed = 0;
    this.heading = heading || 0;
    this.group = makeCarMesh(kind, color);
    this.group.position.set(x, 0, z);
    this.group.rotation.y = -this.heading + Math.PI / 2;
    scene.add(this.group);
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  place(x, z, heading) {
    this.group.position.set(x, 0, z);
    this.heading = heading;
    this.group.rotation.y = -this.heading + Math.PI / 2;
  }

  syncRotation() {
    this.group.rotation.y = -this.heading + Math.PI / 2;
  }
}

// Player-car physics. Returns true when the car hit a collider this frame.
export function driveCar(car, steer, throttle, handbrake, dt, colliders) {
  const maxSpeed = car.kind === 'van' ? TUNING.vanMaxSpeed : car.kind === 'limo' ? TUNING.limoMaxSpeed : TUNING.carMaxSpeed;
  const accel = car.kind === 'van' ? TUNING.vanAccel : TUNING.carAccel;
  if (throttle > 0) car.speed += accel * dt;
  else if (throttle < 0) car.speed -= TUNING.carBrake * dt;
  else car.speed -= car.speed * 0.8 * dt;
  if (handbrake) car.speed -= car.speed * 4 * dt;
  car.speed = clamp(car.speed, -TUNING.carReverseMax, maxSpeed);
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
  const steerFactor = clamp(Math.abs(car.speed) / 9, 0.25, 1);
  car.heading += steer * TUNING.carTurn * dt * steerFactor * Math.sign(car.speed || 1);
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  let nx = car.x + fx * car.speed * dt;
  let nz = car.z + fz * car.speed * dt;
  let hit = false;
  const R = 2.0;
  for (const c of colliders) {
    if (nx + R > c.xmin && nx - R < c.xmax && nz + R > c.zmin && nz - R < c.zmax) {
      const pushL = nx + R - c.xmin;
      const pushR = c.xmax - (nx - R);
      const pushU = nz + R - c.zmin;
      const pushD = c.zmax - (nz - R);
      const m = Math.min(pushL, pushR, pushU, pushD);
      if (m === pushL) nx = c.xmin - R;
      else if (m === pushR) nx = c.xmax + R;
      else if (m === pushU) nz = c.zmin - R;
      else nz = c.zmax + R;
      hit = true;
    }
  }
  nx = clamp(nx, -178, 178);
  nz = clamp(nz, -178, 178);
  if (hit) car.speed *= 0.4;
  car.group.position.set(nx, 0, nz);
  car.syncRotation();
  return hit;
}

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.cars = [];
    const rng = mulberry32(777);
    for (let i = 0; i < 14; i++) {
      const horizontal = rng() < 0.5;
      const road = ROADS[Math.floor(rng() * ROADS.length)];
      const along = -150 + rng() * 300;
      const dir = rng() < 0.5 ? 1 : -1;
      const color = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
      const kind = rng() < 0.15 ? 'truck' : 'sedan';
      const car = new Car(scene, kind, color, horizontal ? along : road, horizontal ? road : along, horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI));
      car.horizontal = horizontal;
      car.road = road;
      car.dir = dir;
      car.cruise = 7 + rng() * 5;
      car.speed = car.cruise;
      this.cars.push(car);
    }
  }

  update(dt, playerCar, playerPos) {
    for (const car of this.cars) {
      // Brake if something is right ahead (player car or another traffic car).
      let blocked = false;
      const ax = Math.sin(car.heading);
      const az = Math.cos(car.heading);
      const check = (ox, oz) => {
        const dx = ox - car.x;
        const dz = oz - car.z;
        const ahead = dx * ax + dz * az;
        const side = Math.abs(dx * az - dz * ax);
        return ahead > 0 && ahead < 11 && side < 3.2;
      };
      if (playerCar && check(playerCar.x, playerCar.z)) blocked = true;
      if (playerPos && !playerCar && check(playerPos.x, playerPos.z)) blocked = true;
      if (!blocked) {
        for (const other of this.cars) {
          if (other !== car && check(other.x, other.z)) { blocked = true; break; }
        }
      }
      const target = blocked ? 0 : car.cruise;
      car.speed += clamp(target - car.speed, -14 * dt, 8 * dt);
      let nx = car.x + ax * car.speed * dt;
      let nz = car.z + az * car.speed * dt;
      // At a road crossing, sometimes turn onto the crossing road.
      const along = car.horizontal ? nx : nz;
      let nearCross = Infinity;
      for (const r of ROADS) nearCross = Math.min(nearCross, Math.abs(along - r));
      if (nearCross < 1.2 && Math.random() < 0.012) {
        car.horizontal = !car.horizontal;
        const crossCoord = car.horizontal ? nz : nx;
        let best = ROADS[0];
        let bd = Infinity;
        for (const r of ROADS) {
          const d = Math.abs(r - crossCoord);
          if (d < bd) { bd = d; best = r; }
        }
        car.road = best;
        const nd = Math.random() < 0.5 ? 1 : -1;
        car.dir = nd;
        car.heading = car.horizontal ? (nd > 0 ? Math.PI / 2 : -Math.PI / 2) : (nd > 0 ? 0 : Math.PI);
        car.syncRotation();
      }
      // Wrap around the city edge instead of driving into the sea.
      if (nx > 168 || nx < -168 || nz > 168 || nz < -168) {
        car.dir *= -1;
        car.heading += Math.PI;
        car.syncRotation();
        nx = clamp(nx, -165, 165);
        nz = clamp(nz, -165, 165);
      }
      car.group.position.set(nx, 0, nz);
    }
  }
}

export class Parked {
  constructor(scene) {
    this.redSedan = null;
    this.goldGt = null;
    this.limo = null;
    this.van = null;
    this.all = [];
    this.scene = scene;
  }

  placeAll(defs) {
    for (const def of defs) {
      const car = new Car(this.scene, def.kind, def.color, def.x, def.z, def.heading || 0);
      car.parked = true;
      car.label = def.label;
      this.all.push(car);
      if (def.key === 'red') this.redSedan = car;
      if (def.key === 'gold') this.goldGt = car;
      if (def.key === 'limo') this.limo = car;
      if (def.key === 'van') this.van = car;
    }
  }
}
