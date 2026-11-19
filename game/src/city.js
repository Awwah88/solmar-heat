// Solmar Bay city: ground, sea and beach to the east, a 10x10 road grid,
// one or two buildings per block, six landmark buildings, palms and lamps.
// Building colliders are clamped tight inside their blocks (half-extent
// <= 8 + 1.5 jitter) so every road centreline keeps a clear driving slot.
import * as THREE from "three";
import {
  BLOCK_CENTRES,
  COLORS,
  LANDMARKS,
  ROAD_CENTRES,
  ROAD_WIDTH,
  WORLD_HALF,
  makeRng,
  pick,
} from "./config.js";

export class City {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.colliders = [];
    this._materials = new Map();
    this._buildGround();
    this._buildRoads();
    this._buildLandmarks();
    this._buildBlocks();
    this._buildPalmsAndLamps();
  }

  _mat(color, opts = {}) {
    const key = `${color}|${opts.emissive ?? ""}|${opts.flat ? "f" : ""}`;
    if (!this._materials.has(key)) {
      this._materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.9,
          metalness: 0.02,
          emissive: opts.emissive ?? 0x000000,
          emissiveIntensity: opts.emissive ? 0.7 : 0,
        }),
      );
    }
    return this._materials.get(key);
  }

  _box(w, h, d, color, x, y, z, opts = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._mat(color, opts));
    mesh.position.set(x, y, z);
    mesh.castShadow = opts.shadow !== false;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  _buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_HALF * 2 + 80, WORLD_HALF * 2 + 80),
      this._mat(COLORS.ground),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(16, WORLD_HALF * 2 + 80), this._mat(COLORS.sand));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(WORLD_HALF + 8 - 6, 0.01, 0);
    sand.receiveShadow = true;
    this.scene.add(sand);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(110, WORLD_HALF * 2 + 80), this._mat(COLORS.sea));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(WORLD_HALF + 70, -0.4, 0);
    this.scene.add(sea);
  }

  _buildRoads() {
    const roadMat = this._mat(COLORS.road);
    const lineMat = this._mat(COLORS.roadLine, { emissive: 0x554400 });
    for (const c of ROAD_CENTRES) {
      const ew = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF * 2 + 20, ROAD_WIDTH), roadMat);
      ew.rotation.x = -Math.PI / 2;
      ew.position.set(0, 0.02, c);
      ew.receiveShadow = true;
      this.scene.add(ew);
      const ns = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, WORLD_HALF * 2 + 20), roadMat);
      ns.rotation.x = -Math.PI / 2;
      ns.position.set(c, 0.03, 0);
      ns.receiveShadow = true;
      this.scene.add(ns);
      const lineEw = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF * 2 + 20, 0.5), lineMat);
      lineEw.rotation.x = -Math.PI / 2;
      lineEw.position.set(0, 0.05, c);
      this.scene.add(lineEw);
      const lineNs = new THREE.Mesh(new THREE.PlaneGeometry(0.5, WORLD_HALF * 2 + 20), lineMat);
      lineNs.rotation.x = -Math.PI / 2;
      lineNs.position.set(c, 0.06, 0);
      this.scene.add(lineNs);
    }
  }

  _addCollider(kind, cx, cz, hw, hd) {
    const c = {
      kind,
      xmin: cx - hw,
      xmax: cx + hw,
      zmin: cz - hd,
      zmax: cz + hd,
    };
    this.colliders.push(c);
    return c;
  }

  _buildLandmarks() {
    for (const lm of LANDMARKS) {
      const [bx, bz] = lm.block;
      if (lm.id === "lighthouse") {
        const tower = new THREE.Mesh(
          new THREE.CylinderGeometry(3.2, 4.2, 26, 10),
          this._mat(0xf2e6c8),
        );
        tower.position.set(bx, 13, bz);
        tower.castShadow = true;
        this.scene.add(tower);
        const top = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3, 10), this._mat(0xc22a1e, { emissive: 0x881100 }));
        top.position.set(bx, 27.5, bz);
        this.scene.add(top);
        this._addCollider("landmark", bx, bz, 5, 5);
      } else if (lm.id === "pier") {
        this._box(38, 0.8, 10, 0x8a6a42, 181, 0.4, bz);
        for (let i = 0; i < 5; i++) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 6), this._mat(0x6a4a22));
          post.position.set(168 + i * 7, 0.4, bz - 4.4);
          this.scene.add(post);
        }
        this._box(10, 5, 10, lm.tint, bx, 2.5, bz);
        this._addCollider("landmark", bx, bz, 5.5, 5.5);
      } else {
        const tall = lm.id === "hotel";
        const w = tall ? 16 : 18;
        const d = tall ? 12 : 14;
        const h = tall ? 30 : 9;
        this._box(w, h, d, lm.tint, bx, h / 2, bz);
        this._box(w + 1, 0.8, d + 1, COLORS.roof, bx, h + 0.4, bz);
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.7, 1.2, 0.3),
          this._mat(0xffe9a8, { emissive: 0xaa8833 }),
        );
        band.position.set(bx, h * 0.6, bz + d / 2 + 0.2);
        this.scene.add(band);
        this._addCollider("landmark", bx, bz, w / 2, d / 2);
      }
      // Roadside beacon so the landmark is visible from the street.
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 7, 8),
        this._mat(lm.tint, { emissive: lm.tint }),
      );
      beacon.position.set(lm.x, 3.5, lm.z);
      this.scene.add(beacon);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), this._mat(0xffffff, { emissive: 0xffffff }));
      cap.position.set(lm.x, 7.4, lm.z);
      this.scene.add(cap);
    }
  }

  _buildBlocks() {
    const landmarkBlocks = new Set(LANDMARKS.map((l) => `${l.block[0]},${l.block[1]}`));
    for (const bx of BLOCK_CENTRES) {
      for (const bz of BLOCK_CENTRES) {
        if (landmarkBlocks.has(`${bx},${bz}`)) continue;
        const r = this.rng;
        if (r() < 0.14) {
          this._palm(bx + (r() - 0.5) * 12, bz + (r() - 0.5) * 12);
          continue;
        }
        const count = r() < 0.3 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const w = 10 + r() * 6;
          const d = 10 + r() * 6;
          const h = 8 + r() * 18;
          const jx = count === 1 ? (r() - 0.5) * 3 : i === 0 ? -4.5 : 4.5;
          const jz = count === 1 ? (r() - 0.5) * 3 : (r() - 0.5) * 8;
          const cx = bx + jx;
          const cz = bz + jz;
          const color = pick(r, COLORS.building);
          this._box(w, h, d, color, cx, h / 2, cz);
          this._box(w + 0.8, 0.7, d + 0.8, COLORS.roof, cx, h + 0.35, cz);
          const win = new THREE.Mesh(
            new THREE.BoxGeometry(Math.min(w * 0.6, 8), 1.0, 0.25),
            this._mat(0xffe9a8, { emissive: 0x776633 }),
          );
          win.position.set(cx, h * 0.55, cz + d / 2 + 0.15);
          this.scene.add(win);
          // Clamp the collider tight: half-extent never pushes past the block.
          const hw = Math.min(w / 2, 8);
          const hd = Math.min(d / 2, 8);
          this._addCollider("building", cx, cz, hw, hd);
        }
      }
    }
  }

  _palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 6, 6), this._mat(COLORS.palmTrunk));
    trunk.position.set(x, 3, z);
    trunk.castShadow = true;
    this.scene.add(trunk);
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), this._mat(COLORS.palmTop));
    top.position.set(x, 6.8, z);
    top.scale.y = 0.6;
    top.castShadow = true;
    this.scene.add(top);
  }

  _buildPalmsAndLamps() {
    const r = this.rng;
    for (let i = 0; i < 42; i++) {
      const road = pick(r, ROAD_CENTRES);
      const along = -170 + r() * 340;
      const side = r() < 0.5 ? -1 : 1;
      if (r() < 0.5) this._palm(road + side * 10.5, along);
      else this._palm(along, road + side * 10.5);
    }
    for (const c of ROAD_CENTRES) {
      for (let k = -2; k <= 2; k++) {
        const at = k * 72;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), this._mat(COLORS.lamp));
        pole.position.set(c + 8, 3.5, at);
        this.scene.add(pole);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), this._mat(0xfff2b0, { emissive: 0xccaa33 }));
        head.position.set(c + 8, 7.2, at);
        this.scene.add(head);
      }
    }
  }

  landmarkById(id) {
    return LANDMARKS.find((l) => l.id === id);
  }
}
