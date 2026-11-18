// Solmar Heat — the ground itself: sunset sky, fog, roads, beach and sea.
// Builds the static terrain the city sits on. Buildings and landmarks live
// in city.js; this file only owns the land, the water and the light.

import * as THREE from 'three';
import { CONFIG } from './config.js';

/** Build the terrain, sky and lights. Returns handles the loop animates. */
export function createWorld(scene) {
  const { world, colors } = CONFIG;
  const size = world.size;

  scene.background = new THREE.Color(colors.sky);
  scene.fog = new THREE.Fog(colors.fog, 120, 380);

  // Warm low sun from the west, plus a soft sky fill.
  const sun = new THREE.DirectionalLight(colors.sun, 2.4);
  sun.position.set(-140, 90, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x2a4a3a, 0.9);
  scene.add(hemi);

  // Grass base for the whole island.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ color: colors.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Road strips: dark asphalt with pale centrelines, on the grid.
  const roadMat = new THREE.MeshLambertMaterial({ color: colors.road });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c86a });
  const half = size / 2;
  for (const r of world.roads) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(world.roadWidth, size), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(r, 0.02, 0);
    ns.receiveShadow = true;
    scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(size, world.roadWidth), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.02, r);
    ew.receiveShadow = true;
    scene.add(ew);
    // Dashed centreline along each road.
    for (let d = -half + 12; d < half - 6; d += 18) {
      const dashN = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), lineMat);
      dashN.rotation.x = -Math.PI / 2;
      dashN.position.set(r, 0.04, d);
      scene.add(dashN);
      const dashE = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), lineMat);
      dashE.rotation.x = -Math.PI / 2;
      dashE.position.set(d, 0.04, r);
      scene.add(dashE);
    }
  }

  // Sidewalk skirts around every block (pale slabs between the roads).
  const walkMat = new THREE.MeshLambertMaterial({ color: colors.sidewalk });
  for (let i = 0; i < world.roads.length - 1; i++) {
    for (let j = 0; j < world.roads.length - 1; j++) {
      const x0 = world.roads[i] + world.roadWidth / 2;
      const x1 = world.roads[i + 1] - world.roadWidth / 2;
      const z0 = world.roads[j] + world.roadWidth / 2;
      const z1 = world.roads[j + 1] - world.roadWidth / 2;
      if (x1 - x0 < 4 || z1 - z0 < 4) continue;
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), walkMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set((x0 + x1) / 2, 0.03, (z0 + z1) / 2);
      slab.receiveShadow = true;
      scene.add(slab);
    }
  }

  // Sand beach along the south edge, then the sea.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(size, world.beachZ1 - world.beachZ0),
    new THREE.MeshLambertMaterial({ color: colors.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, (world.beachZ0 + world.beachZ1) / 2);
  sand.receiveShadow = true;
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(size, 160),
    new THREE.MeshLambertMaterial({ color: colors.sea, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, world.seaZ0 + 80);
  scene.add(sea);

  // A few low sunset clouds, just flat warm slabs high up.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffc890, transparent: true, opacity: 0.55 });
  const clouds = [];
  const cloudSpots = [[-120, 90, -140], [40, 110, -180], [150, 80, 60], [-60, 100, 150], [120, 95, -80], [-40, 70, 280], [110, 75, 300]];
  for (const [x, y, z] of cloudSpots) {
    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(70, 12), cloudMat);
    cloud.position.set(x, y, z);
    cloud.lookAt(0, y, 0);
    scene.add(cloud);
    clouds.push(cloud);
  }

  // Low sun disc over the sea so the sunset reads on camera, with a halo.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }),
  );
  sunDisc.position.set(30, 24, 330);
  sunDisc.lookAt(0, 24, 0);
  scene.add(sunDisc);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(27, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb36b, transparent: true, opacity: 0.35, fog: false }),
  );
  halo.position.set(30, 24, 332);
  halo.lookAt(0, 24, 0);
  scene.add(halo);

  return { sun, sea, clouds };
}

/** Gentle sea shimmer and slow cloud drift. */
export function updateWorld(world, dt, time) {
  world.sea.position.y = 0.02 + Math.sin(time * 0.8) * 0.15;
  for (let i = 0; i < world.clouds.length; i++) {
    world.clouds[i].position.x += Math.sin(time * 0.05 + i) * dt * 0.4;
  }
}
