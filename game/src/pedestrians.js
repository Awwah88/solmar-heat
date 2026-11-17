// Solmar Heat — pedestrians.js
// The people of Solmar Bay. They stroll between sidewalk points, they
// run away when a fast car comes at them, and getting hit by a car
// knocks them down — which counts as a crime.
//
// A pedestrian is always in one of three states: wandering (picking a
// nearby target point and strolling to it), fleeing (running away from
// a fast car for a couple of seconds), or down (lying on the ground for
// a few seconds after being hit, then getting up).

import * as THREE from 'three';
import { distance2D, mulberry32 } from './config.js';

const SHIRT_COLORS = [0xe8e8e8, 0x2a6fd6, 0xf2c230, 0xd23b3b, 0x37b268, 0x7a4fd0, 0xff8c42, 0xe8a2b4];

// A simple person: box torso, sphere head, box legs, coloured shirt.
function makePedMesh(shirt) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.1, 0.4),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }),
  );
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 }),
  );
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.55, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x2c3e55, roughness: 0.95 }),
  );
  legs.position.y = 0.28;
  group.add(legs);
  return group;
}

export class PedestrianSystem {
  constructor(scene) {
    this.peds = [];
    const rand = mulberry32(4242);
    for (let i = 0; i < 24; i += 1) {
      const mesh = makePedMesh(SHIRT_COLORS[Math.floor(rand() * SHIRT_COLORS.length)]);
      const x = -160 + rand() * 320;
      const z = -160 + rand() * 320;
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      this.peds.push({
        mesh,
        x,
        z,
        angle: rand() * Math.PI * 2,
        speed: 1.2 + rand() * 1.2,
        targetX: x,
        targetZ: z,
        fleeing: 0,
        down: false,
        downTimer: 0,
      });
    }
  }

  // Pick a new nearby point to stroll to, and face it.
  pickNewTarget(ped) {
    ped.targetX = Math.max(-170, Math.min(170, ped.x + (Math.random() - 0.5) * 60));
    ped.targetZ = Math.max(-170, Math.min(190, ped.z + (Math.random() - 0.5) * 60));
    ped.angle = Math.atan2(ped.targetX - ped.x, ped.targetZ - ped.z);
  }

  // Stroll toward the current target point at walking speed.
  wander(ped, dt) {
    if (distance2D(ped.x, ped.z, ped.targetX, ped.targetZ) < 2) this.pickNewTarget(ped);
    ped.x += Math.sin(ped.angle) * ped.speed * dt;
    ped.z += Math.cos(ped.angle) * ped.speed * dt;
  }

  // Run away from the player at a flat sprint speed.
  flee(ped, dt) {
    ped.fleeing -= dt;
    ped.x += Math.sin(ped.angle) * 5 * dt;
    ped.z += Math.cos(ped.angle) * 5 * dt;
  }

  // Lie on the ground for a while, then get back up.
  recover(ped, dt) {
    ped.downTimer -= dt;
    ped.mesh.rotation.z = Math.PI / 2;
    ped.mesh.position.y = 0.3;
    if (ped.downTimer <= 0) {
      ped.down = false;
      ped.mesh.rotation.z = 0;
      ped.mesh.position.y = 0;
    }
  }

  update(dt, playerPos, playerSpeed, onCrime) {
    this.peds.forEach((ped) => {
      if (ped.down) {
        this.recover(ped, dt);
        return;
      }
      const d = distance2D(ped.x, ped.z, playerPos.x, playerPos.z);
      // A fast car nearby makes the pedestrian run away from it.
      if (d < 7 && playerSpeed > 6) {
        ped.fleeing = 2.5;
        ped.angle = Math.atan2(ped.x - playerPos.x, ped.z - playerPos.z);
      }
      if (ped.fleeing > 0) this.flee(ped, dt);
      else this.wander(ped, dt);
      ped.x = Math.max(-175, Math.min(175, ped.x));
      ped.z = Math.max(-175, Math.min(195, ped.z));
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.angle;
      // Walk bob.
      ped.mesh.position.y = Math.abs(Math.sin(Date.now() * 0.006 + ped.x)) * 0.06;
      // Hit by the player's car: knocked down, and it is a crime.
      if (d < 1.8 && playerSpeed > 3) {
        ped.down = true;
        ped.downTimer = 6;
        onCrime('ped');
      }
    });
  }
}
