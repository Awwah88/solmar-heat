// Solmar Bay: 9x9 blocks, roads every 36u, beach and sea to the east.
// Building colliders are clamped so no edge sits more than 10u from its
// block centre — roads always keep a clear centre slot for cars.
import * as THREE from 'three';
import { GRID, LANDMARKS, makeRng, pick, clamp } from './config.js';

const BUILDING_COLORS = [0x9aa7b8, 0xb8a88f, 0x8fa3b8, 0xc2b49a, 0xa89bb8, 0x93b8a0];

function windowsTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8d99ab';
  g.fillRect(0, 0, 128, 256);
  for (let y = 12; y < 244; y += 24) {
    for (let x = 10; x < 118; x += 22) {
      const lit = Math.random() < 0.35;
      g.fillStyle = lit ? '#ffd97a' : '#2c3a4d';
      g.fillRect(x, y, 14, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6d7278';
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#f5d76e';
  g.fillRect(30, 8, 4, 40);
  g.fillRect(30, 136, 4, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class City {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = makeRng(seed || 7);
    this.colliders = [];
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);
    this.landmarkMeshes = {};
    this._buildGround();
    this._buildRoads();
    this._buildBlocks();
    this._buildLandmarks();
    this._buildBeach();
    this._buildGreenery();
  }

  // Every collider edge is clamped to within 10u of its block centre.
  // That leaves at least 8u between any building edge and the nearest road
  // centreline, so the 6u centre strip of every road stays fully clear.
  _addCollider(kind, cx, cz, xmin, xmax, zmin, zmax) {
    xmin = Math.max(xmin, cx - 10);
    xmax = Math.min(xmax, cx + 10);
    zmin = Math.max(zmin, cz - 10);
    zmax = Math.min(zmax, cz + 10);
    if (xmax <= xmin || zmax <= zmin) return null;
    const c = { kind, xmin, xmax, zmin, zmax };
    this.colliders.push(c);
    return c;
  }

  _buildGround() {
    const mat = new THREE.MeshLambertMaterial({ color: 0x7d8f6a });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(20, -0.1, 0);
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  _buildRoads() {
    const tex = roadTexture();
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    for (const r of GRID.roads) {
      const ns = new THREE.Mesh(new THREE.PlaneGeometry(12, 372), mat);
      ns.rotation.x = -Math.PI / 2;
      ns.position.set(r, 0.02, 0);
      this.group.add(ns);
      const ew = new THREE.Mesh(new THREE.PlaneGeometry(372, 12), mat.clone());
      ew.material.map = tex.clone();
      ew.material.map.needsUpdate = true;
      ew.rotation.x = -Math.PI / 2;
      ew.position.set(0, 0.02, r);
      this.group.add(ew);
    }
  }

  _buildBlocks() {
    const winTex = windowsTexture();
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
    const mats = BUILDING_COLORS.map((c) => new THREE.MeshLambertMaterial({ map: winTex, color: c }));
    for (const bx of GRID.blocks) {
      for (const bz of GRID.blocks) {
        if (LANDMARKS.some((l) => l.block[0] === bx && l.block[1] === bz)) continue;
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), sidewalkMat);
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(bx, 0.05, bz);
        pad.receiveShadow = true;
        this.group.add(pad);
        const n = 1 + (this.rng() < 0.45 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const w = 9 + this.rng() * 7;
          const d = 9 + this.rng() * 7;
          const h = 7 + this.rng() * 19;
          const ox = (this.rng() - 0.5) * (20 - w);
          const oz = (this.rng() - 0.5) * (20 - d);
          const cx = bx + ox;
          const cz = bz + oz;
          const mesh = new THREE.Mesh(boxGeo, pick(this.rng, mats));
          mesh.scale.set(w, h, d);
          mesh.position.set(cx, h / 2, cz);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.group.add(mesh);
          this._addCollider('building', bx, bz, cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2);
        }
      }
    }
  }

  _buildLandmarks() {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 26, 8);
    for (const lm of LANDMARKS) {
      const [bx, bz] = lm.block;
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(34, 34),
        new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }),
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(bx, 0.05, bz);
      this.group.add(pad);
      const mat = new THREE.MeshLambertMaterial({ color: lm.color });
      const main = new THREE.Mesh(boxGeo, mat);
      const w = 16;
      const d = 12;
      const h = lm.id === 'lighthouse' ? 30 : 11;
      main.scale.set(w, h, d);
      main.position.set(bx, h / 2, bz);
      main.castShadow = true;
      this.group.add(main);
      this._addCollider('landmark', bx, bz, bx - w / 2, bx + w / 2, bz - d / 2, bz + d / 2);
      const annex = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }));
      annex.scale.set(8, 5, 8);
      annex.position.set(bx + 6, 2.5, bz + 5);
      this.group.add(annex);
      this._addCollider('landmark', bx, bz, bx + 2, bx + 10, bz + 1, bz + 9);
      // Tall sign pole so the landmark reads from across the city.
      const pole = new THREE.Mesh(cylGeo, new THREE.MeshLambertMaterial({ color: 0x44484f }));
      pole.position.set(bx - 8, 13, bz - 6);
      this.group.add(pole);
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(5, 3, 0.6),
        new THREE.MeshLambertMaterial({ color: lm.color, emissive: lm.color, emissiveIntensity: 0.55 }),
      );
      sign.position.set(bx - 8, 27, bz - 6);
      this.group.add(sign);
      // Beacon ring on the road marker so missions are easy to find.
      const [mx, mz] = lm.marker;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(3, 4.2, 24),
        new THREE.MeshBasicMaterial({ color: lm.color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(mx, 0.08, mz);
      this.group.add(ring);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 42, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: lm.color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
      );
      beam.position.set(mx, 21, mz);
      this.group.add(beam);
      this.landmarkMeshes[lm.id] = { main, ring, beam };
    }
  }

  _buildBeach() {
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 372),
      new THREE.MeshLambertMaterial({ color: 0xe3cf9e }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(204, 0.0, 0);
    this.group.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 420),
      new THREE.MeshLambertMaterial({ color: 0x2a7fa8, transparent: true, opacity: 0.92 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(330, -0.4, 0);
    this.group.add(sea);
    // The Pier: wooden walkway out over the water.
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(46, 1, 10), wood);
    deck.position.set(203, 1.2, 126);
    this.group.add(deck);
    for (let x = 188; x <= 222; x += 8) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4, 6), wood);
      post.position.set(x, -0.6, 122);
      this.group.add(post);
      const post2 = post.clone();
      post2.position.set(x, -0.6, 130);
      this.group.add(post2);
    }
  }

  _buildGreenery() {
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
    const crownGeo = new THREE.ConeGeometry(3.2, 5, 7);
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x2f7d4f });
    const lampGeo = new THREE.CylinderGeometry(0.14, 0.14, 6, 6);
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    const bulbGeo = new THREE.SphereGeometry(0.55, 8, 6);
    const bulbMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffdf8a, emissiveIntensity: 0.7 });
    const spots = [];
    for (const r of GRID.roads) {
      for (let t = -144; t <= 144; t += 72) {
        if (this.rng() < 0.6) spots.push([r + 8, t]);
      }
    }
    for (const [x, z] of spots) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 3.5, z);
      this.group.add(trunk);
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.set(x, 9, z);
      this.group.add(crown);
    }
    for (const r of [-126, -54, 18, 90, 162]) {
      for (const t of [-126, -18, 90]) {
        const pole = new THREE.Mesh(lampGeo, lampMat);
        pole.position.set(r + 5.4, 3, t);
        this.group.add(pole);
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(r + 5.4, 6.2, t);
        this.group.add(bulb);
      }
    }
  }

  landmark(id) {
    return LANDMARKS.find((l) => l.id === id);
  }

  // Push a circle (player or car) out of every building/landmark collider
  // and keep it inside the city. Returns the corrected position and whether
  // a collision happened.
  resolveCircle(x, z, r) {
    let hit = false;
    for (const c of this.colliders) {
      const nx = clamp(x, c.xmin, c.xmax);
      const nz = clamp(z, c.zmin, c.zmax);
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pushes = [
            [c.xmin - r - x, 0], [c.xmax + r - x, 0],
            [0, c.zmin - r - z], [0, c.zmax + r - z],
          ];
          let best = pushes[0];
          let bestLen = Math.abs(best[0]) + Math.abs(best[1]);
          for (const p of pushes) {
            const len = Math.abs(p[0]) + Math.abs(p[1]);
            if (len < bestLen) { best = p; bestLen = len; }
          }
          x += best[0];
          z += best[1];
        }
      }
    }
    const nx = clamp(x, -GRID.half, GRID.half);
    const nz = clamp(z, -GRID.half, GRID.half);
    if (nx !== x || nz !== z) { hit = true; x = nx; z = nz; }
    return { x, z, hit };
  }
}
