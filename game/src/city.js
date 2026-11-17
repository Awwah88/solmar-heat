// Solmar Heat — city.js
// One clear job: build the whole city of Solmar Bay in Three.js — roads,
// blocks, buildings, beach, water, palms, lamps and the mission landmarks —
// plus the collision boxes the rest of the game drives against.
import * as THREE from 'three';
import { CITY, COLORS, mulberry32 } from './config.js';

function makeWindowTexture(rand, tint) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = rand() > 0.45;
      ctx.fillStyle = lit ? '#ffe9a8' : '#2c3e55';
      ctx.fillRect(8 + col * 20, 10 + row * 20, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSignTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = fg;
  ctx.font = 'bold 56px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene) {
  const rand = mulberry32(1337);
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Sky, sun and light.
  scene.background = new THREE.Color(COLORS.skyTop);
  scene.fog = new THREE.Fog(0xf7d9a8, 220, 520);
  const sun = new THREE.DirectionalLight(COLORS.sun, 2.6);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6b46, 1.1));

  // Ground: pale sidewalk city floor, sand beach to the south, blue water.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshStandardMaterial({ color: COLORS.sidewalk, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -10);
  ground.receiveShadow = true;
  group.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 34),
    new THREE.MeshStandardMaterial({ color: 0xf0d9a0, roughness: 1 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.04, CITY.beachZ + 8);
  beach.receiveShadow = true;
  group.add(beach);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 80),
    new THREE.MeshStandardMaterial({ color: COLORS.water, roughness: 0.25, metalness: 0.1 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.02, CITY.waterZ + 34);
  group.add(water);

  // Roads: dark strips on the grid, with dashed centre lines (instanced).
  const roadMat = new THREE.MeshStandardMaterial({ color: COLORS.road, roughness: 0.95 });
  const coords = [];
  for (let c = -160; c <= 160; c += 40) coords.push(c);
  coords.forEach((c) => {
    const alongX = new THREE.Mesh(new THREE.PlaneGeometry(380, 10), roadMat);
    alongX.rotation.x = -Math.PI / 2;
    alongX.position.set(0, 0.06, c);
    alongX.receiveShadow = true;
    group.add(alongX);
    const alongZ = new THREE.Mesh(new THREE.PlaneGeometry(10, 380), roadMat);
    alongZ.rotation.x = -Math.PI / 2;
    alongZ.position.set(c, 0.06, 0);
    alongZ.receiveShadow = true;
    group.add(alongZ);
  });
  const dashGeo = new THREE.BoxGeometry(3, 0.08, 0.6);
  const dashMat = new THREE.MeshBasicMaterial({ color: COLORS.roadLine });
  const dashPositions = [];
  coords.forEach((c) => {
    for (let p = -170; p <= 170; p += 10) {
      dashPositions.push([p, c, 0]);
      dashPositions.push([c, p, 1]);
    }
  });
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashPositions.length);
  const dummy = new THREE.Object3D();
  dashPositions.forEach(([a, b, rot], i) => {
    dummy.position.set(rot === 0 ? a : b, 0.09, rot === 0 ? b : a);
    dummy.rotation.y = rot === 0 ? 0 : Math.PI / 2;
    dummy.updateMatrix();
    dashes.setMatrixAt(i, dummy.matrix);
  });
  group.add(dashes);

  // Buildings: one or two boxes per block, pastel sun-soaked colours,
  // lit-window textures, and a collision box each.
  const windowTextures = [
    makeWindowTexture(rand, '#f2e3c6'),
    makeWindowTexture(rand, '#e8b4a0'),
    makeWindowTexture(rand, '#a8d8ce'),
  ];
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  const palette = COLORS.buildingPalette;
  // Blocks sit BETWEEN the roads: their centres are offset 20 from the
  // road lines, so no building ever stands on a road. The four blocks the
  // mission landmarks occupy are skipped — the landmark stands there.
  const landmarkBlocks = new Set(['140,-140', '20,-20', '-140,20', '-140,140']);
  const blockCentres = [];
  for (let bx = -140; bx <= 140; bx += 40) {
    for (let bz = -140; bz <= 140; bz += 40) {
      if (landmarkBlocks.has(`${bx},${bz}`)) continue;
      blockCentres.push([bx, bz]);
    }
  }
  blockCentres.forEach(([bx, bz]) => {
    const count = rand() > 0.6 ? 2 : 1;
    for (let k = 0; k < count; k += 1) {
      const w = 12 + rand() * 12;
      const d = 12 + rand() * 12;
      const h = 8 + rand() * rand() * 34;
      const ox = count === 1 ? 0 : (k === 0 ? -7 : 7);
      const oz = count === 1 ? 0 : (k === 0 ? -6 : 7);
      const mat = new THREE.MeshStandardMaterial({
        color: palette[Math.floor(rand() * palette.length)],
        map: windowTextures[Math.floor(rand() * windowTextures.length)],
        roughness: 0.85,
      });
      const mesh = new THREE.Mesh(buildingGeo, mat);
      mesh.scale.set(w, h, d);
      mesh.position.set(bx + ox, h / 2, bz + oz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      colliders.push({ x: bx + ox, z: bz + oz, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
      // Flat roof cap in a contrasting colour.
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.6, 0.7, d + 0.6),
        new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 }),
      );
      cap.position.set(bx + ox, h + 0.35, bz + oz);
      group.add(cap);
    }
  });

  // Palm trees along the beach promenade and a few blocks.
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.palmTrunk, roughness: 1 });
  const leafGeo = new THREE.IcosahedronGeometry(2.6, 0);
  const leafMat = new THREE.MeshStandardMaterial({ color: COLORS.palmLeaf, roughness: 1 });
  for (let x = -170; x <= 170; x += 20) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x + (rand() - 0.5) * 6, 3.5, CITY.beachZ - 4);
    trunk.castShadow = true;
    group.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.scale.set(1.4, 0.55, 1.4);
    leaves.position.set(trunk.position.x, 7.6, trunk.position.z);
    leaves.castShadow = true;
    group.add(leaves);
  }
  for (let i = 0; i < 26; i += 1) {
    const bx = coords[Math.floor(rand() * coords.length)];
    const bz = coords[Math.floor(rand() * coords.length)];
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(bx + 14, 3.5, bz + 14);
    group.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.scale.set(1.3, 0.5, 1.3);
    leaves.position.set(bx + 14, 7.4, bz + 14);
    group.add(leaves);
  }

  // Street lamps at intersections (emissive heads glow at dusk).
  const lampPoleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 6);
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.6, metalness: 0.4 });
  const lampHeadGeo = new THREE.SphereGeometry(0.45, 8, 6);
  const lampHeadMat = new THREE.MeshStandardMaterial({
    color: 0xfff6c8,
    emissive: 0xffdf7a,
    emissiveIntensity: 0.9,
  });
  coords.forEach((cx) => {
    coords.forEach((cz) => {
      if ((cx + cz) % 80 !== 0) return;
      const pole = new THREE.Mesh(lampPoleGeo, lampPoleMat);
      pole.position.set(cx + 6.5, 3, cz + 6.5);
      group.add(pole);
      const head = new THREE.Mesh(lampHeadGeo, lampHeadMat);
      head.position.set(cx + 6.5, 6.2, cz + 6.5);
      group.add(head);
    });
  });

  // --- Mission landmarks (original names, signs made from canvas textures).
  function signPlane(text, bg, fg, w, x, y, z, ry = 0) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(text, bg, fg) }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    group.add(mesh);
    return mesh;
  }
  function landmarkBox(x, z, w, h, d, color, signText, signBg) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
    );
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push({ x, z, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
    if (signText) signPlane(signText, signBg, '#ffffff', Math.min(18, w + 4), x, h + 2.2, z + d / 2 + 0.3);
    return mesh;
  }

  // Marina Garage (Mission 1 destination), north-east.
  landmarkBox(140, -140, 22, 9, 16, 0x3a7d5c, 'MARINA GARAGE', '#2c5c44');
  // Hotel Solmar (Mission 2 drop-off), centre.
  landmarkBox(20, -20, 20, 42, 20, 0xf2e3c6, 'HOTEL SOLMAR', '#b07a2a');
  // Old Lighthouse on the beach (Mission 2 drop-off).
  const lighthouse = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.2, 26, 10),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
  );
  lighthouse.position.set(-140, 13, CITY.beachZ - 2);
  lighthouse.castShadow = true;
  group.add(lighthouse);
  const lightTop = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 3, 10),
    new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe9a8, emissiveIntensity: 1.2 }),
  );
  lightTop.position.set(-140, 27.5, CITY.beachZ - 2);
  group.add(lightTop);
  colliders.push({ x: -140, z: CITY.beachZ - 2, hx: 5, hz: 5 });
  signPlane('LIGHTHOUSE', '#3a6ea5', '#ffffff', 16, -140, 8, CITY.beachZ + 4);
  // Spray Shop (clears wanted), west.
  landmarkBox(-140, 20, 18, 8, 14, 0x2e7d6b, 'SPRAY SHOP $75', '#1d5c4e');
  // Safehouse (Mission 3 destination), south-west.
  landmarkBox(-140, 140, 16, 7, 14, 0x7a5c9e, 'SAFEHOUSE', '#5a3d7a');
  // The Pier (Mission 2 drop-off) — a wooden walkway into the water.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(8, 1, 40),
    new THREE.MeshStandardMaterial({ color: 0x8a6b46, roughness: 1 }),
  );
  pier.position.set(60, 0.6, CITY.beachZ + 16);
  pier.castShadow = true;
  group.add(pier);

  return {
    colliders,
    water,
    lighthouseTop: lightTop,
    markers: {
      garage: { x: 140, z: -118 },
      spray: { x: -140, z: 42 },
      safehouse: { x: -140, z: 118 },
      pier: { x: 60, z: CITY.beachZ + 28 },
      hotel: { x: 20, z: 4 },
      lighthouse: { x: -140, z: CITY.beachZ - 10 },
      marinaCar: { x: 100, z: -140 },
      playerStart: { x: 80, z: -140 },
    },
  };
}
