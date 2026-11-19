// Solmar Heat — the city of Solmar Bay.
// A 9x9 grid of blocks on a 36u pitch, roads on the 18+36k lines,
// a beach and turquoise sea to the south and east, and six
// landmarks. Buildings are placed so their colliders never reach
// past 9u from their block centre: with roads 18u away, every road
// keeps a wide clear lane for cars (the Round 8 bug was a second
// building per block drifting onto the road centreline).

import * as THREE from 'three';
import { ROADS, BLOCKS, LANDMARKS, PALETTE, mulberry32 } from './config.js';

function roadTexture(horizontal) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3f46';
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#d8d3c0';
  if (horizontal) {
    // Dashes run along u (the road's length for east-west roads).
    g.fillRect(6, 60, 22, 5);
    g.fillRect(36, 60, 22, 5);
  } else {
    // Dashes run along v (the road's length for north-south roads).
    g.fillRect(30, 6, 5, 44);
    g.fillRect(30, 72, 5, 44);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function buildCity(scene) {
  const rng = mulberry32(20261118);
  const group = new THREE.Group();
  const colliders = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);

  // --- ground, sea, beach -------------------------------------------
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(100, -0.3, 100);
  sea.receiveShadow = true;
  group.add(sea);

  const land = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  land.rotation.x = -Math.PI / 2;
  land.position.set(0, -0.05, 0);
  land.receiveShadow = true;
  group.add(land);

  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(380, 380),
    new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.set(0, 0, 0);
  slab.receiveShadow = true;
  group.add(slab);

  const sandMat = new THREE.MeshLambertMaterial({ color: PALETTE.sand });
  const sandSouth = new THREE.Mesh(new THREE.PlaneGeometry(400, 50), sandMat);
  sandSouth.rotation.x = -Math.PI / 2;
  sandSouth.position.set(0, 0.01, 187);
  sandSouth.receiveShadow = true;
  group.add(sandSouth);
  const sandEast = new THREE.Mesh(new THREE.PlaneGeometry(30, 344), sandMat);
  sandEast.rotation.x = -Math.PI / 2;
  sandEast.position.set(177, 0.01, -10);
  sandEast.receiveShadow = true;
  group.add(sandEast);

  // --- roads ----------------------------------------------------------
  // One shared texture per direction: dashes run along the road.
  const texEW = roadTexture(true);
  texEW.repeat.set(47, 1);
  const texNS = roadTexture(false);
  texNS.repeat.set(1, 47);
  const roadMatEW = new THREE.MeshLambertMaterial({ map: texEW });
  const roadMatNS = new THREE.MeshLambertMaterial({ map: texNS });
  for (const z of ROADS) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(380, 10), roadMatEW);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, z);
    road.receiveShadow = true;
    group.add(road);
  }
  for (const x of ROADS) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 380), roadMatNS);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.02, 0);
    road.receiveShadow = true;
    group.add(road);
  }

  // --- buildings ------------------------------------------------------
  const landmarkBlocks = new Set([
    '-144,-144', '144,-144', '-54,54', '54,-54',
  ]);
  const buildingMats = PALETTE.building.map(
    (c) => new THREE.MeshLambertMaterial({ color: c }),
  );
  const roofMats = PALETTE.roof.map(
    (c) => new THREE.MeshLambertMaterial({ color: c }),
  );
  function addBuilding(cx, cz, hx, hz, h, mat, roofMat) {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(hx * 2, h, hz * 2);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.scale.set(hx * 2 + 0.6, 0.8, hz * 2 + 0.6);
    roof.position.set(cx, h + 0.4, cz);
    roof.castShadow = true;
    group.add(roof);
    colliders.push({
      kind: 'building',
      xmin: cx - hx, xmax: cx + hx, zmin: cz - hz, zmax: cz + hz,
    });
  }
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      if (landmarkBlocks.has(`${bx},${bz}`)) continue;
      const two = rng() < 0.55;
      if (two) {
        // Two small towers on opposite corners; each stays within 9u
        // of the block centre in both axes.
        const h1 = 7 + rng() * 12;
        const h2 = 7 + rng() * 12;
        addBuilding(bx - 4.5, bz - 4.5, 4, 4, h1,
          buildingMats[Math.floor(rng() * buildingMats.length)],
          roofMats[Math.floor(rng() * roofMats.length)]);
        addBuilding(bx + 4.5, bz + 4.5, 4, 4, h2,
          buildingMats[Math.floor(rng() * buildingMats.length)],
          roofMats[Math.floor(rng() * roofMats.length)]);
      } else {
        const ox = (rng() - 0.5) * 8;
        const oz = (rng() - 0.5) * 8;
        const hx = 3.5 + rng() * 1.5;
        const hz = 3.5 + rng() * 1.5;
        const h = 7 + rng() * 16;
        addBuilding(bx + ox, bz + oz, hx, hz, h,
          buildingMats[Math.floor(rng() * buildingMats.length)],
          roofMats[Math.floor(rng() * roofMats.length)]);
      }
    }
  }

  // --- landmarks ------------------------------------------------------
  function addLandmark(key, build) {
    const lm = LANDMARKS[key];
    const meshes = build(lm);
    for (const m of meshes) group.add(m);
    if (!lm.noCollider) {
      colliders.push({
        kind: 'landmark',
        xmin: lm.x - lm.w / 2, xmax: lm.x + lm.w / 2,
        zmin: lm.z - lm.d / 2, zmax: lm.z + lm.d / 2,
        name: lm.name,
      });
    }
  }
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xf2e3c6 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x5d6b7a });
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xe9c46a });
  const redMat = new THREE.MeshLambertMaterial({ color: 0xb5533c });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf6f2e8 });

  // Marina Garage: a long warehouse with a striped awning.
  addLandmark('garage', (lm) => {
    const hall = new THREE.Mesh(boxGeo, wallMat);
    hall.scale.set(lm.w, 9, lm.d);
    hall.position.set(lm.x, 4.5, lm.z);
    hall.castShadow = true;
    const roof = new THREE.Mesh(roofGeo, darkMat);
    roof.scale.set(lm.w + 1, 1, lm.d + 1);
    roof.position.set(lm.x, 9.5, lm.z);
    const door = new THREE.Mesh(boxGeo, darkMat);
    door.scale.set(10, 6, 0.6);
    door.position.set(lm.x, 3, lm.z - lm.d / 2 - 0.2);
    return [hall, roof, door];
  });

  // Hotel Solmar: a tall tower with a gold crown.
  addLandmark('hotel', (lm) => {
    const tower = new THREE.Mesh(boxGeo, whiteMat);
    tower.scale.set(lm.w, 42, lm.d);
    tower.position.set(lm.x, 21, lm.z);
    tower.castShadow = true;
    const crown = new THREE.Mesh(roofGeo, goldMat);
    crown.scale.set(lm.w + 1.5, 2, lm.d + 1.5);
    crown.position.set(lm.x, 43, lm.z);
    const sign = new THREE.Mesh(boxGeo, redMat);
    sign.scale.set(10, 2.5, 0.8);
    sign.position.set(lm.x, 34, lm.z - lm.d / 2 - 0.2);
    return [tower, crown, sign];
  });

  // Old Lighthouse: a striped cylinder tower with a lamp room.
  addLandmark('lighthouse', (lm) => {
    const parts = [];
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 4.2, 22, 12),
      new THREE.MeshLambertMaterial({ color: 0xe8e0cc }),
    );
    tower.position.set(lm.x, 11, lm.z);
    tower.castShadow = true;
    parts.push(tower);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(3.45, 3.6, 3, 12),
      redMat,
    );
    band.position.set(lm.x, 12, lm.z);
    parts.push(band);
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 3.4, 10),
      new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xaa8800 }),
    );
    lamp.position.set(lm.x, 23.5, lm.z);
    parts.push(lamp);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(3, 2.6, 10),
      darkMat,
    );
    cap.position.set(lm.x, 26.4, lm.z);
    parts.push(cap);
    return parts;
  });

  // Spray Shop: a small garage with a red roof, sitting on the road.
  addLandmark('spray', (lm) => {
    const shop = new THREE.Mesh(boxGeo, redMat);
    shop.scale.set(lm.w, 7, lm.d);
    shop.position.set(lm.x, 3.5, lm.z);
    shop.castShadow = true;
    const roof = new THREE.Mesh(roofGeo, darkMat);
    roof.scale.set(lm.w + 1, 0.8, lm.d + 1);
    roof.position.set(lm.x, 7.4, lm.z);
    return [shop, roof];
  });

  // Safehouse: a small teal cottage with a porch.
  addLandmark('safehouse', (lm) => {
    const house = new THREE.Mesh(boxGeo,
      new THREE.MeshLambertMaterial({ color: 0x5fa8a0 }));
    house.scale.set(lm.w, 6, lm.d);
    house.position.set(lm.x, 3, lm.z);
    house.castShadow = true;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(9.5, 4, 4),
      new THREE.MeshLambertMaterial({ color: 0x7a4a3a }),
    );
    roof.position.set(lm.x, 8, lm.z);
    roof.rotation.y = Math.PI / 4;
    return [house, roof];
  });

  // The Pier: a wooden deck running south into the sea (no collider —
  // cars drive onto the sand to reach its tip).
  addLandmark('pier', (lm) => {
    const parts = [];
    const wood = new THREE.MeshLambertMaterial({ color: 0x9a7b4f });
    const deck = new THREE.Mesh(boxGeo, wood);
    deck.scale.set(lm.w, 0.8, lm.d);
    deck.position.set(lm.x, 0.6, lm.z);
    deck.receiveShadow = true;
    parts.push(deck);
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 3, 6),
        new THREE.MeshLambertMaterial({ color: 0x6b5433 }),
      );
      post.position.set(lm.x - 4, 0, lm.z - 10 + i * 5);
      parts.push(post);
      const post2 = post.clone();
      post2.position.x = lm.x + 4;
      parts.push(post2);
    }
    return parts;
  });

  // --- palms ----------------------------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b46 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 7, 6);
  const frondGeo = new THREE.ConeGeometry(1.1, 4.4, 4);
  function addPalm(x, z) {
    const lean = (rng() - 0.5) * 0.25;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    group.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(frondGeo, frondMat);
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 1.4, 7.4, z + Math.sin(a) * 1.4);
      frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      frond.scale.set(1, 1, 0.32);
      group.add(frond);
    }
  }
  for (let x = -170; x <= 170; x += 24) {
    addPalm(x + (rng() - 0.5) * 8, 172 + rng() * 22);
    if (rng() < 0.5) addPalm(172 + rng() * 10, -160 + (x + 170));
  }
  for (let i = 0; i < 14; i++) {
    const bx = BLOCKS[Math.floor(rng() * BLOCKS.length)];
    const bz = BLOCKS[Math.floor(rng() * BLOCKS.length)];
    addPalm(bx + (rng() - 0.5) * 26, bz + (rng() - 0.5) * 26);
  }

  // --- street lamps ---------------------------------------------------
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c313a });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x554400 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const headGeo = new THREE.SphereGeometry(0.45, 8, 6);
  for (const ix of ROADS) {
    for (const iz of ROADS) {
      if (((ix + iz) / 36) % 2 !== 0) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(ix + 7, 3, iz + 7);
      group.add(pole);
      const head = new THREE.Mesh(headGeo, lampMat);
      head.position.set(ix + 7, 6.2, iz + 7);
      group.add(head);
    }
  }

  scene.add(group);
  return { group, colliders, landmarks: LANDMARKS, roadLines: ROADS };
}
