// Solmar Bay: the 9x9-block city, beach, sea, palms, lamps and the six
// landmarks. Layout is deterministic (seeded RNG) so every load sees the
// same streets.
//
// ROAD CLEARANCE RULE (the Round 8 lesson): a building's collider edge
// must never come within ~4 units of a road centreline. Roads are 10
// wide, the car collides as a 2.0-radius circle, and a road centreline
// sits 18 units from the nearest block centre. Every building is clamped
// so its edges stay within 10 units of its block centre — 8 units clear
// of the road centreline, leaving a 12+ unit corridor for the car centre
// on every lane. There is no per-building random offset that can push a
// collider onto a road.
import * as THREE from 'three';
import { CFG, makeRng, clamp } from './config.js';

function windowTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  for (let y = 10; y < 120; y += 18) {
    for (let x = 8; x < 58; x += 16) {
      g.fillStyle = Math.random() < 0.55 ? lit : '#20242e';
      g.fillRect(x, y, 9, 11);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene) {
  const rng = makeRng(20261118);
  const colliders = []; // {x0,z0,x1,z1,kind}
  const buildings = []; // {x,z,hw,hd,h} for the minimap
  const group = new THREE.Group();
  scene.add(group);

  const texes = [
    windowTexture('#c96f4a', '#ffd27a'),
    windowTexture('#4a7a9e', '#ffe9a8'),
    windowTexture('#8a7a5a', '#ffd27a'),
    windowTexture('#5a6a7a', '#ffe9a8'),
  ];

  // --- ground: asphalt city slab, then block slabs on top ------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(380, 380),
    new THREE.MeshLambertMaterial({ color: CFG.colors.asphalt })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  // Sand strip and sea beyond the city edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(380, 26),
    new THREE.MeshLambertMaterial({ color: CFG.colors.sand })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, 175);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 120),
    new THREE.MeshLambertMaterial({ color: CFG.colors.sea })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, 248);
  group.add(sea);

  // Block slabs (sidewalk) + centre-line dashes on every road.
  const slabMat = new THREE.MeshLambertMaterial({ color: CFG.colors.sidewalk });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c86a });
  for (const cx of CFG.blockCentres) {
    for (const cz of CFG.blockCentres) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(35, 0.3, 35), slabMat);
      slab.position.set(cx, 0.12, cz);
      group.add(slab);
    }
  }
  for (const r of CFG.roads) {
    for (let p = -162; p <= 162; p += 18) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 5), dashMat);
      dash.position.set(r, 0.06, p + 9);
      group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.BoxGeometry(5, 0.06, 0.7), dashMat);
      dash2.position.set(p + 9, 0.06, r);
      group.add(dash2);
    }
  }

  // --- buildings: clamped inside each block --------------------------
  // A building's half extents hw/hd plus its centre offset must total
  // at most buildingMaxEdge (10) from the block centre on each axis.
  const landmarkBlocks = new Set(['-144,-144', '144,-144']);
  function addBuilding(cx, cz, hw, hd, h, texIdx, tint) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ map: texes[texIdx % texes.length], color: tint });
    const body = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, h, hd * 2), mat);
    body.position.y = h / 2 + 0.3;
    g.add(body);
    // Rooftop detail: parapet + AC box.
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(hw * 2 - 1.2, 0.7, hd * 2 - 1.2),
      new THREE.MeshLambertMaterial({ color: 0x3a3a40 })
    );
    roof.position.y = h + 0.65;
    g.add(roof);
    const ac = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.1, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x9aa0a6 })
    );
    ac.position.set(hw * 0.4, h + 1.2, -hd * 0.3);
    g.add(ac);
    g.position.set(cx, 0, cz);
    group.add(g);
    colliders.push({ x0: cx - hw, z0: cz - hd, x1: cx + hw, z1: cz + hd, kind: 'building' });
    buildings.push({ x: cx, z: cz, hw, hd, h });
  }

  for (const bx of CFG.blockCentres) {
    for (const bz of CFG.blockCentres) {
      if (landmarkBlocks.has(`${bx},${bz}`)) continue;
      const count = rng() < 0.62 ? 2 : 1;
      // First tower: chunky, near the block centre.
      let hw = 4 + rng() * 2.5;
      let hd = 4 + rng() * 2.5;
      let ox = (rng() * 2 - 1) * (CFG.buildingMaxEdge - hw);
      let oz = (rng() * 2 - 1) * (CFG.buildingMaxEdge - hd);
      const h1 = 8 + rng() * 12;
      const tint1 = CFG.colors.building[Math.floor(rng() * CFG.colors.building.length)];
      addBuilding(bx + ox, bz + oz, hw, hd, h1, Math.floor(rng() * 4), tint1);
      if (count === 2) {
        // Second tower: smaller, pushed to the opposite quadrant, and
        // clamped by the same rule — no extra offset that can reach a road.
        const hw2 = 3 + rng() * 1.5;
        const hd2 = 3 + rng() * 1.5;
        let ox2 = -Math.sign(ox || 1) * (CFG.buildingMaxEdge - hw2) * (0.35 + rng() * 0.6);
        let oz2 = -Math.sign(oz || 1) * (CFG.buildingMaxEdge - hd2) * (0.35 + rng() * 0.6);
        ox2 = clamp(ox2, -(CFG.buildingMaxEdge - hw2), CFG.buildingMaxEdge - hw2);
        oz2 = clamp(oz2, -(CFG.buildingMaxEdge - hd2), CFG.buildingMaxEdge - hd2);
        const h2 = 6 + rng() * 8;
        const tint2 = CFG.colors.building[Math.floor(rng() * CFG.colors.building.length)];
        addBuilding(bx + ox2, bz + oz2, hw2, hd2, h2, Math.floor(rng() * 4), tint2);
      }
    }
  }

  // --- landmarks ------------------------------------------------------
  const lm = CFG.landmarks;
  function boxAt(x, z, w, h, d, color, y0) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color })
    );
    m.position.set(x, (y0 || 0) + h / 2, z);
    group.add(m);
    return m;
  }
  function signAt(x, y, z, text, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#101418'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = color || '#ffd27a';
    g.font = 'bold 30px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 2.2),
      new THREE.MeshBasicMaterial({ map: t })
    );
    m.position.set(x, y, z);
    group.add(m);
    return m;
  }

  // Marina Garage: low wide shed with an open front.
  boxAt(lm.garage.x, lm.garage.z, 18, 7, 14, 0x7a4a3a, 0.3);
  signAt(lm.garage.x, 8.6, lm.garage.z - 7.2, 'MARINA GARAGE');
  colliders.push({ x0: lm.garage.x - lm.garage.hw, z0: lm.garage.z - lm.garage.hd, x1: lm.garage.x + lm.garage.hw, z1: lm.garage.z + lm.garage.hd, kind: 'landmark' });

  // Hotel Solmar: tall tower with a lit sign.
  boxAt(lm.hotel.x, lm.hotel.z, 16, 26, 12, 0x4a7a9e, 0.3);
  boxAt(lm.hotel.x, lm.hotel.z, 18, 1.2, 14, 0x2e4a5e, 26.3);
  signAt(lm.hotel.x, 24, lm.hotel.z - 6.4, 'HOTEL SOLMAR', '#ffe9a8');
  colliders.push({ x0: lm.hotel.x - lm.hotel.hw, z0: lm.hotel.z - lm.hotel.hd, x1: lm.hotel.x + lm.hotel.hw, z1: lm.hotel.z + lm.hotel.hd, kind: 'landmark' });

  // Old Lighthouse: striped cylinder + lamp room on the beach.
  {
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 4.2, 22, 12),
      new THREE.MeshLambertMaterial({ color: 0xe8e0d0 })
    );
    tower.position.set(lm.lighthouse.x, 11.3, lm.lighthouse.z);
    group.add(tower);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 3.8, 3, 12),
      new THREE.MeshLambertMaterial({ color: 0xc0392b })
    );
    band.position.set(lm.lighthouse.x, 15, lm.lighthouse.z);
    group.add(band);
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 3, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
    );
    lamp.position.set(lm.lighthouse.x, 23.5, lm.lighthouse.z);
    group.add(lamp);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(6, 26, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.16, side: THREE.DoubleSide })
    );
    beam.rotation.z = Math.PI / 2;
    beam.position.set(lm.lighthouse.x + 14, 23.5, lm.lighthouse.z);
    group.add(beam);
    colliders.push({ x0: lm.lighthouse.x - lm.lighthouse.hw, z0: lm.lighthouse.z - lm.lighthouse.hd, x1: lm.lighthouse.x + lm.lighthouse.hw, z1: lm.lighthouse.z + lm.lighthouse.hd, kind: 'landmark' });
  }

  // Spray Shop: booth with a striped awning, sitting on the intersection.
  boxAt(lm.spray.x, lm.spray.z, 12, 6, 12, 0x2e8b6a, 0.3);
  {
    const awn = new THREE.Mesh(
      new THREE.BoxGeometry(13, 0.5, 4),
      new THREE.MeshLambertMaterial({ color: 0xf1c40f })
    );
    awn.position.set(lm.spray.x, 6.6, lm.spray.z - 7);
    group.add(awn);
  }
  signAt(lm.spray.x, 7.6, lm.spray.z - 6.4, 'SPRAY $75', '#7CFC00');
  colliders.push({ x0: lm.spray.x - lm.spray.hw, z0: lm.spray.z - lm.spray.hd, x1: lm.spray.x + lm.spray.hw, z1: lm.spray.z + lm.spray.hd, kind: 'landmark' });

  // Safehouse: small cottage with a porch light.
  boxAt(lm.safehouse.x, lm.safehouse.z, 11, 5, 11, 0x8a6a4a, 0.3);
  {
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(8.4, 3.4, 4),
      new THREE.MeshLambertMaterial({ color: 0x5a3a2a })
    );
    roof.position.set(lm.safehouse.x, 6.9, lm.safehouse.z);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
    );
    lamp.position.set(lm.safehouse.x, 4.4, lm.safehouse.z - 5.8);
    group.add(lamp);
  }
  colliders.push({ x0: lm.safehouse.x - lm.safehouse.hw, z0: lm.safehouse.z - lm.safehouse.hd, x1: lm.safehouse.x + lm.safehouse.hw, z1: lm.safehouse.z + lm.safehouse.hd, kind: 'landmark' });

  // The Pier: wooden deck out over the sea, hut at the far end.
  {
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(32, 1, 28),
      new THREE.MeshLambertMaterial({ color: 0x8a6a4a })
    );
    deck.position.set(lm.pier.x, 1.2, lm.pier.z);
    group.add(deck);
    boxAt(lm.pier.x, lm.pier.z + 10, 8, 4, 6, 0x6a4a3a, 1.7);
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 4, 6),
        new THREE.MeshLambertMaterial({ color: 0x5a3a2a })
      );
      post.position.set(lm.pier.x - 14 + i * 7, 0.4, lm.pier.z + 12);
      group.add(post);
    }
    colliders.push({ x0: lm.pier.x - lm.pier.hw, z0: lm.pier.z - lm.pier.hd, x1: lm.pier.x + lm.pier.hw, z1: lm.pier.z + lm.pier.hd, kind: 'landmark' });
  }

  // --- palms: beach strip only, never on a road centreline -----------
  // The beach road runs along z=172; keep the cover-shot lane (x=60)
  // and the lighthouse approach (x=150) clear.
  const palmTrunk = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const palmLeaf = new THREE.MeshLambertMaterial({ color: 0x2e7a3a, side: THREE.DoubleSide });
  for (let x = -168; x <= 168; x += 13) {
    if (Math.abs(x - 60) < 11 || Math.abs(x - 150) < 11) continue;
    const jx = x + (rng() - 0.5) * 5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), palmTrunk);
    trunk.position.set(jx, 3.5, 172);
    trunk.rotation.z = (rng() - 0.5) * 0.16;
    group.add(trunk);
    for (let f = 0; f < 5; f++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.4, 4), palmLeaf);
      const a = (f / 5) * Math.PI * 2;
      leaf.position.set(jx + Math.cos(a) * 1.6, 7.4, 172 + Math.sin(a) * 1.6);
      leaf.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      group.add(leaf);
    }
  }

  // --- street lamps along the roads ------------------------------------
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const r of CFG.roads) {
    for (let p = -144; p <= 144; p += 72) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.5, 6), poleMat);
      pole.position.set(r + 6.5, 3.25, p);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      head.position.set(r + 6.5, 6.7, p);
      group.add(head);
    }
  }

  // Sunset: low sun disc over the sea + warm fog.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(16, 24),
    new THREE.MeshBasicMaterial({ color: CFG.colors.sun, fog: false })
  );
  sun.position.set(40, 26, 320);
  sun.lookAt(0, 26, 0);
  group.add(sun);

  return {
    group, colliders, buildings,
    landmarks: CFG.landmarks,
    update() { /* the sea stays still; the light does the work */ },
  };
}

// Resolve a circle (x, z, r) against the AABB colliders: push it out
// along the smallest penetration axis. Returns the corrected position
// and whether a hit happened.
export function collideCircle(x, z, r, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = clamp(x, c.x0, c.x1);
    const nz = clamp(z, c.z0, c.z1);
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r;
      z = nz + (dz / d) * r;
    } else {
      // Centre inside the box: shove out along the smallest side.
      const l = x - c.x0 + r, rr = c.x1 - x + r;
      const t = z - c.z0 + r, b = c.z1 - z + r;
      const m = Math.min(l, rr, t, b);
      if (m === l) x = c.x0 - r;
      else if (m === rr) x = c.x1 + r;
      else if (m === t) z = c.z0 - r;
      else z = c.z1 + r;
    }
  }
  return { x, z, hit };
}
