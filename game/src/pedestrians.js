// Solmar Heat — pedestrians.
// Twenty-four walkers stroll the sidewalks; when the player barrels
// past in a car (or starts swinging) they run away. Punching one
// down is a crime the police notice.

import * as THREE from 'three';
import { ROADS, PED_COUNT, mulberry32, dist2 } from './config.js';

const SHIRTS = [0xe86a6a, 0x6a9fe8, 0x7bc47f, 0xe8c86a, 0x9a6ae8, 0xe8e8e8, 0xef8354, 0x5fa8a0];
const PANTS = [0x2c3e50, 0x5d6b7a, 0x7a4a3a, 0x3a3f46];

export class Pedestrians {
  constructor(scene) {
    this.scene = scene;
    this.walkers = [];
    const rng = mulberry32(777);
    const bodyGeo = new THREE.BoxGeometry(0.7, 1.1, 0.4);
    const headGeo = new THREE.SphereGeometry(0.26, 8, 6);
    const legGeo = new THREE.BoxGeometry(0.6, 0.8, 0.35);
    for (let i = 0; i < PED_COUNT; i++) {
      const alongRoad = rng() < 0.5;
      const line = ROADS[Math.floor(rng() * ROADS.length)];
      const along = -170 + rng() * 340;
      const x = alongRoad ? along : line + (rng() < 0.5 ? 7 : -7);
      const z = alongRoad ? line + (rng() < 0.5 ? 7 : -7) : along;
      const group = new THREE.Group();
      const shirt = new THREE.MeshLambertMaterial({
        color: SHIRTS[Math.floor(rng() * SHIRTS.length)],
      });
      const pants = new THREE.MeshLambertMaterial({
        color: PANTS[Math.floor(rng() * PANTS.length)],
      });
      const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
      const body = new THREE.Mesh(bodyGeo, shirt);
      body.position.y = 1.25;
      body.castShadow = true;
      const head = new THREE.Mesh(headGeo, skin);
      head.position.y = 2.0;
      head.castShadow = true;
      const legs = new THREE.Mesh(legGeo, pants);
      legs.position.y = 0.4;
      group.add(body, head, legs);
      group.position.set(x, 0, z);
      scene.add(group);
      this.walkers.push({
        group,
        heading: rng() * Math.PI * 2,
        speed: 1.1 + rng() * 0.7,
        walkPhase: rng() * 10,
        fleeing: 0,
        down: false,
        downTimer: 0,
      });
    }
  }

  update(dt, playerPos, playerSpeed, playerInCar) {
    for (const w of this.walkers) {
      if (w.down) {
        w.downTimer -= dt;
        w.group.position.y = -0.9;
        if (w.downTimer <= 0) {
          w.down = false;
          w.group.position.y = 0;
          // Get up and run off.
          w.fleeing = 3;
        }
        continue;
      }
      const d = dist2(w.group.position.x, w.group.position.z, playerPos.x, playerPos.z);
      if (d < 9 && (playerInCar || playerSpeed > 3)) {
        // Flee: run directly away from the player.
        w.fleeing = 1.2;
        w.heading = Math.atan2(
          w.group.position.x - playerPos.x,
          w.group.position.z - playerPos.z,
        );
      }
      if (w.fleeing > 0) {
        w.fleeing -= dt;
        w.group.position.x += Math.sin(w.heading) * 4.2 * dt;
        w.group.position.z += Math.cos(w.heading) * 4.2 * dt;
      } else {
        // Stroll along the sidewalk; drift the heading slowly.
        w.heading += (Math.random() - 0.5) * 0.4 * dt;
        w.group.position.x += Math.sin(w.heading) * w.speed * dt;
        w.group.position.z += Math.cos(w.heading) * w.speed * dt;
        // Stay inside the city; turn around at the edges.
        if (Math.abs(w.group.position.x) > 172 || Math.abs(w.group.position.z) > 172) {
          w.heading += Math.PI;
        }
      }
      w.group.position.x = Math.max(-176, Math.min(200, w.group.position.x));
      w.group.position.z = Math.max(-176, Math.min(205, w.group.position.z));
      w.group.rotation.y = w.heading;
      w.walkPhase += dt * (w.fleeing > 0 ? 9 : 5);
      w.group.position.y = Math.abs(Math.sin(w.walkPhase)) * 0.06;
    }
  }

  // Nearest walker within r of (x, z), or null.
  nearest(x, z, r) {
    let best = null;
    let bestD = r;
    for (const w of this.walkers) {
      if (w.down) continue;
      const d = dist2(w.group.position.x, w.group.position.z, x, z);
      if (d < bestD) { bestD = d; best = w; }
    }
    return best;
  }

  knockDown(w) {
    w.down = true;
    w.downTimer = 6;
  }
}
