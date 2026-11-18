// Solmar Heat — the city: buildings with lit windows, the six landmarks,
// palm trees (beach only, never on a road) and street lamps.
// Exports the solid colliders the cars and the player slide along.

import * as THREE from 'three';
import { CONFIG, mulberry32 } from './config.js';

/** Paint a facade texture: warm wall with rows of glowing windows. */
function facadeTexture(baseColor, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${baseColor.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, 128, 256);
  const rng = mulberry32(baseColor ^ 0x9e3779b9);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const lit = rng() < litRatio;
      ctx.fillStyle = lit ? '#ffd98a' : '#2a3038';
      ctx.fillRect(14 + col * 28, 16 + row * 30, 18, 20);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Build the city. Returns colliders and landmark anchors. */
export function createCity(scene) {
  const { world, colors, landmarks } = CONFIG;
  const colliders = [];
  const rng = mulberry32(20261118);

  // One shared facade texture per wall colour, plus plain roof material.
  const facades = colors.building.map((c) => new THREE.MeshLambertMaterial({ map: facadeTexture(c, 0.45) }));
  const roofs = colors.roof.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4a });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });

  // Buildings: one or two per block, set back from the roads.
  for (let i = 0; i < world.roads.length - 1; i++) {
    for (let j = 0; j < world.roads.length - 1; j++) {
      const x0 = world.roads[i] + world.roadWidth / 2 + 3;
      const x1 = world.roads[i + 1] - world.roadWidth / 2 - 3;
      const z0 = world.roads[j] + world.roadWidth / 2 + 3;
      const z1 = world.roads[j + 1] - world.roadWidth / 2 - 3;
      const w = x1 - x0;
      const d = z1 - z0;
      if (w < 8 || d < 8) continue;
      // Skip the block the beach road opens onto (south strip stays open).
      if (z0 > world.beachZ0 - 30) continue;
      const count = rng() < 0.55 ? 1 : 2;
      for (let k = 0; k < count; k++) {
        const bw = count === 1 ? w * 0.62 : w * 0.42;
        const bd = count === 1 ? d * 0.62 : d * 0.42;
        const bx = count === 1 ? (x0 + x1) / 2 : x0 + bw / 2 + (k === 0 ? 0 : w - bw);
        const bz = count === 1 ? (z0 + z1) / 2 : (z0 + z1) / 2;
        const h = 10 + rng() * 22;
        const fi = Math.floor(rng() * facades.length);
        const box = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), facades[fi]);
        box.position.set(bx, h / 2, bz);
        box.castShadow = true;
        box.receiveShadow = true;
        scene.add(box);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(bw + 0.6, 0.8, bd + 0.6),
          roofs[Math.floor(rng() * roofs.length)],
        );
        roof.position.set(bx, h + 0.4, bz);
        scene.add(roof);
        colliders.push({ minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2 });
      }
    }
  }

  // Landmark meshes: distinct silhouettes so each one reads from a distance.
  const landmarkMeshes = {};
  function landmark(key, build) {
    const pos = landmarks[key];
    const group = build(pos);
    group.position.set(pos.x, 0, pos.z);
    scene.add(group);
    landmarkMeshes[key] = group;
    return group;
  }

  // Marina Garage: low wide shed with a striped awning.
  landmark('marina', () => {
    const g = new THREE.Group();
    const shed = new THREE.Mesh(new THREE.BoxGeometry(22, 7, 14), new THREE.MeshLambertMaterial({ color: 0x4a7a9a }));
    shed.position.y = 3.5;
    shed.castShadow = true;
    g.add(shed);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(24, 0.5, 6), new THREE.MeshLambertMaterial({ color: 0xe85a4a }));
    awning.position.set(0, 7.4, 6);
    g.add(awning);
    colliders.push({ minX: -144 - 11, maxX: -144 + 11, minZ: -144 - 7, maxZ: -144 + 7 });
    return g;
  });

  // Hotel Solmar: tall tower with a glowing sign band.
  landmark('hotel', () => {
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.BoxGeometry(16, 34, 16), facades[2]);
    tower.position.y = 17;
    tower.castShadow = true;
    g.add(tower);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(17, 2.4, 17), glowMat);
    sign.position.y = 30;
    g.add(sign);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(17, 1, 17), roofs[1]);
    roof.position.y = 34.5;
    g.add(roof);
    colliders.push({ minX: 144 - 8, maxX: 144 + 8, minZ: -144 - 8, maxZ: -144 + 8 });
    return g;
  });

  // Old Lighthouse: striped tower on the beach with a lamp room.
  landmark('lighthouse', () => {
    const g = new THREE.Group();
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 3.2, 22, 10),
      new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }),
    );
    tower.position.y = 11;
    tower.castShadow = true;
    g.add(tower);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 2.2, 10), new THREE.MeshLambertMaterial({ color: 0xc23b2e }));
    band.position.y = 12;
    g.add(band);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), glowMat);
    lamp.position.y = 23;
    g.add(lamp);
    colliders.push({ minX: 150 - 3.5, maxX: 150 + 3.5, minZ: 185 - 3.5, maxZ: 185 + 3.5 });
    return g;
  });

  // Spray Shop: small booth with a paint-splash roof.
  landmark('spray', () => {
    const g = new THREE.Group();
    const booth = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 9), new THREE.MeshLambertMaterial({ color: 0x7a4ac2 }));
    booth.position.y = 2.5;
    booth.castShadow = true;
    g.add(booth);
    const splash = new THREE.Mesh(new THREE.BoxGeometry(13, 0.6, 10), new THREE.MeshLambertMaterial({ color: 0x2ed3c6 }));
    splash.position.y = 5.3;
    g.add(splash);
    colliders.push({ minX: -54 - 6, maxX: -54 + 6, minZ: 54 - 4.5, maxZ: 54 + 4.5 });
    return g;
  });

  // Safehouse: a low bungalow with a warm porch light.
  landmark('safehouse', () => {
    const g = new THREE.Group();
    const house = new THREE.Mesh(new THREE.BoxGeometry(13, 5.5, 10), new THREE.MeshLambertMaterial({ color: 0xd8b48f }));
    house.position.y = 2.75;
    house.castShadow = true;
    g.add(house);
    const porch = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), glowMat);
    porch.position.set(0, 3.4, 5.4);
    g.add(porch);
    colliders.push({ minX: 54 - 6.5, maxX: 54 + 6.5, minZ: -54 - 5, maxZ: -54 + 5 });
    return g;
  });

  // The Pier: wooden boards running out over the sea, with posts and lamps.
  landmark('pier', () => {
    const g = new THREE.Group();
    const boards = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 42), new THREE.MeshLambertMaterial({ color: 0x8a6a44 }));
    boards.position.set(0, 0.8, 14);
    boards.receiveShadow = true;
    g.add(boards);
    for (let k = 0; k < 4; k++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6), trunkMat);
      post.position.set(k % 2 === 0 ? -3.4 : 3.4, 1.6, 2 + k * 10);
      g.add(post);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), glowMat);
      bulb.position.set(k % 2 === 0 ? -3.4 : 3.4, 3, 2 + k * 10);
      g.add(bulb);
    }
    return g;
  });

  // Palm trees: beach strip ONLY (z around 172-186), never on a road centreline.
  // A car wedged against a trunk collider while its speed is cut every frame
  // crawls and can never reach its destination, so palms stay off the roads.
  const palmSpots = [];
  for (let x = -190; x <= 190; x += 16) {
    if (Math.abs(x - 60) < 10) continue; // keep the pier approach clear
    palmSpots.push([x + (rng() - 0.5) * 6, 174 + rng() * 10]);
  }
  const palmColliders = [];
  for (const [x, z] of palmSpots) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 6.5, 6), trunkMat);
    trunk.position.y = 3.25;
    trunk.rotation.z = (rng() - 0.5) * 0.16;
    trunk.castShadow = true;
    palm.add(trunk);
    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), leafMat);
      frond.position.y = 6.6;
      frond.rotation.y = (f / 5) * Math.PI * 2;
      frond.rotation.z = 0.5;
      frond.position.x = Math.cos((f / 5) * Math.PI * 2) * 1.4;
      frond.position.z = Math.sin((f / 5) * Math.PI * 2) * 1.4;
      palm.add(frond);
    }
    palm.position.set(x, 0, z);
    scene.add(palm);
    palmColliders.push({ x, z, r: 0.9 });
  }

  // Street lamps along the main roads.
  for (const r of [-162, -90, -18, 54, 126]) {
    for (let d = -150; d <= 150; d += 36) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lampMat);
      pole.position.set(r + 7, 3, d);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), glowMat);
      bulb.position.set(r + 7, 6.1, d);
      scene.add(bulb);
    }
  }

  return { colliders, palmColliders, landmarkMeshes };
}

/** Push a circle (car or player) out of solid AABBs. Returns true on contact. */
export function resolveCollisions(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
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
        pos.x = c.maxX + radius;
      }
    }
  }
  return hit;
}
