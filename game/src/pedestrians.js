// Pedestrians: sidewalk walkers who flee from danger, plus the taxi
// fare waiting at the beach stand.
import * as THREE from 'three';
import { CFG, makeRng, clamp } from './config.js';

function makeWalker(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.4, 1.5, 8),
    new THREE.MeshLambertMaterial({ color })
  );
  body.position.y = 0.95;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xd9a066 })
  );
  head.position.y = 1.95;
  g.add(head);
  return g;
}

export function createPedestrians(scene) {
  const rng = makeRng(4242);
  const walkers = [];
  const palette = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0x34495e];
  for (let i = 0; i < 24; i++) {
    const bx = CFG.blockCentres[Math.floor(rng() * CFG.blockCentres.length)];
    const bz = CFG.blockCentres[Math.floor(rng() * CFG.blockCentres.length)];
    // Walk the sidewalk ring of the block: just inside the block edge.
    const side = Math.floor(rng() * 4);
    const off = 15.5;
    let x = bx, z = bz;
    if (side === 0) { z = bz - off; x = bx + (rng() * 2 - 1) * off; }
    if (side === 1) { z = bz + off; x = bx + (rng() * 2 - 1) * off; }
    if (side === 2) { x = bx - off; z = bz + (rng() * 2 - 1) * off; }
    if (side === 3) { x = bx + off; z = bz + (rng() * 2 - 1) * off; }
    const mesh = makeWalker(palette[i % palette.length]);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    walkers.push({
      mesh, x, z,
      heading: rng() * Math.PI * 2,
      speed: 1.1 + rng() * 0.7,
      fleeUntil: 0,
      down: false,
      wanderT: 2 + rng() * 4,
    });
  }

  // Taxi fare: one pedestrian waiting at the beach stand.
  const fareMesh = makeWalker(0xf1c40f);
  fareMesh.position.set(CFG.taxiStand.x, 0, CFG.taxiStand.z);
  scene.add(fareMesh);
  const fare = { mesh: fareMesh, x: CFG.taxiStand.x, z: CFG.taxiStand.z, waiting: true, inCar: false, dest: null };

  return {
    walkers, fare,
    update(dt, now, playerPos, playerCar, gunshotAt) {
      for (const w of walkers) {
        if (w.down) continue;
        // Flee: a car nearby or a recent gunshot sends them running.
        const dCar = playerCar
          ? Math.hypot(w.x - playerCar.group.position.x, w.z - playerCar.group.position.z)
          : 999;
        const dFoot = Math.hypot(w.x - playerPos.x, w.z - playerPos.z);
        const dShot = gunshotAt ? Math.hypot(w.x - gunshotAt.x, w.z - gunshotAt.z) : 999;
        if (dCar < 9 || dFoot < 3 || dShot < 18) w.fleeUntil = now + 2.5;
        const fleeing = now < w.fleeUntil;
        const speed = fleeing ? 3.4 : w.speed;
        if (fleeing) {
          const ax = w.x - playerPos.x, az = w.z - playerPos.z;
          const d = Math.hypot(ax, az) || 1;
          w.heading = Math.atan2(ax / d, az / d);
        } else {
          w.wanderT -= dt;
          if (w.wanderT <= 0) {
            w.wanderT = 3 + rng() * 5;
            w.heading += (rng() - 0.5) * 1.6;
          }
        }
        w.x = clamp(w.x + Math.sin(w.heading) * speed * dt, -170, 170);
        w.z = clamp(w.z + Math.cos(w.heading) * speed * dt, -170, 170);
        w.mesh.position.set(w.x, 0, w.z);
        w.mesh.rotation.y = w.heading;
        // Simple walk bob.
        w.mesh.position.y = Math.abs(Math.sin(now * 6 + w.x)) * 0.06;
      }
    },
  };
}
