// Solmar Heat — pedestrians. 24 walkers stroll the sidewalks on their own
// routes, scatter when a car barrels at them or the wanted level spikes,
// and a few linger around the new Casino Solmar and Solmar Boardwalk.
// A walker can be punched down (combat.js) and gets back up after a while.
import * as THREE from 'three';
import { ROADS } from './config.js';

const SHIRTS = [0xe86a1c, 0x2f7fd9, 0x22a06b, 0xd946ef, 0xf2c230, 0xe8e8e8, 0x14b8a6, 0x7c3aed];

export class Pedestrian {
  constructor(scene, x, z) {
    this.group = new THREE.Group();
    const shirt = SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.4), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }));
    body.position.y = 1.05; body.castShadow = true;
    this.group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 }));
    head.position.y = 1.85;
    this.group.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.35), new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.95 }));
    legs.position.y = 0.3;
    this.group.add(legs);
    this.group.position.set(x, 0, z);
    scene.add(this.group);
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 1.1 + Math.random() * 0.9;
    this.down = 0;
    this.fleeing = 0;
    this.scene = scene;
  }
  update(dt, playerPos, playerSpeed, wanted) {
    if (this.down > 0) {
      this.down -= dt;
      this.group.rotation.x = this.down > 0 ? Math.PI / 2 : 0;
      this.group.position.y = this.down > 0 ? 0.4 : 0;
      return;
    }
    const dx = this.group.position.x - playerPos.x;
    const dz = this.group.position.z - playerPos.z;
    const d = Math.hypot(dx, dz);
    if ((d < 7 && playerSpeed > 8) || (wanted >= 3 && d < 12)) {
      this.fleeing = 1.5;
    }
    if (this.fleeing > 0) {
      this.fleeing -= dt;
      this.heading = Math.atan2(dx, dz);
      const s = 3.4;
      this.group.position.x += Math.sin(this.heading) * s * dt;
      this.group.position.z += Math.cos(this.heading) * s * dt;
    } else {
      // Stroll along the sidewalk: keep to a road line, offset 7u.
      this.group.position.x += Math.sin(this.heading) * this.speed * dt;
      this.group.position.z += Math.cos(this.heading) * this.speed * dt;
      if (Math.abs(this.group.position.x) > 178 || Math.abs(this.group.position.z) > 178) this.heading += Math.PI;
      if (Math.random() < dt * 0.05) this.heading += (Math.random() - 0.5) * 1.2;
    }
    this.group.rotation.y = this.heading;
    // Gentle walk bob.
    this.group.children[0].position.y = 1.05 + Math.abs(Math.sin(Date.now() * 0.006 + this.heading)) * 0.05;
  }
  knockDown() { this.down = 4; }
}

export class Pedestrians {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    for (let i = 0; i < 24; i++) {
      const road = ROADS[i % ROADS.length];
      const along = -160 + ((i * 67) % 320);
      const vertical = i % 2 === 0;
      const x = vertical ? road + 7 : along;
      const z = vertical ? along : road + 7;
      this.list.push(new Pedestrian(scene, x, z));
    }
    // Casino crowd and boardwalk strollers (new in R16).
    this.list.push(new Pedestrian(scene, 122, -48));
    this.list.push(new Pedestrian(scene, 130, -60));
    this.list.push(new Pedestrian(scene, 166, 108));
    this.list.push(new Pedestrian(scene, 170, 140));
  }
  update(dt, playerPos, playerSpeed, wanted) {
    for (const p of this.list) p.update(dt, playerPos, playerSpeed, wanted);
  }
  nearest(x, z, maxD) {
    let best = null;
    let bd = maxD;
    for (const p of this.list) {
      if (p.down > 0) continue;
      const d = Math.hypot(p.group.position.x - x, p.group.position.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}
