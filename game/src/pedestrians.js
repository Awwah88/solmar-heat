// Solmar Heat — pedestrians: city folk strolling the sidewalks, fleeing from
// speeding cars, and getting knocked down (and back up) when hit.

import * as THREE from 'three';
import { CONFIG, dist2d, clamp } from './config.js';

const SHIRTS = [0xe85a4a, 0x4a90e8, 0x50c878, 0xf2c200, 0x9b59b6, 0xecf0f1, 0x2c3e50, 0xff8c42];
const PANTS = [0x2c3e50, 0x5d6d7e, 0x7b241c, 0x1a5276, 0x4a235a];

/** Build one pedestrian: capsule body, head, simple limbs. */
function buildPedestrian() {
  const group = new THREE.Group();
  const shirt = SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
  const pants = PANTS[Math.floor(Math.random() * PANTS.length)];
  const skin = [0xe8b88a, 0xc98d64, 0x8a5a3a, 0xf0c8a0][Math.floor(Math.random() * 4)];

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.38, 0.9, 8),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = 0.95;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.55, 0.3),
    new THREE.MeshLambertMaterial({ color: pants }),
  );
  legs.position.y = 0.28;
  group.add(legs);
  return { group, body, head };
}

/** Create the crowd. `game` gives access to the player for fleeing. */
export function createPedestrians(scene, count) {
  const peds = [];
  const roads = CONFIG.world.roads;
  for (let i = 0; i < count; i++) {
    const { group } = buildPedestrian();
    // Start on a sidewalk: beside a road, inside a block edge.
    const road = roads[Math.floor(Math.random() * roads.length)];
    const along = (Math.random() * 2 - 1) * 160;
    const side = Math.random() < 0.5 ? -1 : 1;
    const vertical = Math.random() < 0.5;
    const x = vertical ? road + side * 8 : along;
    const z = vertical ? along : road + side * 8;
    group.position.set(x, 0, z);
    scene.add(group);
    peds.push({
      group,
      heading: Math.random() * Math.PI * 2,
      speed: CONFIG.pedestrians.speed * (0.7 + Math.random() * 0.6),
      downUntil: 0,
      fleeUntil: 0,
      wanderAt: 0,
    });
  }

  return {
    peds,
    update(dt, playerPos, playerSpeed, time) {
      for (const p of peds) {
        const pos = p.group.position;
        if (time < p.downUntil) {
          // Knocked down: lying flat, then gets back up.
          p.group.rotation.x = -Math.PI / 2;
          continue;
        }
        p.group.rotation.x = 0;
        const dPlayer = playerPos ? dist2d(pos.x, pos.z, playerPos.x, playerPos.z) : 999;
        if (playerPos && dPlayer < 9 && playerSpeed > 8) {
          // Flee away from a speeding car or player.
          p.fleeUntil = time + 1.2;
        }
        let heading = p.heading;
        if (time < p.fleeUntil && playerPos) {
          heading = Math.atan2(pos.x - playerPos.x, pos.z - playerPos.z);
          p.heading = heading;
        } else if (time > p.wanderAt) {
          p.wanderAt = time + 3 + Math.random() * 5;
          p.heading += (Math.random() - 0.5) * 1.8;
          heading = p.heading;
        }
        const speed = time < p.fleeUntil ? p.speed * 2.4 : p.speed;
        pos.x += Math.sin(heading) * speed * dt;
        pos.z += Math.cos(heading) * speed * dt;
        // Keep pedestrians inside the city and off the beach road.
        pos.x = clamp(pos.x, -168, 168);
        pos.z = clamp(pos.z, -168, 168);
        p.group.rotation.y = heading;
        // Little walking bob.
        p.group.position.y = Math.abs(Math.sin(time * 6 + pos.x)) * 0.06;
      }
    },
    /** Knock a pedestrian down for a moment. Returns true if one was hit. */
    knockDown(x, z, radius, time) {
      for (const p of peds) {
        const pos = p.group.position;
        if (time < p.downUntil) continue;
        if (dist2d(pos.x, pos.z, x, z) < radius) {
          p.downUntil = time + 2.5;
          return true;
        }
      }
      return false;
    },
    /** Nearest standing pedestrian to a point, within range. */
    nearest(x, z, range, time) {
      let best = null;
      let bestD = range;
      for (const p of peds) {
        if (time < p.downUntil) continue;
        const pos = p.group.position;
        const d = dist2d(pos.x, pos.z, x, z);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      return best;
    },
  };
}
