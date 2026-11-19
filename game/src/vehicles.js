// Cars: a box-body factory plus the traffic system. Traffic cars drive
// intersection to intersection along the road grid, so they never leave
// the roads. The player's car uses arcade physics with steering that
// flips with reverse (A turns left = heading increases, D turns right).
import * as THREE from "three";
import { ROAD_CENTRES, clamp, dist2d, forwardOf, makeRng, pick, wrapAngle } from "./config.js";

function paint(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 });
}

export function buildCarMesh(color, police = false) {
  const group = new THREE.Group();
  const bodyMat = paint(color);
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.35, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), darkMat);
  cabin.position.set(0, 1.25, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.95 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xaa9955, emissiveIntensity: 0.8 });
  for (const s of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.12), lightMat);
    lamp.position.set(s, 0.7, 2.22);
    group.add(lamp);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xcc1111, emissive: 0x770000, emissiveIntensity: 0.8 });
  for (const s of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.12), tailMat);
    lamp.position.set(s, 0.7, -2.22);
    group.add(lamp);
  }
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.4 }));
    bar.position.set(0, 1.68, -0.25);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1.4 }));
    red.position.set(-0.32, 1.68, -0.25);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x0022ff, emissiveIntensity: 1.4 }));
    blue.position.set(0.32, 1.68, -0.25);
    group.add(blue);
  }
  return group;
}

export class Car {
  constructor(scene, color, x, z, heading, police = false) {
    this.scene = scene;
    this.group = buildCarMesh(color, police);
    this.group.position.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.color = color;
    this.police = police;
    this.stolen = false;
    this.target = null;
    scene.add(this.group);
  }

  get x() {
    return this.group.position.x;
  }

  get z() {
    return this.group.position.z;
  }

  setPose(x, z, heading) {
    this.group.position.set(x, 0, z);
    this.heading = heading;
    this.group.rotation.y = heading;
  }

  sync() {
    this.group.rotation.y = this.heading;
  }

  remove() {
    this.scene.remove(this.group);
  }
}

const TRAFFIC_COLORS = [0x3a6ad8, 0xd8d8d8, 0x2ad8a5, 0xd8a52a, 0x8e4ad8, 0xc25a2a, 0x5a8e6a, 0x9e9e9e];

export class Traffic {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.rng = makeRng(seed + 77);
    this.cars = [];
    for (let i = 0; i < 14; i++) {
      const road = pick(this.rng, ROAD_CENTRES);
      const along = -160 + this.rng() * 320;
      const alongRoad = this.rng() < 0.5;
      const x = alongRoad ? road : along;
      const z = alongRoad ? along : road;
      const heading = alongRoad ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const car = new Car(scene, pick(this.rng, TRAFFIC_COLORS), x, z, heading);
      car.cruise = 8 + this.rng() * 4;
      car.target = this._nextIntersection(x, z, heading);
      car.speed = car.cruise;
      car.sync();
      this.cars.push(car);
    }
  }

  _nextIntersection(x, z, heading) {
    const near = (v) => ROAD_CENTRES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const cx = near(x);
    const cz = near(z);
    const f = forwardOf(heading);
    const options = [];
    if (Math.abs(f.x) > Math.abs(f.z)) {
      const nx = clamp(cx + Math.sign(f.x) * 36, -162, 162);
      options.push({ x: nx, z: cz });
      options.push({ x: cx, z: clamp(cz + 36, -162, 162) });
      options.push({ x: cx, z: clamp(cz - 36, -162, 162) });
    } else {
      const nz = clamp(cz + Math.sign(f.z) * 36, -162, 162);
      options.push({ x: cx, z: nz });
      options.push({ x: clamp(cx + 36, -162, 162), z: cz });
      options.push({ x: clamp(cx - 36, -162, 162), z: cz });
    }
    return options[Math.floor(this.rng() * options.length)];
  }

  update(dt) {
    for (const car of this.cars) {
      if (!car.target) car.target = this._nextIntersection(car.x, car.z, car.heading);
      const d = dist2d(car.x, car.z, car.target.x, car.target.z);
      if (d < 5) {
        car.target = this._nextIntersection(car.target.x, car.target.z, car.heading);
        continue;
      }
      const desired = Math.atan2(car.target.x - car.x, car.target.z - car.z);
      const err = wrapAngle(desired - car.heading);
      const turn = clamp(err * 1.6, -1.4, 1.4);
      car.heading += turn * dt;
      const f = forwardOf(car.heading);
      car.group.position.x += f.x * car.cruise * dt;
      car.group.position.z += f.z * car.cruise * dt;
      car.speed = car.cruise;
      car.sync();
    }
  }

  nearest(x, z, maxD = 30) {
    let best = null;
    let bestD = maxD;
    for (const car of this.cars) {
      const d = dist2d(x, z, car.x, car.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return { car: best, dist: bestD };
  }

  removeCar(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }
}
