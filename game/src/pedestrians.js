// Pedestrians for Solmar Heat: 24 walkers strolling the sidewalks, who flee
// when the player gets violent or bears down on them in a car.

import { BLOCKS, clamp, pick } from './config.js';

function walkerMesh(THREE, color) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const shirt = new THREE.MeshLambertMaterial({ color });
  const legs = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.85, 8),
    new THREE.MeshLambertMaterial({ color: 0x2c3242 }),
  );
  legs.position.y = 0.43;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.75, 8), shirt);
  torso.position.y = 1.2;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.82;
  g.add(head);
  return g;
}

export class PedestrianSystem {
  constructor(THREE, scene, rng) {
    this.THREE = THREE;
    this.scene = scene;
    this.rng = rng;
    this.walkers = [];
    const shirts = [0xd84a4a, 0x4a7dd8, 0x4ad87a, 0xd8c84a, 0xd84ac9, 0x7a4fd0, 0xe8e8e8, 0x3a3a3a];
    for (let i = 0; i < 24; i++) {
      const bx = pick(rng, BLOCKS);
      const bz = pick(rng, BLOCKS);
      const group = walkerMesh(THREE, pick(rng, shirts));
      scene.add(group);
      // Walkers patrol the sidewalk ring of one block: a 26u square, 13u
      // from the block centre, so they never step onto a road.
      const w = {
        group,
        blockX: bx,
        blockZ: bz,
        s: rng() * 104,
        dir: rng() < 0.5 ? 1 : -1,
        speed: 1.1 + rng() * 0.9,
        state: 'walk',
        fleeT: 0,
        heading: 0,
        taxi: false,
      };
      this._placeOnRing(w);
      this.walkers.push(w);
    }
  }

  // Position (and heading) of a walker from its ring parameter s in [0,104).
  _placeOnRing(w) {
    const R = 13;
    const s = ((w.s % 104) + 104) % 104;
    const { blockX: bx, blockZ: bz } = w;
    let x = bx;
    let z = bz;
    if (s < 26) { x = bx - R + s; z = bz - R; w.heading = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else if (s < 52) { x = bx + R; z = bz - R + (s - 26); w.heading = w.dir > 0 ? Math.PI : 0; }
    else if (s < 78) { x = bx + R - (s - 52); z = bz + R; w.heading = w.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    else { x = bx - R; z = bz + R - (s - 78); w.heading = w.dir > 0 ? 0 : Math.PI; }
    w.group.position.set(x, 0, z);
    w.group.rotation.y = w.heading;
  }

  // Snap a fled walker back onto its block's ring, nearest edge.
  _snapToRing(w) {
    const R = 13;
    const dx = clamp(w.group.position.x - w.blockX, -R, R);
    const dz = clamp(w.group.position.z - w.blockZ, -R, R);
    const opts = [
      { s: dx + R, edge: 0 },
      { s: 26 + (dz + R), edge: 1 },
      { s: 52 + (R - dx), edge: 2 },
      { s: 78 + (R - dz), edge: 3 },
    ];
    let best = opts[0];
    let bestD = Infinity;
    for (const o of opts) {
      const p = { x: 0, z: 0 };
      if (o.edge === 0) { p.x = w.blockX - R + o.s; p.z = w.blockZ - R; }
      if (o.edge === 1) { p.x = w.blockX + R; p.z = w.blockZ - R + (o.s - 26); }
      if (o.edge === 2) { p.x = w.blockX + R - (o.s - 52); p.z = w.blockZ + R; }
      if (o.edge === 3) { p.x = w.blockX - R; p.z = w.blockZ + R - (o.s - 78); }
      const d = (p.x - w.group.position.x) ** 2 + (p.z - w.group.position.z) ** 2;
      if (d < bestD) { bestD = d; best = o; }
    }
    w.s = best.s;
    this._placeOnRing(w);
  }

  // Mark a walker as a taxi-rank waiter (stands still, takes fares).
  makeTaxi(index, x, z) {
    const w = this.walkers[index % this.walkers.length];
    w.group.position.set(x, 0, z);
    w.state = 'taxi';
    w.speed = 0;
    w.taxi = true;
    const sign = new this.THREE.Mesh(
      new this.THREE.BoxGeometry(0.7, 0.7, 0.1),
      new this.THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    sign.position.set(0, 2.4, 0);
    w.group.add(sign);
    return w;
  }

  fleeFrom(x, z, radius = 8) {
    for (const w of this.walkers) {
      if (w.taxi) continue;
      const dx = w.group.position.x - x;
      const dz = w.group.position.z - z;
      if (dx * dx + dz * dz < radius * radius) {
        w.state = 'flee';
        w.fleeT = 3;
        w.heading = Math.atan2(dx, dz);
        w.speed = 5.5;
      }
    }
  }

  update(dt, playerX, playerZ, playerInCar, playerSpeed) {
    for (const w of this.walkers) {
      if (w.state === 'taxi') continue;
      if (w.state === 'flee') {
        w.fleeT -= dt;
        const step = w.speed * dt;
        w.group.position.x = clamp(w.group.position.x + Math.sin(w.heading) * step, -176, 176);
        w.group.position.z = clamp(w.group.position.z + Math.cos(w.heading) * step, -176, 176);
        w.group.rotation.y = w.heading;
        if (w.fleeT <= 0) {
          w.state = 'walk';
          w.speed = 1.1 + this.rng() * 0.9;
          this._snapToRing(w);
        }
        continue;
      }
      if (playerInCar && playerSpeed > 8) {
        const dx = w.group.position.x - playerX;
        const dz = w.group.position.z - playerZ;
        if (dx * dx + dz * dz < 100) {
          w.state = 'flee';
          w.fleeT = 2;
          w.heading = Math.atan2(dx, dz);
          w.speed = 5.5;
          continue;
        }
      }
      w.s += w.dir * w.speed * dt;
      this._placeOnRing(w);
      const t = performance.now() / 240 + w.group.position.x;
      w.group.position.y = Math.abs(Math.sin(t)) * 0.05;
    }
  }

  nearest(x, z, maxD, includeTaxi = false) {
    let best = null;
    let bestD = maxD;
    for (const w of this.walkers) {
      if (w.taxi && !includeTaxi) continue;
      const d = Math.hypot(w.group.position.x - x, w.group.position.z - z);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    return best;
  }
}
