// Cars for Solmar Heat: a mesh factory, 14 traffic cars that loop the road
// grid, and the two parked story cars (red sedan, gold Marlin GT).

import { PARKED, ROADS, TUNING, clamp, pick, wrapAngle } from './config.js';

export function makeCarMesh(THREE, color, opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.4), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.1), glass);
  cabin.position.set(0, 1.28, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const lx of [-0.6, 0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), lightMat);
    l.position.set(lx, 0.62, 2.21);
    g.add(l);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xc22a2a });
  for (const lx of [-0.6, 0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), tailMat);
    l.position.set(lx, 0.62, -2.21);
    g.add(l);
  }
  if (opts.sport) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), paint);
    spoiler.position.set(0, 1.25, -2.1);
    g.add(spoiler);
  }
  return g;
}

function loopRoute(rng) {
  // A rectangular loop of road intersections.
  const xs = [...ROADS].sort(() => rng() - 0.5).slice(0, 2);
  const zs = [...ROADS].sort(() => rng() - 0.5).slice(0, 2);
  const [x1, x2] = [Math.min(...xs), Math.max(...xs)];
  const [z1, z2] = [Math.min(...zs), Math.max(...zs)];
  return [[x1, z1], [x2, z1], [x2, z2], [x1, z2]];
}

export class TrafficSystem {
  constructor(THREE, scene, rng) {
    this.THREE = THREE;
    this.scene = scene;
    this.rng = rng;
    this.cars = [];
    const colors = [0x3a6fd8, 0xd8d8d8, 0x2a2a2a, 0x7a4fd0, 0x3f7d4e, 0xc9a227, 0x8a6b46, 0x5a8a8a];
    for (let i = 0; i < 14; i++) {
      const route = loopRoute(rng);
      const [sx, sz] = route[0];
      const color = pick(rng, colors);
      const group = makeCarMesh(THREE, color);
      group.position.set(sx, 0, sz);
      scene.add(group);
      this.cars.push({
        group,
        color,
        speed: 5 + rng() * 2.5,
        heading: 0,
        route,
        wp: 1,
        lane: (rng() < 0.5 ? -1 : 1) * 2.4,
        traffic: true,
        name: 'Traffic',
      });
    }
  }

  update(dt) {
    for (const car of this.cars) {
      const [tx, tz] = car.route[car.wp];
      let dx = tx - car.group.position.x;
      let dz = tz - car.group.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.5) {
        car.wp = (car.wp + 1) % car.route.length;
        continue;
      }
      // Aim at the waypoint shifted into the car's own lane.
      dx /= d;
      dz /= d;
      const ox = tx - dz * car.lane;
      const oz = tz + dx * car.lane;
      const gx = ox - car.group.position.x;
      const gz = oz - car.group.position.z;
      const target = Math.atan2(gx, gz);
      car.heading = wrapAngle(car.heading + clamp(wrapAngle(target - car.heading), -3.0 * dt, 3.0 * dt));
      const step = car.speed * dt;
      car.group.position.x += Math.sin(car.heading) * step;
      car.group.position.z += Math.cos(car.heading) * step;
      car.group.rotation.y = car.heading;
    }
  }

  nearest(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of this.cars) {
      const d = Math.hypot(car.group.position.x - x, car.group.position.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }
}

export function makeParkedCar(THREE, scene, spec, sport = false) {
  const group = makeCarMesh(THREE, spec.color, { sport });
  group.position.set(spec.x, 0, spec.z);
  group.rotation.y = spec.heading;
  scene.add(group);
  return {
    group,
    color: spec.color,
    speed: 0,
    heading: spec.heading,
    parked: true,
    name: spec.name,
    traffic: false,
  };
}

export function parkedCars(THREE, scene) {
  return {
    redSedan: makeParkedCar(THREE, scene, PARKED.redSedan),
    goldGt: makeParkedCar(THREE, scene, PARKED.goldGt, true),
  };
}
