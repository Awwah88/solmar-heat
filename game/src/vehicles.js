// Solmar Heat — cars: the mesh builder, arcade driving physics, traffic that
// follows the road grid, tire smoke and headlights.
// FIX (learned the hard way): when the player touches a traffic car, shove the
// traffic car clear to the side and cap its speed at 6 — otherwise traffic
// becomes a rolling roadblock that grinds the player to a halt.

import * as THREE from 'three';
import { CONFIG, clamp, wrapAngle, dist2d } from './config.js';

/** Build a low-poly car mesh: body, cabin, wheels, lights. */
export function buildCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const trim = new THREE.MeshLambertMaterial({ color: 0x181c22 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glass);
  cabin.position.set(0, 1.2, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.3, 0.3), trim);
  bumperF.position.set(0, 0.35, 2.2);
  group.add(bumperF);
  const bumperR = bumperF.clone();
  bumperR.position.z = -2.2;
  group.add(bumperR);

  // Headlights (warm glow) and taillights (red).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), headMat);
    head.position.set(sx, 0.62, 2.22);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), tailMat);
    tail.position.set(sx, 0.62, -2.22);
    group.add(tail);
  }

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }

  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xf2c200 }));
    sign.position.set(0, 1.65, -0.25);
    group.add(sign);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.62, -0.25);
    group.add(bar);
  }
  return { group, wheels };
}

/** A drivable car: mesh plus arcade state. */
export function makeCar(scene, color, x, z, heading, opts = {}) {
  const { group, wheels } = buildCarMesh(color, opts);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    group, wheels,
    heading,
    speed: 0,
    steer: 0,
    color,
    isPlayer: !!opts.player,
    isPolice: !!opts.police,
    isTaxi: !!opts.taxi,
    isGold: !!opts.gold,
    wallCutAt: 0,
    backoffUntil: 0,
    smokeAt: 0,
  };
}

/** Arcade driving step. `drive` is { throttle, steer, brake, handbrake }. */
export function driveCar(car, drive, dt, colliders, palmColliders, time) {
  const cfg = CONFIG.car;
  if (drive.throttle > 0) car.speed += cfg.accel * drive.throttle * dt;
  else if (drive.throttle < 0) car.speed += cfg.reverseAccel * drive.throttle * dt;
  if (drive.brake) car.speed -= Math.sign(car.speed) * cfg.brake * dt;
  car.speed -= car.speed * cfg.drag * dt;
  if (drive.handbrake) car.speed *= Math.max(0, 1 - 4 * dt);
  car.speed = clamp(car.speed, -cfg.maxReverse, cfg.maxSpeed);

  const steerAmount = drive.steer * cfg.turn * clamp(Math.abs(car.speed) / 12, 0, 1);
  // A (steer -1) turns left: heading increases, same as on foot.
  car.heading -= steerAmount * Math.sign(car.speed) * dt;
  car.group.rotation.y = car.heading;

  const nx = car.group.position.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.group.position.z + Math.cos(car.heading) * car.speed * dt;
  car.group.position.x = nx;
  car.group.position.z = nz;

  // Walls: slide along them, and cut speed with a cooldown-gated factor —
  // NEVER a per-frame *= 0.45, or a car scraping a wall stops dead.
  let hit = false;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(car.group.position.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(car.group.position.z, c.maxZ));
    const dx = car.group.position.x - cx;
    const dz = car.group.position.z - cz;
    const d2 = dx * dx + dz * dz;
    const r = 1.6;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        car.group.position.x = cx + (dx / d) * r;
        car.group.position.z = cz + (dz / d) * r;
      } else {
        car.group.position.x = c.maxX + r;
      }
    }
  }
  for (const p of palmColliders) {
    const dx = car.group.position.x - p.x;
    const dz = car.group.position.z - p.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < p.r + 1.4 && d > 0.001) {
      hit = true;
      car.group.position.x = p.x + (dx / d) * (p.r + 1.4);
      car.group.position.z = p.z + (dz / d) * (p.r + 1.4);
    }
  }
  if (hit && time - car.wallCutAt > 0.5) {
    car.wallCutAt = time;
    car.speed *= 0.6;
  }

  // Spin the wheels with the speed.
  const spin = (car.speed * dt) / 0.36;
  for (const w of car.wheels) w.rotation.x += spin;

  // World bounds: soft bounce back.
  const b = CONFIG.world.bounds;
  car.group.position.x = clamp(car.group.position.x, -b, b);
  car.group.position.z = clamp(car.group.position.z, -b, b);
  return hit;
}

/** Tire smoke puffs: a tiny pool of fading sprites. */
export function createSmoke(scene) {
  const puffs = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0xbbbbbb, transparent: true, opacity: 0.5 });
  const geo = new THREE.PlaneGeometry(1.6, 1.6);
  for (let i = 0; i < 24; i++) {
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.visible = false;
    scene.add(mesh);
    puffs.push({ mesh, life: 0 });
  }
  let next = 0;
  return {
    spawn(x, z) {
      const p = puffs[next];
      next = (next + 1) % puffs.length;
      p.mesh.position.set(x, 0.4, z);
      p.mesh.visible = true;
      p.life = 0.9;
    },
    update(dt, camera) {
      for (const p of puffs) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.mesh.material.opacity = Math.max(0, p.life * 0.55);
        p.mesh.scale.setScalar(1 + (0.9 - p.life) * 1.6);
        p.mesh.lookAt(camera.position);
        if (p.life <= 0) p.mesh.visible = false;
      }
    },
  };
}

/** Traffic: cars that cruise the road grid and get shoved aside, not stuck. */
export function createTraffic(scene, count) {
  const cars = [];
  const roads = CONFIG.world.roads;
  for (let i = 0; i < count; i++) {
    const along = roads[Math.floor(Math.random() * roads.length)];
    const cross = roads[Math.floor(Math.random() * roads.length)];
    const vertical = Math.random() < 0.5;
    const color = CONFIG.colors.car[Math.floor(Math.random() * CONFIG.colors.car.length)];
    const heading = vertical ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(scene, color, vertical ? along : cross, vertical ? cross : along, heading);
    car.cruiseSpeed = CONFIG.traffic.speed + Math.random() * 3;
    car.route = { vertical, road: along, dir: Math.sin(heading) >= 0 ? 1 : -1, nextTurn: 30 + Math.random() * 60 };
    cars.push(car);
  }

  return {
    cars,
    update(dt, playerCar, time) {
      for (const car of cars) {
        // Follow the road grid: drive along the current road, turn at random.
        car.route.nextTurn -= dt;
        const pos = car.group.position;
        if (car.route.nextTurn <= 0) {
          const roads = CONFIG.world.roads;
          const cross = roads[Math.floor(Math.random() * roads.length)];
          car.route.vertical = !car.route.vertical;
          car.route.road = cross;
          car.route.nextTurn = 30 + Math.random() * 60;
          car.route.dir = Math.random() < 0.5 ? 1 : -1;
        }
        const targetHeading = car.route.vertical
          ? (car.route.dir > 0 ? 0 : Math.PI)
          : (car.route.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        let dh = wrapAngle(targetHeading - car.heading);
        car.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
        car.group.rotation.y = car.heading;
        car.speed = Math.min(car.cruiseSpeed, CONFIG.traffic.maxSpeed);
        pos.x += Math.sin(car.heading) * car.speed * dt;
        pos.z += Math.cos(car.heading) * car.speed * dt;
        // Snap back onto the road centreline so cars never drift into blocks.
        if (car.route.vertical) pos.x += (car.route.road - pos.x) * Math.min(1, 2 * dt);
        else pos.z += (car.route.road - pos.z) * Math.min(1, 2 * dt);
        const b = CONFIG.world.bounds;
        pos.x = clamp(pos.x, -b, b);
        pos.z = clamp(pos.z, -b, b);

        // FIX: shove the traffic car clear to the side on player contact and
        // cap its speed at 6, so it never becomes a rolling roadblock.
        if (playerCar) {
          const pp = playerCar.group.position;
          const d = dist2d(pos.x, pos.z, pp.x, pp.z);
          if (d < 3.4 && d > 0.001) {
            const push = 3.4 - d;
            const nx = (pos.x - pp.x) / d;
            const nz = (pos.z - pp.z) / d;
            pos.x += nx * push;
            pos.z += nz * push;
            car.cruiseSpeed = Math.min(car.cruiseSpeed, 6);
            setTimeout(() => { car.cruiseSpeed = CONFIG.traffic.speed + 4; }, 2500);
          }
        }
      }
      // Gentle separation so traffic cars do not pile onto each other.
      for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) {
          const a = cars[i].group.position;
          const b = cars[j].group.position;
          const d = dist2d(a.x, a.z, b.x, b.z);
          if (d < 3 && d > 0.001) {
            const push = (3 - d) / 2;
            const nx = (a.x - b.x) / d;
            const nz = (a.z - b.z) / d;
            a.x += nx * push;
            a.z += nz * push;
            b.x -= nx * push;
            b.z -= nz * push;
          }
        }
      }
      void time;
    },
  };
}
