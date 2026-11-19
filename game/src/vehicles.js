// Solmar Heat — cars. Builds every car mesh (body, cabin, wheels, lights),
// owns the 14 traffic cars with their road-grid AI, the parked cars
// (red sedan, gold Marlin GT, black Marlin limo — new in R16 — plus
// extras), and the enter/exit + driving physics used by world.js.
// New in R16: the stretch limo (long wheelbase, slower turn) and two new
// paint colours, teal and magenta, in the traffic pool.
import * as THREE from 'three';
import { ROADS, PARKED, TUNING, CAR_COLORS } from './config.js';

export function makeCarMesh(color, kind = 'sedan') {
  const group = new THREE.Group();
  const long = kind === 'limo';
  const len = long ? 7.6 : kind === 'gt' ? 4.6 : 4.2;
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, len), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.65, long ? 3.4 : 2),
    new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: 0.2, metalness: 0.7 }),
  );
  cabin.position.set(0, 1.3, long ? 0.4 : -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const wheelZ = long ? [-2.9, 2.9] : [-1.45, 1.45];
  for (const wz of wheelZ) {
    for (const wx of [-0.95, 0.95]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.42, wz);
      group.add(w);
    }
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xffedb0, emissiveIntensity: 0.9 });
  for (const wx of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.15), lightMat);
    hl.position.set(wx, 0.7, len / 2 + 0.05);
    group.add(hl);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xd92626, emissive: 0xd92626, emissiveIntensity: 0.9 });
  for (const wx of [-0.6, 0.6]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.15), tailMat);
    tl.position.set(wx, 0.7, -len / 2 - 0.05);
    group.add(tl);
  }
  if (kind === 'limo') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.12, len * 0.8), new THREE.MeshStandardMaterial({ color: 0xd9a514, metalness: 0.8, roughness: 0.3 }));
    stripe.position.y = 1.05;
    group.add(stripe);
  }
  return group;
}

export class Car {
  constructor(color, kind, x, z, heading = 0) {
    this.color = color;
    this.kind = kind;
    this.group = makeCarMesh(color, kind);
    this.group.position.set(x, 0, z);
    this.heading = heading;
    this.group.rotation.y = heading;
    this.speed = 0;
    this.isPolice = false;
    this.stolen = false;
    this.length = kind === 'limo' ? 7.6 : 4.4;
  }
  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }
  drive(dt, throttle, steer) {
    // A turns left (heading increases), D turns right. Steering bites
    // harder at low speed and fades near top speed so turns stay tight.
    const dir = this.speed >= 0 ? 1 : -1;
    const grip = Math.max(0.35, 1 - Math.abs(this.speed) / (TUNING.carTopSpeed * 1.6));
    this.heading += steer * TUNING.carTurn * grip * dt * dir * (this.kind === 'limo' ? 0.75 : 1);
    this.speed += throttle * TUNING.carAccel * dt;
    if (throttle === 0) this.speed *= Math.pow(0.4, dt);
    const top = this.kind === 'limo' ? TUNING.carTopSpeed * 0.92 : TUNING.carTopSpeed;
    this.speed = Math.max(-9, Math.min(top, this.speed));
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    this.group.position.x += Math.sin(this.heading) * this.speed * dt;
    this.group.position.z += Math.cos(this.heading) * this.speed * dt;
    this.group.rotation.y = this.heading;
  }
}

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    const palette = [
      CAR_COLORS.blue, CAR_COLORS.white, CAR_COLORS.yellow, CAR_COLORS.green,
      CAR_COLORS.orange, CAR_COLORS.teal, CAR_COLORS.magenta, CAR_COLORS.purple,
      CAR_COLORS.silver, CAR_COLORS.red, CAR_COLORS.blue, CAR_COLORS.white,
      CAR_COLORS.teal, CAR_COLORS.yellow,
    ];
    for (let i = 0; i < 14; i++) {
      const road = ROADS[(i * 3 + 1) % ROADS.length];
      const along = -162 + ((i * 53) % 324);
      const vertical = i % 2 === 0;
      const x = vertical ? road : along;
      const z = vertical ? along : road;
      const heading = vertical ? (i % 4 < 2 ? 0 : Math.PI) : (i % 4 < 2 ? Math.PI / 2 : -Math.PI / 2);
      const car = new Car(palette[i], 'sedan', x, z, heading);
      car.speed = TUNING.trafficSpeed * (0.8 + (i % 3) * 0.15);
      car.nextTurn = 40 + (i % 5) * 20;
      this.cars.push(car);
      scene.add(car.group);
    }
  }
  update(dt, colliders, playerCar) {
    for (const car of this.cars) {
      if (playerCar && car === playerCar) continue;
      // Brake if another car is close ahead.
      let blocked = false;
      for (const other of this.cars) {
        if (other === car || other === playerCar) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 9 && side < 3) { blocked = true; break; }
      }
      if (playerCar) {
        const dx = playerCar.x - car.x;
        const dz = playerCar.z - car.z;
        const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 9 && side < 3.5) blocked = true;
      }
      const target = blocked ? 0 : TUNING.trafficSpeed;
      car.speed += Math.sign(target - car.speed) * 8 * dt;
      car.group.position.x += Math.sin(car.heading) * car.speed * dt;
      car.group.position.z += Math.cos(car.heading) * car.speed * dt;
      car.group.rotation.y = car.heading;
      // Turn at the next intersection: pick a fresh road direction.
      car.nextTurn -= Math.abs(car.speed) * dt;
      const nearRoadX = ROADS.reduce((a, b) => Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a);
      const nearRoadZ = ROADS.reduce((a, b) => Math.abs(b - car.z) < Math.abs(a - car.z) ? b : a);
      if (car.nextTurn <= 0 && Math.abs(car.x - nearRoadX) < 2 && Math.abs(car.z - nearRoadZ) < 2) {
        car.heading = (Math.floor(Math.random() * 4) * Math.PI) / 2;
        car.nextTurn = 60 + Math.random() * 80;
      }
      // Keep inside the city; bounce back at the edge.
      if (Math.abs(car.x) > 185 || Math.abs(car.z) > 185) car.heading += Math.PI;
    }
  }
}

export class ParkedCars {
  constructor(scene) {
    this.scene = scene;
    this.redSedan = new Car(PARKED.redSedan.color, PARKED.redSedan.kind, PARKED.redSedan.x, PARKED.redSedan.z, Math.PI / 2);
    this.goldGt = new Car(PARKED.goldGt.color, PARKED.goldGt.kind, PARKED.goldGt.x, PARKED.goldGt.z, Math.PI / 2);
    this.limo = new Car(PARKED.limo.color, PARKED.limo.kind, PARKED.limo.x, PARKED.limo.z, Math.PI / 2);
    this.extras = PARKED.extras.map((e) => new Car(e.color, e.kind, e.x, e.z, Math.PI / 2));
    for (const c of [this.redSedan, this.goldGt, this.limo, ...this.extras]) scene.add(c.group);
  }
  all() { return [this.redSedan, this.goldGt, this.limo, ...this.extras]; }
}
