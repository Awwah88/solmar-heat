// Solmar Heat — pedestrians (Round 17). 24 walkers stroll the sidewalks and
// flee when a car bears down on them or a shot is fired. Bank, casino and
// airport crowds use brighter clothes so those districts read at a glance.
import * as THREE from 'three';
import { ROADS, BLOCKS, mulberry32, dist2d } from './config.js';

const SHIRT_COLORS = [0xd84a4a, 0x4a7dd8, 0x4ad87a, 0xe0c23a, 0x9a4ad8, 0xd87a2a, 0x3ec8c8, 0xe8e8e8];

export class Pedestrians {
  constructor(scene, city) {
    this.scene = scene;
    this.walkers = [];
    const rng = mulberry32(4242);
    const districts = [
      { cx: 36, cz: 144, color: 0x2a2a3a }, // bank crowd: dark suits
      { cx: 108, cz: -72, color: 0xd84a9a }, // casino crowd: bright
      { cx: 144, cz: -144, color: 0x3a6a9a }, // airport crowd: blue
    ];
    for (let i = 0; i < 24; i++) {
      const bx = BLOCKS[Math.floor(rng() * BLOCKS.length)];
      const bz = BLOCKS[Math.floor(rng() * BLOCKS.length)];
      const district = districts.find((d) => Math.abs(d.cx - bx) < 40 && Math.abs(d.cz - bz) < 40);
      const shirt = district ? district.color : SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)];
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 1.3, 0.45),
        new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }),
      );
      body.position.y = 1.05;
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.8 }),
      );
      head.position.y = 1.95;
      g.add(head);
      const legs = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.8, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 1 }),
      );
      legs.position.y = 0.4;
      g.add(legs);
      const x = bx + (rng() - 0.5) * 20;
      const z = bz + (rng() - 0.5) * 20;
      g.position.set(x, 0, z);
      scene.add(g);
      this.walkers.push({
        group: g,
        x,
        z,
        heading: rng() * Math.PI * 2,
        speed: 1 + rng() * 0.8,
        target: null,
        fleeing: 0,
        panic: 0,
      });
    }
  }

  _pickTarget(w) {
    // A nearby sidewalk point: walk along the block edge, never through roads.
    const bx = Math.round(w.x / 36) * 36;
    const bz = Math.round(w.z / 36) * 36;
    const side = Math.random() < 0.5;
    return {
      x: side ? bx + (Math.random() < 0.5 ? -13 : 13) : bx + (Math.random() - 0.5) * 22,
      z: side ? bz + (Math.random() - 0.5) * 22 : bz + (Math.random() < 0.5 ? -13 : 13),
    };
  }

  scare(x, z, radius) {
    for (const w of this.walkers) {
      if (dist2d(w.x, w.z, x, z) < radius) {
        w.fleeing = 2.5;
        w.panic = 1;
      }
    }
  }

  update(dt, playerPos, playerSpeed, inCar) {
    for (const w of this.walkers) {
      // Flee from a fast car or the player on foot at close range.
      const dPlayer = dist2d(w.x, w.z, playerPos.x, playerPos.z);
      if ((inCar && dPlayer < 9 && playerSpeed > 6) || dPlayer < 2.2) {
        w.fleeing = 2.0;
      }
      let tx;
      let tz;
      let speed = w.speed;
      if (w.fleeing > 0) {
        w.fleeing -= dt;
        const away = Math.atan2(w.x - playerPos.x, w.z - playerPos.z);
        tx = w.x + Math.sin(away) * 10;
        tz = w.z + Math.cos(away) * 10;
        speed = 3.4;
      } else {
        if (!w.target || dist2d(w.x, w.z, w.target.x, w.target.z) < 1.5) {
          w.target = this._pickTarget(w);
        }
        tx = w.target.x;
        tz = w.target.z;
      }
      const desired = Math.atan2(tx - w.x, tz - w.z);
      let err = desired - w.heading;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      w.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, err));
      w.x += Math.sin(w.heading) * speed * dt;
      w.z += Math.cos(w.heading) * speed * dt;
      w.x = Math.max(-176, Math.min(176, w.x));
      w.z = Math.max(-176, Math.min(176, w.z));
      w.group.position.set(w.x, 0, w.z);
      w.group.rotation.y = -w.heading + Math.PI / 2;
      // Simple walk bob.
      w.group.position.y = Math.abs(Math.sin(Date.now() * 0.006 + w.x)) * 0.06;
    }
  }
}
