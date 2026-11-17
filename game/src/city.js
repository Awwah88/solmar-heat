// Solmar Heat — the city of Solmar Bay.
// Builds the whole static world: ground, roads, blocks, landmarks, beach,
// sea, palms, lamps and every collider the cars and the player push against.
// Roads run on the multiples of 40; buildings sit on block centres (the
// +/-20 lines), so no building ever stands on a road. Palms sit at block
// corners, at least 8 units from any road line, so they never snag a car.

import * as THREE from 'three';
import { CITY, COLORS, LANDMARKS, clamp, mulberry32 } from './config.js';

function makeFacadeTexture(base, litRatio, rows, cols, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  // Subtle vertical shading so flat walls read as architecture.
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 0, 8, 256);
  ctx.fillRect(120, 0, 8, 256);
  const cellW = 128 / cols;
  const cellH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng() < litRatio;
      ctx.fillStyle = lit ? '#ffd98a' : '#20242c';
      ctx.fillRect(c * cellW + 3, r * cellH + 5, cellW - 6, cellH - 10);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLabelSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, 506, 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(26, 4.9, 1);
  return sprite;
}

export class City {
  constructor(scene, seed = 0) {
    this.scene = scene;
    this.rng = seed ? mulberry32(seed) : Math.random;
    // Colliders: { minX, maxX, minZ, maxZ } boxes and { x, z, r } circles.
    this.buildingBoxes = [];
    this.circles = [];
    this.landmarkMeshes = {};
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);
  }

  build() {
    this._lights();
    this._ground();
    this._roads();
    this._beachAndSea();
    this._blocks();
    this._landmarks();
    this._palms();
    this._lamps();
    this._pier();
    this._boats();
    return this;
  }

  _lights() {
    const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1cf, 2.1);
    sun.position.set(120, 180, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -220;
    sun.shadow.camera.right = 220;
    sun.shadow.camera.top = 220;
    sun.shadow.camera.bottom = -220;
    sun.shadow.camera.far = 520;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  _ground() {
    const geo = new THREE.PlaneGeometry(560, 560);
    const mat = new THREE.MeshLambertMaterial({ color: COLORS.ground });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.1, 0);
    ground.receiveShadow = true;
    this.group.add(ground);
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.fog, 260, 620);
  }

  _roads() {
    const roadMat = new THREE.MeshLambertMaterial({ color: COLORS.road });
    const lineMat = new THREE.MeshLambertMaterial({ color: COLORS.roadLine });
    const walkMat = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
    const lines = [];
    for (let v = CITY.roadMin; v <= CITY.roadMax; v += CITY.roadStep) lines.push(v);
    for (const v of lines) {
      // East-west road.
      const ew = new THREE.Mesh(new THREE.PlaneGeometry(344, CITY.roadWidth), roadMat);
      ew.rotation.x = -Math.PI / 2;
      ew.position.set(0, 0.02, v);
      ew.receiveShadow = true;
      this.group.add(ew);
      // North-south road.
      const ns = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, 344), roadMat);
      ns.rotation.x = -Math.PI / 2;
      ns.position.set(v, 0.03, 0);
      ns.receiveShadow = true;
      this.group.add(ns);
      // Centre dashes: one long thin strip reads as a line from above.
      const dashEw = new THREE.Mesh(new THREE.PlaneGeometry(340, 0.5), lineMat);
      dashEw.rotation.x = -Math.PI / 2;
      dashEw.position.set(0, 0.05, v);
      this.group.add(dashEw);
      const dashNs = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 340), lineMat);
      dashNs.rotation.x = -Math.PI / 2;
      dashNs.position.set(v, 0.05, 0);
      this.group.add(dashNs);
      // Sidewalk edging along both roads.
      const walkEw = new THREE.Mesh(new THREE.PlaneGeometry(344, 2.4), walkMat);
      walkEw.rotation.x = -Math.PI / 2;
      walkEw.position.set(0, 0.015, v + CITY.roadWidth / 2 + 1.2);
      this.group.add(walkEw);
      const walkNs = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 344), walkMat);
      walkNs.rotation.x = -Math.PI / 2;
      walkNs.position.set(v + CITY.roadWidth / 2 + 1.2, 0.015, 0);
      this.group.add(walkNs);
    }
  }

  _beachAndSea() {
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(560, CITY.beachEnd - CITY.beachStart + 8),
      new THREE.MeshLambertMaterial({ color: COLORS.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.01, (CITY.beachStart + CITY.beachEnd) / 2);
    sand.receiveShadow = true;
    this.group.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 160),
      new THREE.MeshLambertMaterial({ color: COLORS.sea }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.0, CITY.seaStart + 78);
    this.group.add(sea);
    const deep = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 120),
      new THREE.MeshLambertMaterial({ color: COLORS.seaDeep }),
    );
    deep.rotation.x = -Math.PI / 2;
    deep.position.set(0, -0.05, CITY.seaStart + 210);
    this.group.add(deep);
  }

  _blocks() {
    const rng = this.rng;
    const palette = ['#c9a37e', '#b98a6b', '#a8b6c4', '#c4b49a', '#9fb3a4', '#d8c9a3', '#b3a6c9', '#c98d7a'];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4f55 });
    const textures = palette.slice(0, 4).map((c) => makeFacadeTexture(c, 0.28, 8, 5, rng));
    const materials = textures.map((t) => new THREE.MeshLambertMaterial({ map: t }));
    const landmarkCells = new Set(LANDMARKS.map((l) => `${l.at[0]},${l.at[1]}`));
    const centres = [];
    for (let x = -140; x <= 140; x += 40) {
      for (let z = -140; z <= 140; z += 40) centres.push([x, z]);
    }
    for (const [cx, cz] of centres) {
      if (landmarkCells.has(`${cx},${cz}`)) continue;
      const twin = rng() < 0.3;
      const spots = twin ? [[-7, -6], [8, 7]] : [[0, 0]];
      for (const [ox, oz] of spots) {
        const w = 13 + rng() * 9;
        const d = 13 + rng() * 9;
        const h = 8 + rng() * rng() * 30;
        const mat = materials[Math.floor(rng() * materials.length)];
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(cx + ox, h / 2, cz + oz);
        b.castShadow = true;
        b.receiveShadow = true;
        this.group.add(b);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.7, d + 0.6);
        roof.position.set(cx + ox, h + 0.35, cz + oz);
        this.group.add(roof);
        this.buildingBoxes.push({
          minX: cx + ox - w / 2,
          maxX: cx + ox + w / 2,
          minZ: cz + oz - d / 2,
          maxZ: cz + oz + d / 2,
        });
      }
    }
  }

  _landmarks() {
    const rng = this.rng;
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    for (const lm of LANDMARKS) {
      const [x, z] = lm.at;
      const color = new THREE.Color(lm.color);
      const mat = new THREE.MeshLambertMaterial({ color });
      const h = lm.height;
      let mesh;
      if (lm.id === 'lighthouse') {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, h, 12), new THREE.MeshLambertMaterial({ color: 0xf5f0e6 }));
        tower.position.set(x, h / 2, z);
        tower.castShadow = true;
        this.group.add(tower);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.6, 5, 12), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
        cap.position.set(x, h + 2.5, z);
        this.group.add(cap);
        const beam = new THREE.Mesh(
          new THREE.ConeGeometry(7, 26, 12, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xfff6bf, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
        );
        beam.rotation.z = Math.PI / 2;
        beam.position.set(x + 14, h + 2, z);
        this.group.add(beam);
        mesh = tower;
        this.circles.push({ x, z, r: 5.4 });
      } else if (lm.id === 'pier') {
        // The Pier is built by _pier() (deck, posts, hut): no blocky
        // landmark building on it, so the beach road stays open and the
        // courier marker at (60, 200) is reachable.
        mesh = null;
      } else {
        const w = lm.id === 'hotel' ? 26 : lm.id === 'garage' ? 30 : 20;
        const d = lm.id === 'hotel' ? 22 : lm.id === 'garage' ? 18 : 16;
        const tex = makeFacadeTexture(`#${color.getHexString()}`, 0.4, Math.max(3, Math.floor(h / 5)), 6, rng);
        const m2 = new THREE.MeshLambertMaterial({ map: tex });
        mesh = new THREE.Mesh(boxGeo, m2);
        mesh.scale.set(w, h, d);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x3c4148 }));
        roof.scale.set(w + 0.8, 0.8, d + 0.8);
        roof.position.set(x, h + 0.4, z);
        this.group.add(roof);
        this.buildingBoxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
      const label = makeLabelSprite(lm.name, `#${new THREE.Color(lm.color).getHexString()}`);
      label.position.set(x, h + 9, z);
      this.group.add(label);
      this.landmarkMeshes[lm.id] = mesh;
    }
  }

  _palms() {
    const rng = this.rng;
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.palmTrunk });
    const leafGeo = new THREE.ConeGeometry(3.4, 3.2, 6);
    const leafMat = new THREE.MeshLambertMaterial({ color: COLORS.palmLeaf });
    const spot = (x, z) => {
      const lean = (rng() - 0.5) * 0.24;
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 3.5, z);
      trunk.rotation.z = lean;
      trunk.castShadow = true;
      this.group.add(trunk);
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.set(x + lean * 6, 7.6, z);
      leaves.scale.set(1, 0.75, 1);
      leaves.castShadow = true;
      this.group.add(leaves);
      this.circles.push({ x, z, r: 0.8 });
    };
    // Block corners: 12 units from the block centre puts a palm 8 units
    // from the nearest road line — clear of every driving line.
    const centres = [];
    for (let x = -140; x <= 140; x += 40) {
      for (let z = -140; z <= 140; z += 40) centres.push([x, z]);
    }
    for (const [cx, cz] of centres) {
      if (rng() < 0.45) continue;
      const sx = rng() < 0.5 ? -12 : 12;
      const sz = rng() < 0.5 ? -12 : 12;
      spot(cx + sx, cz + sz);
    }
    // Beach palms, kept off the beach driving lines (x=60, x=80, z=200).
    for (const [x, z] of [[-140, 188], [-100, 188], [-20, 188], [20, 188], [100, 188], [140, 188], [-120, 212], [-60, 212], [0, 212], [40, 212], [120, 212], [160, 212]]) {
      spot(x, z);
    }
  }

  _lamps() {
    const poleGeo = new THREE.CylinderGeometry(0.14, 0.2, 6.5, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: COLORS.lampPole });
    const headGeo = new THREE.SphereGeometry(0.5, 8, 6);
    const headMat = new THREE.MeshBasicMaterial({ color: COLORS.lampGlow });
    // At intersection corners, 8 units off each road line.
    for (let x = -160; x <= 160; x += 80) {
      for (let z = -160; z <= 160; z += 80) {
        const px = x + 8;
        const pz = z + 8;
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(px, 3.25, pz);
        this.group.add(pole);
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(px, 6.6, pz);
        this.group.add(head);
        this.circles.push({ x: px, z: pz, r: 0.45 });
      }
    }
  }

  _pier() {
    const wood = new THREE.MeshLambertMaterial({ color: 0x8b6f47 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 44), wood);
    deck.position.set(60, 1.2, 222);
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.group.add(deck);
    const postGeo = new THREE.CylinderGeometry(0.5, 0.5, 4, 6);
    for (const [px, pz] of [[56, 208], [64, 208], [56, 224], [64, 224], [56, 240], [64, 240]]) {
      const post = new THREE.Mesh(postGeo, wood);
      post.position.set(px, 0.5, pz);
      this.group.add(post);
      this.circles.push({ x: px, z: pz, r: 0.7 });
    }
    const hut = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 6), new THREE.MeshLambertMaterial({ color: 0xd8c9a3 }));
    hut.position.set(60, 3.2, 240);
    hut.castShadow = true;
    this.group.add(hut);
    const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 3, 4), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
    hutRoof.position.set(60, 6.7, 240);
    hutRoof.rotation.y = Math.PI / 4;
    this.group.add(hutRoof);
    this.buildingBoxes.push({ minX: 56.5, maxX: 63.5, minZ: 237, maxZ: 243 });
  }

  _boats() {
    const hullMat = new THREE.MeshLambertMaterial({ color: 0xf5f0e6 });
    const hullMat2 = new THREE.MeshLambertMaterial({ color: 0xe2725b });
    const spots = [[-40, 245, 0.4], [120, 252, -0.3], [200, 238, 1.2]];
    spots.forEach(([x, z, rot], i) => {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 3), i % 2 ? hullMat2 : hullMat);
      hull.position.y = 0.4;
      boat.add(hull);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.2), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
      cabin.position.set(-0.6, 1.9, 0);
      boat.add(cabin);
      boat.position.set(x, 0, z);
      boat.rotation.y = rot;
      this.group.add(boat);
    });
  }

  // Push a circle (a car, the player) out of every building box and post.
  // Returns true when anything pushed.
  collideCircle(pos, radius) {
    let hit = false;
    for (const b of this.buildingBoxes) {
      const cx = clamp(pos.x, b.minX, b.maxX);
      const cz = clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // Dead centre: shove out along the smallest penetration axis.
          const pushL = pos.x - b.minX + radius;
          const pushR = b.maxX - pos.x + radius;
          const pushU = pos.z - b.minZ + radius;
          const pushD = b.maxZ - pos.z + radius;
          const m = Math.min(pushL, pushR, pushU, pushD);
          if (m === pushL) pos.x = b.minX - radius;
          else if (m === pushR) pos.x = b.maxX + radius;
          else if (m === pushU) pos.z = b.minZ - radius;
          else pos.z = b.maxZ + radius;
        }
      }
    }
    for (const c of this.circles) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const rr = radius + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = c.x + (dx / d) * rr;
        pos.z = c.z + (dz / d) * rr;
        hit = true;
      }
    }
    pos.x = clamp(pos.x, -CITY.bound, CITY.bound);
    pos.z = clamp(pos.z, -CITY.bound, CITY.bound);
    return hit;
  }

  landmark(id) {
    return LANDMARKS.find((l) => l.id === id);
  }
}
