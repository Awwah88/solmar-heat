// Cars: a shared mesh factory, the traffic AI that cruises the road
// grid, and the parked cars the player can steal.
import * as THREE from 'three';
import { CFG, makeRng, clamp, wrapAngle } from './config.js';

export function makeCar(color, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14161c });
  // The car's forward is local +Z, so rotation.y = heading points it
  // along (sin h, 0, cos h) — the same convention the driver steers by.
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.05, 4.4), paint);
  body.position.y = 0.75;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.85, 2.3), dark);
  cabin.position.set(0, 1.65, -0.25);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0c0e });
  const wheels = [];
  for (const [wx, wz] of [[0.95, 1.45], [-0.95, 1.45], [0.95, -1.45], [-0.95, -1.45]]) {
    // A group holds the axle orientation; the mesh spins on its own axis.
    const axle = new THREE.Group();
    axle.position.set(wx, 0.42, wz);
    axle.rotation.z = Math.PI / 2;
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    axle.add(w);
    group.add(axle);
    wheels.push(w);
  }
  // Headlights (front, +Z) and taillights (rear, -Z).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x881111 });
  for (const wx of [0.62, -0.62]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.15), headMat);
    h.position.set(wx, 0.85, 2.22);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.15), tailMat);
    t.position.set(wx, 0.85, -2.22);
    group.add(t);
  }
  if (opts.police) {
    const bar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    r.position.x = -0.35;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    b.position.x = 0.35;
    bar.add(r); bar.add(b);
    bar.position.set(0, 2.25, -0.25);
    group.add(bar);
    group.userData.lightBar = bar;
  }
  if (opts.gold) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.12, 4.5), new THREE.MeshBasicMaterial({ color: 0xfff2a0 }));
    trim.position.y = 1.32;
    group.add(trim);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return {
    group, wheels, color,
    speed: 0, heading: 0, isPolice: !!opts.police,
    // Muzzle/tire smoke puff hook, set by the owner.
    smokeAt: null,
    setHeading(h) {
      this.heading = h;
      this.group.rotation.y = h;
    },
    place(x, z, heading) {
      this.group.position.set(x, 0, z);
      this.setHeading(heading);
    },
  };
}

// --- traffic: 14 cars cruising the road grid ---------------------------
export function createTraffic(scene, colliders) {
  const rng = makeRng(777);
  const cars = [];
  const palette = CFG.colors.car;
  for (let i = 0; i < 14; i++) {
    const color = palette[i % palette.length];
    const car = makeCar(color);
    // Pick a road line and a spot along it.
    const vertical = rng() < 0.5;
    const line = CFG.roads[Math.floor(rng() * CFG.roads.length)];
    const along = -150 + rng() * 300;
    const x = vertical ? line : along;
    const z = vertical ? along : line;
    car.place(x, z, vertical ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2));
    car.speed = 7 + rng() * 4;
    car.cruise = car.speed;
    car.vertical = vertical;
    car.dir = car.heading === 0 || car.heading === Math.PI / 2 ? 1 : -1;
    car.shoveUntil = 0;
    scene.add(car.group);
    cars.push(car);
  }

  function step(car, dt, now) {
    // Drive along the current road; at an intersection, sometimes turn.
    const p = car.group.position;
    const speed = car.speed;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    p.x += fx * speed * dt;
    p.z += fz * speed * dt;
    // Turn at intersections: snap to the crossing road when close.
    const onX = CFG.roads.reduce((a, b) => (Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a));
    const onZ = CFG.roads.reduce((a, b) => (Math.abs(b - p.z) < Math.abs(a - p.z) ? b : a));
    if (Math.abs(p.x - onX) < 1.2 && Math.abs(p.z - onZ) < 1.2 && rng() < 0.35) {
      const turn = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      car.setHeading(car.heading + turn);
      p.x = onX; p.z = onZ;
    }
    // Wrap around the city edge instead of driving into the sea.
    if (p.x > 168) { p.x = 168; car.setHeading(-Math.PI / 2); }
    if (p.x < -168) { p.x = -168; car.setHeading(Math.PI / 2); }
    if (p.z > 168) { p.z = 168; car.setHeading(Math.PI); }
    if (p.z < -168) { p.z = -168; car.setHeading(0); }
    // Ease back to cruise speed after a shove.
    if (now > car.shoveUntil && car.speed < car.cruise) car.speed = Math.min(car.cruise, car.speed + 3 * dt);
  }

  return {
    cars,
    update(dt, now, playerCar) {
      for (const car of cars) {
        step(car, dt, now);
        // Traffic shove (fix #1): a traffic car the player touches is
        // pushed clear of the player's path and its speed is capped at 6
        // for a few seconds, so it can never pin the player against a wall.
        if (playerCar) {
          const pp = playerCar.group.position;
          const cp = car.group.position;
          const dx = cp.x - pp.x, dz = cp.z - pp.z;
          const d = Math.hypot(dx, dz);
          if (d < 4.6 && d > 0.01) {
            const push = 3.2;
            cp.x += (dx / d) * push;
            cp.z += (dz / d) * push;
            car.speed = Math.min(car.speed, 6);
            car.shoveUntil = now + 3;
          }
        }
        // Wheels spin with speed.
        const spin = car.speed * dt * 1.4;
        for (const w of car.wheels) w.rotation.z += spin;
      }
    },
  };
}

// --- parked cars --------------------------------------------------------
export function createParkedCars(scene) {
  const spots = [
    { x: 18, z: -90, c: 0xc0392b },
    { x: -90, z: 54, c: 0x2471a3 },
    { x: 90, z: -18, c: 0xf1c40f },
    { x: -18, z: 126, c: 0x16a085 },
    { x: 54, z: 90, c: 0x7d3c98 },
  ];
  const cars = [];
  for (const s of spots) {
    const car = makeCar(s.c);
    car.place(s.x, s.z, Math.PI / 2);
    scene.add(car.group);
    cars.push(car);
  }
  return cars;
}
