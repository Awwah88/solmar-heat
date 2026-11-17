// Solmar Heat — city.js
// Builds the whole of Solmar Bay out of boxes, cylinders and planes:
// the 9x9-block street grid, the beach and the sea, the six landmarks,
// palm trees, street lamps and the stunt ramps. It also owns the
// colliders — every solid thing the player or a car can bump into —
// and the day/night lighting rig.
//
// The one rule that matters: roads run on multiples of ROAD_STEP and
// buildings sit halfway between them, so a road is never blocked.

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, LANDMARKS, PALETTE, RAMPS } from './config.js';

export class City {
  constructor(scene) {
    this.scene = scene;
    // Axis-aligned colliders: { minX, maxX, minZ, maxZ }.
    this.colliders = [];
    // Landmark meshes, for the minimap and for shots staging.
    this.landmarkMeshes = {};
    this.lamps = [];
    this.palms = [];
    this.sun = null;
    this.hemi = null;
    this.seaMesh = null;
    this.skyMesh = null;
  }

  build() {
    this._buildGround();
    this._buildRoads();
    this._buildBlocks();
    this._buildLandmarks();
    this._buildBeachAndSea();
    this._buildPalmsAndLamps();
    this._buildRamps();
    this._buildLights();
  }

  _material(color, opts) {
    return new THREE.MeshLambertMaterial({ color, ...(opts || {}) });
  }

  _box(w, h, d, color, x, y, z, opts) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this._material(color, opts));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  _addCollider(minX, maxX, minZ, maxZ) {
    this.colliders.push({ minX, maxX, minZ, maxZ });
  }

  // --- Ground -----------------------------------------------------------------

  _buildGround() {
    const size = 560;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      this._material(0x8fae7a),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, 20);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Big sky dome so the horizon is never black.
    const skyGeo = new THREE.SphereGeometry(420, 16, 12);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x87bfe8,
      side: THREE.BackSide,
      fog: false,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.skyMesh.position.set(0, 0, 20);
    this.scene.add(this.skyMesh);
  }

  _buildRoads() {
    const roadMat = this._material(PALETTE.road);
    const lineMat = this._material(PALETTE.roadLine);
    const span = CONFIG.CITY_MAX - CONFIG.CITY_MIN + 40;
    for (let c = CONFIG.CITY_MIN; c <= CONFIG.CITY_MAX; c += CONFIG.ROAD_STEP) {
      // North-south road.
      const ns = new THREE.Mesh(new THREE.PlaneGeometry(11, span), roadMat);
      ns.rotation.x = -Math.PI / 2;
      ns.position.set(c, 0.02, 0);
      ns.receiveShadow = true;
      this.scene.add(ns);
      // East-west road.
      const ew = new THREE.Mesh(new THREE.PlaneGeometry(span, 11), roadMat);
      ew.rotation.x = -Math.PI / 2;
      ew.position.set(0, 0.02, c);
      ew.receiveShadow = true;
      this.scene.add(ew);
      // Dashed centre lines.
      for (let d = CONFIG.CITY_MIN + 10; d <= CONFIG.CITY_MAX - 10; d += 20) {
        const dash1 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 5), lineMat);
        dash1.rotation.x = -Math.PI / 2;
        dash1.position.set(c, 0.04, d);
        this.scene.add(dash1);
        const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.7), lineMat);
        dash2.rotation.x = -Math.PI / 2;
        dash2.position.set(d, 0.04, c);
        this.scene.add(dash2);
      }
    }
  }

  // --- City blocks ------------------------------------------------------------

  _buildBlocks() {
    // Block centres sit 20 units off the road lines.
    const centres = [];
    for (let c = CONFIG.CITY_MIN + 20; c <= CONFIG.CITY_MAX - 20; c += CONFIG.ROAD_STEP) {
      centres.push(c);
    }
    const wallColors = [0xf2ead8, 0xe8d9c0, 0xdfe8ec, 0xf6e3d3, 0xe2dcc8];
    const roofColors = [0xc96a4a, 0x4a7a5e, 0x7a5fb5, 0x3f6d8a, 0xb5853f];
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const bx of centres) {
      for (const bz of centres) {
        if (bz >= 180) continue; // beach, not blocks
        if (this._isLandmarkBlock(bx, bz)) continue;
        const w = 16 + rand() * 10;
        const d = 16 + rand() * 10;
        const h = 6 + rand() * 14;
        const wall = wallColors[Math.floor(rand() * wallColors.length)];
        const roof = roofColors[Math.floor(rand() * roofColors.length)];
        this._box(w, h, d, wall, bx, h / 2, bz);
        this._box(w + 0.6, 0.8, d + 0.6, roof, bx, h + 0.4, bz);
        // Lit windows: a warm strip along the roofline reads as windows
        // from the street without costing a mesh per window.
        this._box(w + 0.2, 1.1, d + 0.2, 0xffe9a8, bx, h - 1.6, bz);
        this._addCollider(bx - w / 2, bx + w / 2, bz - d / 2, bz + d / 2);
      }
    }
  }

  _isLandmarkBlock(bx, bz) {
    // Landmark buildings sit in their own blocks; keep the generic
    // builder from stacking a second building on top of one.
    for (const key of Object.keys(LANDMARKS)) {
      const b = LANDMARKS[key].building;
      if (Math.abs(b.x - bx) < 22 && Math.abs(b.z - bz) < 22) return true;
    }
    return false;
  }

  // --- Landmarks --------------------------------------------------------------

  _buildLandmarks() {
    // Marina Garage — big teal shed with a roll-up door.
    this._landmarkBox('garage', 26, 10, 20, 0x2e7d6b, 0x1d5c4e);
    this._box(14, 6, 1, 0x9aa5ad, 160, 3, -128);
    // Hotel Solmar — tall sand-coloured tower with a gold crown.
    this._landmarkBox('hotel', 22, 30, 18, 0xd9a441, 0x8a6a2e);
    this._box(24, 2, 20, 0xffe9a8, 40, 31, -20);
    // Old Lighthouse — white tower with a red cap, on the beach edge.
    const lh = LANDMARKS.lighthouse.building;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 34, 12), this._material(0xe8e4d8));
    tower.position.set(lh.x, 17, lh.z);
    tower.castShadow = true;
    this.scene.add(tower);
    this._box(8, 3, 8, 0xd23b2e, lh.x, 35, lh.z);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), this._material(0xffe9a8, { emissive: 0xffd34a }));
    lamp.position.set(lh.x, 37, lh.z);
    this.scene.add(lamp);
    this.landmarkMeshes.lighthouse = tower;
    this._addCollider(lh.x - 6, lh.x + 6, lh.z - 6, lh.z + 6);
    // Spray Shop — low blue workshop.
    this._landmarkBox('spray', 24, 8, 18, 0x4a7fb5, 0x2e5a86);
    // Safehouse — purple two-storey house with a terrace.
    this._landmarkBox('safehouse', 20, 12, 16, 0x7a5fb5, 0x4a3a7a);
    this._box(22, 1, 18, 0x9a7fd2, -160, 12.5, 100);
    // The Pier — a wooden walkway on tall stilts out over the sea, with a
    // hut at the far end. The deck rides high enough that cars can pass
    // underneath it along the beach; only the hut itself is solid.
    const pier = LANDMARKS.pier.building;
    const deck = this._box(8, 1, 60, 0x8a6a4a, pier.x, 2.6, pier.z + 10);
    deck.receiveShadow = true;
    this._box(10, 6, 8, 0x6a4a34, pier.x, 6, pier.z + 34);
    this._box(12, 1, 10, 0xc96a4a, pier.x, 9.5, pier.z + 34);
    for (const [px, pz] of [[-3.5, -16], [3.5, -16], [-3.5, 8], [3.5, 8], [-3.5, 32], [3.5, 32]]) {
      const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.6, 6), this._material(0x6a4a34));
      stilt.position.set(pier.x + px, 1.3, pier.z + 10 + pz);
      this.scene.add(stilt);
    }
    this.landmarkMeshes.pier = deck;
    this._addCollider(pier.x - 5, pier.x + 5, pier.z + 30, pier.z + 38);
  }

  _landmarkBox(key, w, h, d, wall, roof) {
    const b = LANDMARKS[key].building;
    this._box(w, h, d, wall, b.x, h / 2, b.z);
    this._box(w + 1, 1, d + 1, roof, b.x, h + 0.5, b.z);
    this.landmarkMeshes[key] = this.scene.children[this.scene.children.length - 1];
    this._addCollider(b.x - w / 2, b.x + w / 2, b.z - d / 2, b.z + d / 2);
  }

  // --- Beach, sea, palms, lamps, ramps ----------------------------------------

  _buildBeachAndSea() {
    // Sand strip along the south edge.
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(400, 26), this._material(PALETTE.sand));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.03, 192);
    sand.receiveShadow = true;
    this.scene.add(sand);
    // The sea itself, a big flat plane that shimmers by colour only.
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 120),
      this._material(PALETTE.sea, { transparent: true, opacity: 0.92 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.05, 262);
    this.scene.add(sea);
    this.seaMesh = sea;
    // A line of buoys out in the water.
    for (let i = 0; i < 6; i++) {
      const buoy = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), this._material(0xe86a2e));
      buoy.position.set(-140 + i * 56, 0.8, 236);
      this.scene.add(buoy);
    }
  }

  _buildPalmsAndLamps() {
    let seed = 31;
    const rand = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    // Palms line the beach and dot the sidewalks.
    const palmSpots = [];
    for (let x = -160; x <= 160; x += 40) {
      palmSpots.push([x + 12, 176]);
      palmSpots.push([x - 12, 176]);
    }
    for (let i = 0; i < 14; i++) {
      // Block corners: 8 units off every road line, so a car (radius 1.9)
      // can never snag a palm (radius 0.6) even when shoved sideways.
      // Block centres are 20 from the roads, so +12 is the corner.
      const x = -140 + Math.floor(rand() * 8) * 40 + 12;
      const z = -140 + Math.floor(rand() * 8) * 40 + 12;
      palmSpots.push([x, z]);
    }
    for (const [x, z] of palmSpots) this._palm(x, z, 6 + rand() * 3);
    // Street lamps on every other intersection.
    for (let x = CONFIG.CITY_MIN; x <= CONFIG.CITY_MAX; x += 80) {
      for (let z = CONFIG.CITY_MIN; z <= CONFIG.CITY_MAX; z += 80) {
        this._lamp(x + 7, z + 7);
      }
    }
  }

  _palm(x, z, height) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.55, height, 7),
      this._material(PALETTE.palmTrunk),
    );
    trunk.position.y = height / 2;
    trunk.castShadow = true;
    group.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), this._material(PALETTE.palmLeaf));
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.8, height + 0.6, Math.sin(a) * 1.8);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      group.add(leaf);
    }
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.palms.push(group);
    this._addCollider(x - 0.6, x + 0.6, z - 0.6, z + 0.6);
  }

  _lamp(x, z) {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), this._material(PALETTE.lampPost));
    pole.position.y = 3.5;
    pole.castShadow = true;
    group.add(pole);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 8, 6),
      this._material(0xfff2b0, { emissive: 0xffd34a }),
    );
    head.position.y = 7.1;
    group.add(head);
    const light = new THREE.PointLight(0xffd34a, 0, 26, 1.6);
    light.position.y = 7;
    group.add(light);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.lamps.push({ group, light, head });
  }

  _buildRamps() {
    for (const ramp of RAMPS) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 10), this._material(0xe86a2e));
      mesh.position.set(ramp.x, 1.1, ramp.z);
      mesh.rotation.x = -0.42;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      // Chevron paint on the ramp face.
      const chevron = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), this._material(0xfff2b0));
      chevron.position.set(ramp.x, 1.9, ramp.z - 2.5);
      chevron.rotation.x = -0.42 - Math.PI / 2;
      this.scene.add(chevron);
    }
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5e, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
    this.sun.position.set(120, 180, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -220;
    this.sun.shadow.camera.right = 220;
    this.sun.shadow.camera.top = 220;
    this.sun.shadow.camera.bottom = -220;
    this.sun.shadow.camera.far = 600;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  // --- Day / night -------------------------------------------------------------

  // dayTime 0..1: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset.
  // The sun swings across the sky, the sky colour follows, and the street
  // lamps switch on when it gets dark.
  applyDayTime(dayTime) {
    const angle = dayTime * Math.PI * 2 - Math.PI / 2;
    const elevation = Math.sin(angle);
    const sunHeight = 60 + elevation * 160;
    this.sun.position.set(Math.cos(angle) * 200, Math.max(12, sunHeight), 60);
    const dayFactor = Math.max(0.12, Math.min(1, elevation * 1.4 + 0.35));
    this.sun.intensity = 0.25 + dayFactor * 1.45;
    this.hemi.intensity = 0.25 + dayFactor * 0.65;
    const night = dayFactor < 0.45;
    // Blue sky once the sun is properly up, warm orange low on the
    // horizon at dawn and dusk, deep blue after dark.
    const skyColor = night ? 0x1d2a4a : elevation > 0.4 ? 0x87bfe8 : 0xf2a65e;
    this.skyMesh.material.color.setHex(skyColor);
    this.scene.fog = new THREE.Fog(night ? 0x1d2a4a : 0xa8c8e0, 180, 520);
    for (const lamp of this.lamps) {
      lamp.light.intensity = night ? 14 : 0;
      lamp.head.material.emissive.setHex(night ? 0xffd34a : 0x444444);
    }
    return night;
  }

  // --- Collision ---------------------------------------------------------------

  // Push a circle (x, z, radius) out of every collider it overlaps.
  // Returns true when a collision happened.
  resolveCircle(pos, radius) {
    let hit = false;
    for (const c of this.colliders) {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq >= radius * radius) continue;
      hit = true;
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = (radius - dist) / dist;
        pos.x += dx * push;
        pos.z += dz * push;
      } else {
        // Dead centre inside a collider: shove out along the shorter axis.
        const left = pos.x - c.minX;
        const right = c.maxX - pos.x;
        const top = pos.z - c.minZ;
        const bottom = c.maxZ - pos.z;
        const min = Math.min(left, right, top, bottom);
        if (min === left) pos.x = c.minX - radius;
        else if (min === right) pos.x = c.maxX + radius;
        else if (min === top) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
    return hit;
  }

  isOnRoad(x, z) {
    const onX = Math.abs(((x + 20) % 40 + 40) % 40 - 20) <= 7;
    const onZ = Math.abs(((z + 20) % 40 + 40) % 40 - 20) <= 7;
    return onX || onZ;
  }
}
