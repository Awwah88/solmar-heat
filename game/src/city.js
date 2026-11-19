// Solmar Bay city: ground, roads, blocks, buildings, landmarks, beach, sea,
// palms and lamps. Every building collider is clamped to within 10u of its
// block centre, so no building ever reaches a road centreline.

import { BLOCKS, CITY_HALF, LANDMARKS, PITCH, ROADS } from './config.js';

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#20242e';
  for (let y = 10; y < 120; y += 22) {
    for (let x = 10; x < 120; x += 22) {
      g.fillRect(x, y, 13, 14);
    }
  }
  g.fillStyle = '#ffd977';
  for (let i = 0; i < 14; i++) {
    g.fillRect(10 + Math.floor(Math.random() * 5) * 22, 10 + Math.floor(Math.random() * 5) * 22, 13, 14);
  }
  const t = new (window.THREE ? window.THREE.CanvasTexture : null)(c);
  return t;
}

function asphaltTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2c2f36';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#3a3e46';
  g.fillRect(0, 0, 256, 4);
  g.fillRect(0, 60, 256, 4);
  g.fillStyle = '#e8c85a';
  g.fillRect(20, 30, 60, 4);
  g.fillRect(140, 30, 60, 4);
  return new window.THREE.CanvasTexture(c);
}

function signTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg;
  g.font = 'bold 30px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  return new window.THREE.CanvasTexture(c);
}

const PALETTE = [0xd8b48a, 0xc9d6dd, 0xe0a899, 0xb8c4a8, 0xd9c9a3, 0xa8b8cc, 0xe6d3b3, 0xc2a5b8];

export function buildCity(THREE, scene, rng) {
  window.THREE = THREE;
  const group = new THREE.Group();
  const colliders = [];
  const winTex = windowTexture();
  const roadTex = asphaltTexture();
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;

  // Ground: grass base for the city only, so the sea shows beyond it.
  // Sand strips line the east/south edges, sea beyond them.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 360),
    new THREE.MeshLambertMaterial({ color: 0x5d8a4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(20, -0.6, 20);
  group.add(sea);

  const beachMat = new THREE.MeshLambertMaterial({ color: 0xe0c98f });
  const beachE = new THREE.Mesh(new THREE.PlaneGeometry(56, 400), beachMat);
  beachE.rotation.x = -Math.PI / 2;
  beachE.position.set(208, 0.02, 0);
  group.add(beachE);
  const beachS = new THREE.Mesh(new THREE.PlaneGeometry(400, 56), beachMat);
  beachS.rotation.x = -Math.PI / 2;
  beachS.position.set(0, 0.02, 208);
  group.add(beachS);

  // Roads: dark strips with a dashed centre line, on every centreline.
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(10, 1);
  const span = CITY_HALF * 2 + 12;
  for (const c of ROADS) {
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(span, 10), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.04, c);
    ew.receiveShadow = true;
    group.add(ew);
    const nsTex = roadTex.clone();
    nsTex.center.set(0.5, 0.5);
    nsTex.rotation = Math.PI / 2;
    nsTex.needsUpdate = true;
    const ns = new THREE.Mesh(
      new THREE.PlaneGeometry(10, span),
      new THREE.MeshLambertMaterial({ map: nsTex }),
    );
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(c, 0.04, 0);
    ns.receiveShadow = true;
    group.add(ns);
  }

  // Block bases (sidewalk look) and one building per block.
  const landmarkBlocks = new Set(LANDMARKS.map((l) => l.block.join(',')));
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x9a938a });
  const baseGeo = new THREE.PlaneGeometry(26, 26);
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.rotation.x = -Math.PI / 2;
      base.position.set(bx, 0.03, bz);
      base.receiveShadow = true;
      group.add(base);
      if (landmarkBlocks.has(`${bx},${bz}`)) continue;
      const w = 9 + rng() * 6;
      const d = 9 + rng() * 6;
      const h = 6 + rng() * rng() * 18;
      const ox = (rng() * 2 - 1) * Math.max(0, 10 - w / 2);
      const oz = (rng() * 2 - 1) * Math.max(0, 10 - d / 2);
      const cx = bx + ox;
      const cz = bz + oz;
      const color = PALETTE[Math.floor(rng() * PALETTE.length)];
      const mat = new THREE.MeshLambertMaterial({ color, map: winTex });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(cx, h / 2, cz);
      b.castShadow = true;
      b.receiveShadow = true;
      group.add(b);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.7, 0.8, d * 0.7),
        new THREE.MeshLambertMaterial({ color: 0x4a4a52 }),
      );
      roof.position.set(cx, h + 0.4, cz);
      group.add(roof);
      colliders.push({ kind: 'building', xmin: cx - w / 2, xmax: cx + w / 2, zmin: cz - d / 2, zmax: cz + d / 2 });
    }
  }

  // Landmarks.
  const sign = (text, bg, fg, w = 16) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: signTexture(text, bg, fg), transparent: false }),
    );
    return m;
  };
  for (const lm of LANDMARKS) {
    const [bx, bz] = lm.block;
    const g = new THREE.Group();
    if (lm.id === 'lighthouse') {
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 4.2, lm.tall, 12),
        new THREE.MeshLambertMaterial({ color: 0xf2ead6 }),
      );
      tower.position.y = lm.tall / 2;
      tower.castShadow = true;
      g.add(tower);
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 3, 12),
        new THREE.MeshLambertMaterial({ color: 0xb03a2e }),
      );
      top.position.y = lm.tall + 1.5;
      g.add(top);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
      );
      lamp.position.y = lm.tall + 3.4;
      g.add(lamp);
      colliders.push({ kind: 'landmark', xmin: bx - 4, xmax: bx + 4, zmin: bz - 4, zmax: bz + 4 });
    } else if (lm.id === 'pier') {
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(46, 0.6, 8),
        new THREE.MeshLambertMaterial({ color: 0x8a6b46 }),
      );
      deck.position.set(23, 0.3, 0);
      deck.receiveShadow = true;
      g.add(deck);
      for (let i = 0; i < 6; i++) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6),
          new THREE.MeshLambertMaterial({ color: 0x6b4f33 }),
        );
        post.position.set(4 + i * 8, -0.6, i % 2 === 0 ? -3.4 : 3.4);
        g.add(post);
      }
      const hut = new THREE.Mesh(
        new THREE.BoxGeometry(7, 5, 6),
        new THREE.MeshLambertMaterial({ color: 0x7a5a3a }),
      );
      hut.position.set(42, 2.8, 0);
      hut.castShadow = true;
      g.add(hut);
      colliders.push({ kind: 'landmark', xmin: bx + 34, xmax: bx + 42, zmin: bz - 3, zmax: bz + 3 });
    } else {
      const h = lm.tall;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(15, h, 12),
        new THREE.MeshLambertMaterial({ color: lm.color, map: winTex }),
      );
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      const s = sign(lm.name.toUpperCase(), '#20242e', '#ffd977', 15);
      s.position.set(0, Math.min(h + 1.2, 12), 6.2);
      g.add(s);
      colliders.push({ kind: 'landmark', xmin: bx - 7.5, xmax: bx + 7.5, zmin: bz - 6, zmax: bz + 6 });
    }
    g.position.set(bx, 0, bz);
    group.add(g);
  }

  // Palms along the beach and at scattered block corners.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f7d3a });
  const palmSpots = [];
  for (let i = 0; i < 26; i++) palmSpots.push([186 + rng() * 26, -170 + rng() * 340]);
  for (let i = 0; i < 14; i++) palmSpots.push([-170 + rng() * 340, 186 + rng() * 26]);
  for (const [px, pz] of palmSpots) {
    const p = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 6.5, 6), trunkMat);
    trunk.position.y = 3.25;
    trunk.rotation.z = (rng() - 0.5) * 0.16;
    p.add(trunk);
    for (let f = 0; f < 5; f++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.4, 4), leafMat);
      const a = (f / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.6, 6.6, Math.sin(a) * 1.6);
      leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      p.add(leaf);
    }
    p.position.set(px, 0, pz);
    group.add(p);
  }

  // Street lamps at intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x30323a });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const rx of ROADS) {
    for (const rz of ROADS) {
      if ((rx + rz) % 72 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6), poleMat);
      pole.position.set(rx + 6.4, 3.5, rz + 6.4);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bulbMat);
      bulb.position.set(rx + 6.4, 7.1, rz + 6.4);
      group.add(bulb);
    }
  }

  scene.add(group);
  return { group, colliders, roadCentres: ROADS, blockCentres: BLOCKS };
}
