// Cars: a shared builder plus traffic AI that follows the road grid.
// Traffic cruises slowly, brakes for the player on foot ahead of it, and
// pauses at some intersections — so stealing one on foot is actually doable.
import * as THREE from 'three';
import { GRID, TUNING, makeRng, pick, clamp, wrapAngle } from './config.js';

const CAR_COLORS = [0x3b82f6, 0x22c55e, 0xeab308, 0xf97316, 0x8b5cf6, 0xec4899, 0x14b8a6, 0x64748b];

export function buildCar(color, opts = {}) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.25, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    group.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c9, emissive: 0xffe9a8, emissiveIntensity: 0.5 });
  for (const x of [-0.7, 0.7]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), lightMat);
    l.position.set(x, 0.7, 2.21);
    group.add(l);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.4 });
  for (const x of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), tailMat);
    t.position.set(x, 0.7, -2.21);
    group.add(t);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x111827 }));
    bar.position.set(0, 1.7, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshLambertMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.9 }));
    red.position.set(-0.32, 1.86, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshLambertMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 0.9 }));
    blue.position.set(0.32, 1.86, -0.2);
    group.add(blue);
  }
  return { group, wheels, bodyMat, color, angle: 0, speed: 0, kind: opts.kind || 'traffic' };
}

export class Traffic {
  constructor(scene, city, seed) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed || 11);
    this.cars = [];
    for (let i = 0; i < TUNING.trafficCount; i++) {
      const car = buildCar(pick(this.rng, CAR_COLORS));
      const axis = this.rng() < 0.5 ? 'x' : 'z';
      const road = pick(this.rng, GRID.roads);
      const along = -162 + this.rng() * 324;
      const lane = this.rng() < 0.5 ? -2.5 : 2.5;
      if (axis === 'x') {
        car.group.position.set(along, 0, road + lane);
        car.angle = this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.group.position.set(road + lane, 0, along);
        car.angle = this.rng() < 0.5 ? 0 : Math.PI;
      }
      car.speed = 4.2 + this.rng() * 1.3;
      car.cruise = car.speed;
      car.pause = 0;
      car.nextTurn = 30 + this.rng() * 60;
      scene.add(car.group);
      this.cars.push(car);
    }
  }

  // One step of traffic: follow the road, slow near intersections, pause
  // sometimes, and never run the player down when they step in front.
  update(dt, player) {
    for (const car of this.cars) {
      if (car.pause > 0) {
        car.pause -= dt;
        car.speed = Math.max(0, car.speed - 20 * dt);
        continue;
      }
      const p = car.group.position;
      // Distance to the next intersection along the current heading.
      const fwd = { x: Math.sin(car.angle), z: Math.cos(car.angle) };
      let toCross = Infinity;
      for (const r of GRID.roads) {
        const d = Math.abs(fwd.x) > 0.5 ? (r - p.x) / fwd.x : (r - p.z) / fwd.z;
        if (d > 2 && d < toCross) toCross = d;
      }
      let want = car.cruise;
      if (toCross < 12) want = Math.min(want, 3);
      // Brake for the player on foot right ahead.
      if (player && !player.car) {
        const dx = player.x - p.x;
        const dz = player.z - p.z;
        const ahead = dx * fwd.x + dz * fwd.z;
        const side = Math.abs(dx * fwd.z - dz * fwd.x);
        if (ahead > 0 && ahead < 9 && side < 3) want = 0;
      }
      // Brake for a slow car ahead.
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.group.position.x - p.x;
        const dz = other.group.position.z - p.z;
        const ahead = dx * fwd.x + dz * fwd.z;
        const side = Math.abs(dx * fwd.z - dz * fwd.x);
        if (ahead > 0 && ahead < 10 && side < 3.5) want = Math.min(want, other.speed);
      }
      car.speed += clamp(want - car.speed, -14 * dt, 8 * dt);
      p.x += fwd.x * car.speed * dt;
      p.z += fwd.z * car.speed * dt;
      car.nextTurn -= car.speed * dt;
      // At an intersection, sometimes turn, sometimes pause, else carry on.
      if (toCross < 2.5 && car.nextTurn <= 0) {
        car.nextTurn = 36 + this.rng() * 40;
        const roll = this.rng();
        if (roll < 0.3) {
          car.pause = 1.5 + this.rng() * 1.0;
        } else if (roll < 0.55) {
          car.angle += (this.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
        }
        // Snap onto the lane of the new heading.
        const lane = this.rng() < 0.5 ? -2.5 : 2.5;
        if (Math.abs(Math.sin(car.angle)) > 0.5) {
          const road = GRID.roads.reduce((a, b) => (Math.abs(b - p.z) < Math.abs(a - p.z) ? b : a));
          p.z = road + lane;
        } else {
          const road = GRID.roads.reduce((a, b) => (Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a));
          p.x = road + lane;
        }
      }
      // Wrap around the city edge instead of driving into the sea.
      if (p.x > 176 || p.x < -176 || p.z > 176 || p.z < -176) {
        car.angle += Math.PI;
        p.x = clamp(p.x, -170, 170);
        p.z = clamp(p.z, -170, 170);
      }
      car.group.rotation.y = car.angle;
      for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.42;
    }
  }

  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }

  nearest(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of this.cars) {
      const dx = car.group.position.x - x;
      const dz = car.group.position.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best ? { car: best, dist: bestD } : null;
  }
}
