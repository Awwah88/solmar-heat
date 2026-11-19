// Pedestrians: 24 walkers who stroll the sidewalks and run away when the
// player bears down on them in a car or the heat is on. They never enter
// building footprints and stay inside the city.
import * as THREE from "three";
import { ROAD_CENTRES, WORLD_HALF, clamp, dist2d, forwardOf, makeRng, pick } from "./config.js";

const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad88a, 0xd8c94a, 0x9a4ad8, 0xd88a2a, 0x4ad8d8, 0x8a8a8a];

export class Pedestrians {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.rng = makeRng(seed + 131);
    this.walkers = [];
    for (let i = 0; i < 24; i++) {
      const road = pick(this.rng, ROAD_CENTRES);
      const along = -165 + this.rng() * 330;
      const side = this.rng() < 0.5 ? -1 : 1;
      const onXRoad = this.rng() < 0.5;
      const x = onXRoad ? road + side * 9.5 : along;
      const z = onXRoad ? along : road + side * 9.5;
      const group = new THREE.Group();
      const shirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.5, 1.1, 8),
        new THREE.MeshStandardMaterial({ color: pick(this.rng, SHIRTS), roughness: 0.85 }),
      );
      shirt.position.y = 0.95;
      shirt.castShadow = true;
      group.add(shirt);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 }),
      );
      head.position.y = 1.75;
      head.castShadow = true;
      group.add(head);
      const legs = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.34, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a2e44, roughness: 0.9 }),
      );
      legs.position.y = 0.4;
      group.add(legs);
      group.position.set(x, 0, z);
      scene.add(group);
      this.walkers.push({
        group,
        x,
        z,
        heading: this.rng() * Math.PI * 2,
        speed: 1.1 + this.rng() * 0.9,
        flee: 0,
        target: null,
      });
    }
  }

  _pickTarget(w) {
    const road = pick(this.rng, ROAD_CENTRES);
    const along = -165 + this.rng() * 330;
    const side = this.rng() < 0.5 ? -1 : 1;
    if (this.rng() < 0.5) w.target = { x: road + side * 9.5, z: along };
    else w.target = { x: along, z: road + side * 9.5 };
  }

  update(dt, playerPos, playerSpeed, wanted) {
    for (const w of this.walkers) {
      const dp = dist2d(w.x, w.z, playerPos.x, playerPos.z);
      if (dp < 11 && (wanted >= 2 || playerSpeed > 6)) w.flee = 2.2;
      if (w.flee > 0) {
        w.flee -= dt;
        const away = Math.atan2(w.x - playerPos.x, w.z - playerPos.z);
        w.heading = away;
        const f = forwardOf(w.heading);
        w.x = clamp(w.x + f.x * 5.2 * dt, -WORLD_HALF, WORLD_HALF);
        w.z = clamp(w.z + f.z * 5.2 * dt, -WORLD_HALF, WORLD_HALF);
      } else {
        if (!w.target || dist2d(w.x, w.z, w.target.x, w.target.z) < 3) this._pickTarget(w);
        const desired = Math.atan2(w.target.x - w.x, w.target.z - w.z);
        let err = desired - w.heading;
        while (err > Math.PI) err -= Math.PI * 2;
        while (err < -Math.PI) err += Math.PI * 2;
        w.heading += clamp(err, -2.4 * dt, 2.4 * dt);
        const f = forwardOf(w.heading);
        w.x = clamp(w.x + f.x * w.speed * dt, -WORLD_HALF, WORLD_HALF);
        w.z = clamp(w.z + f.z * w.speed * dt, -WORLD_HALF, WORLD_HALF);
      }
      w.group.position.set(w.x, 0, w.z);
      w.group.rotation.y = w.heading;
      w.group.position.y = Math.abs(Math.sin(performance.now() * 0.006 + w.x)) * 0.05;
    }
  }

  nearest(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const w of this.walkers) {
      const d = dist2d(x, z, w.x, w.z);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    return { walker: best, dist: bestD };
  }

  knockback(w, fromX, fromZ, force = 6) {
    const a = Math.atan2(w.x - fromX, w.z - fromZ);
    const f = forwardOf(a);
    w.x = clamp(w.x + f.x * force, -WORLD_HALF, WORLD_HALF);
    w.z = clamp(w.z + f.z * force, -WORLD_HALF, WORLD_HALF);
    w.flee = 3;
    w.group.position.set(w.x, 0, w.z);
  }
}
