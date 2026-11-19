// Solmar Heat — the city itself. Builds the 9x9-block grid, roads, beach
// and sea, palms, lamps and all eight landmarks (Casino Solmar and the
// Solmar Boardwalk are new in R16), and owns the collision boxes.
// ROAD SAFETY: every building collider is clamped so its half-extent is at
// most 9u from its block centre — a block centre sits 18u from the nearest
// road centreline, so no building can ever reach a road's centre slot.
import * as THREE from 'three';
import { ROADS, BLOCKS, LANDMARKS } from './config.js';

function hash(x, z) {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
function box(w, h, d, color, x, y, z, emissive = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.85, metalness: 0.05 }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function neonSign(text, color, w) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const c = canvas.getContext('2d');
  c.fillStyle = '#111118'; c.fillRect(0, 0, 512, 128);
  c.font = 'bold 64px Arial, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowColor = '#ff2fb3'; c.shadowBlur = 28;
  c.fillStyle = '#ffd7f2';
  c.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, 3.2, 0.4),
    new THREE.MeshStandardMaterial({ map: tex, emissive: color, emissiveMap: tex, emissiveIntensity: 1.4 }),
  );
  return m;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.landmarkMeshes = {};
    this.palms = [];
    this.build();
  }
  _collider(cx, cz, hw, hd, kind) {
    // Clamp the half-extents: a building may never stretch more than 9u
    // from its block centre, which keeps every road centre slot clear.
    const hw2 = Math.min(hw, kind === 'building' ? 9 : 12);
    const hd2 = Math.min(hd, kind === 'building' ? 9 : 12);
    const c = { xmin: cx - hw2, xmax: cx + hw2, zmin: cz - hd2, zmax: cz + hd2, kind };
    this.colliders.push(c);
    return c;
  }
  _building(cx, cz, w, d, h, color) {
    const m = box(w, h, d, color, cx, h / 2, cz);
    this.scene.add(m);
    this._collider(cx, cz, w / 2, d / 2, 'building');
    const roof = box(w * 0.55, 1.2, d * 0.55, 0x9aa3ad, cx, h + 0.6, cz);
    this.scene.add(roof);
    return m;
  }
  build() {
    const s = this.scene;
    // Ground slab, then road ribbons on top of it.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(440, 440),
      new THREE.MeshStandardMaterial({ color: 0x333a40, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x454d55, roughness: 0.95 });
    for (const c of ROADS) {
      const ew = new THREE.Mesh(new THREE.PlaneGeometry(396, 11), roadMat);
      ew.rotation.x = -Math.PI / 2; ew.position.set(0, 0.02, c); ew.receiveShadow = true;
      s.add(ew);
      const ns = new THREE.Mesh(new THREE.PlaneGeometry(11, 396), roadMat);
      ns.rotation.x = -Math.PI / 2; ns.position.set(c, 0.02, 0); ns.receiveShadow = true;
      s.add(ns);
    }
    // Centre dashes on every road.
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xd8c95a, roughness: 0.9 });
    for (const c of ROADS) {
      for (let t = -180; t <= 180; t += 12) {
        const d1 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
        d1.rotation.x = -Math.PI / 2; d1.position.set(t, 0.04, c); s.add(d1);
        const d2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
        d2.rotation.x = -Math.PI / 2; d2.position.set(c, 0.04, t); s.add(d2);
      }
    }
    // Beach + sea to the east, with a brighter sand strip and blue water.
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(30, 440), new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(186, 0.03, 0); sand.receiveShadow = true;
    s.add(sand);
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(220, 440), new THREE.MeshStandardMaterial({ color: 0x1e6f8e, roughness: 0.25, metalness: 0.35 }));
    this.sea.rotation.x = -Math.PI / 2; this.sea.position.set(310, 0.01, 0);
    s.add(this.sea);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(3, 440), new THREE.MeshStandardMaterial({ color: 0xeaf6f8, roughness: 0.6 }));
    foam.rotation.x = -Math.PI / 2; foam.position.set(200, 0.05, 0);
    s.add(foam);
    // Ordinary blocks: one building per block, jittered but clamped.
    const landmarkBlocks = [
      { x: 144, z: -144 }, { x: 72, z: 0 }, { x: -144, z: 144 },
      { x: -144, z: 36 }, { x: -144, z: 72 }, { x: 144, z: 144 }, { x: 144, z: -36 },
    ];
    const palette = [0x8a7f74, 0x7d8aa0, 0xa08a7d, 0x6f7f6a, 0x9a8a9a, 0x7a6f5d, 0x5d7a8a];
    for (const bx of BLOCKS) {
      for (const bz of BLOCKS) {
        if (bx === 0 && bz === 0) continue; // central plaza
        if (landmarkBlocks.some((l) => Math.abs(l.x - bx) < 20 && Math.abs(l.z - bz) < 20)) continue;
        const r = hash(bx, bz);
        const w = 12 + r * 6;
        const d = 12 + hash(bz, bx) * 6;
        const h = 8 + hash(bx * 2, bz) * 22;
        const jx = (hash(bx, bz + 7) - 0.5) * 5;
        const jz = (hash(bx + 3, bz) - 0.5) * 5;
        this._building(bx + jx, bz + jz, w, d, h, palette[Math.floor(r * palette.length)]);
        // Windows: a few lit quads on the south face.
        const win = box(w * 0.7, 0.6, 0.2, 0xffe9a8, bx + jx, h * 0.6, bz + jz + d / 2 + 0.1, 0xffe9a8);
        s.add(win);
      }
    }
    // Central plaza: fountain + benches, no building.
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1.4, 20), new THREE.MeshStandardMaterial({ color: 0x7fa8c9, roughness: 0.4 }));
    fountain.position.set(0, 0.7, 0); fountain.castShadow = true;
    s.add(fountain);
    this._collider(0, 0, 7, 7, 'landmark');
    this._landmarks();
    this._palmsAndLamps();
  }
  _landmarks() {
    const s = this.scene;
    // Marina Garage — low wide shed at the north-east marina corner.
    const g = box(22, 7, 16, 0x5d7a8a, 144, 3.5, -144);
    s.add(g); this._collider(144, -144, 11, 8, 'landmark');
    const gSign = neonSign('MARINA GARAGE', 0x33ccff, 18); gSign.position.set(144, 8.5, -135); s.add(gSign);
    this.landmarkMeshes.garage = g;
    // Hotel Solmar — tall tower with a pink neon sign.
    const h = box(20, 42, 18, 0xe8dcc8, 72, 21, 0);
    s.add(h); this._collider(72, 0, 10, 9, 'landmark');
    const hSign = neonSign('HOTEL SOLMAR', 0xff2fb3, 18); hSign.position.set(72, 44, 9.4); s.add(hSign);
    this.landmarkMeshes.hotel = h;
    // Old Lighthouse — striped cylinder on the south-west point.
    const lh = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 30, 16), new THREE.MeshStandardMaterial({ color: 0xf2ede4, roughness: 0.8 }));
    lh.position.set(-144, 15, 144); lh.castShadow = true; s.add(lh);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.6, 4, 16), new THREE.MeshStandardMaterial({ color: 0xd92626, roughness: 0.8 }));
    band.position.set(-144, 20, 144); s.add(band);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0xfff2a8, emissive: 0xffdf5e, emissiveIntensity: 2 }));
    lamp.position.set(-144, 31.5, 144); s.add(lamp);
    this._collider(-144, 144, 6, 6, 'landmark');
    this.landmarkMeshes.lighthouse = lh;
    // Spray Shop — small purple shop.
    const sp = box(14, 6, 12, 0x7c3aed, -144, 3, 36);
    s.add(sp); this._collider(-144, 36, 7, 6, 'landmark');
    const spSign = neonSign('SPRAY SHOP', 0xb366ff, 12); spSign.position.set(-144, 7.5, 42.4); s.add(spSign);
    this.landmarkMeshes.spray = sp;
    // Safehouse — small teal house.
    const sh = box(13, 5.5, 11, 0x14b8a6, -144, 2.75, 72);
    s.add(sh); this._collider(-144, 72, 6.5, 5.5, 'landmark');
    this.landmarkMeshes.safehouse = sh;
    // The Pier — wooden deck running east into the sea at z=126.
    for (let x = 164; x <= 208; x += 6) {
      const plank = box(6, 0.8, 10, 0x8a6f4d, x, 0.9, 126);
      s.add(plank);
    }
    this._collider(186, 126, 12, 5, 'landmark');
    this.landmarkMeshes.pier = s.children[s.children.length - 1];
    // NEW R16 — Casino Solmar: gold-and-purple hall with a big neon sign
    // and a lit entrance canopy. The M5 limo parks on the road outside.
    const c = box(24, 15, 18, 0x6b21a8, 144, 7.5, -36);
    s.add(c); this._collider(144, -36, 12, 9, 'landmark');
    const cSign = neonSign('CASINO SOLMAR', 0xffd24a, 22); cSign.position.set(144, 17, -26.6); s.add(cSign);
    const canopy = box(12, 1, 6, 0xffd24a, 138, 5, -26); s.add(canopy);
    for (let i = 0; i < 4; i++) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: i % 2 ? 0xff2fb3 : 0xffd24a, emissiveIntensity: 2.5 }));
      bulb.position.set(134 + i * 3, 6.2, -25.5); s.add(bulb);
    }
    this.landmarkMeshes.casino = c;
    // NEW R16 — Solmar Boardwalk: plank deck along the beach by the Pier.
    for (let z = 96; z <= 156; z += 6) {
      const plank = box(8, 0.7, 6, 0x9a7b52, 168, 0.8, z);
      s.add(plank);
    }
    const bwSign = neonSign('BOARDWALK', 0x33e0ff, 14); bwSign.position.set(166, 5, 126); s.add(bwSign);
    // No collider here: the deck is flat ground-level planks cars drive over.
    // (A collider here formed a 2u trap pocket with the Pier collider at
    // (174,119) and wedged cars permanently — R16 playtest failure.)
    this.landmarkMeshes.boardwalk = bwSign;
    void LANDMARKS;
  }
  _palmsAndLamps() {
    const s = this.scene;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2fa06b, roughness: 0.9 });
    const palmSpots = [];
    for (let z = -162; z <= 162; z += 36) palmSpots.push([172, z]);
    for (let x = -144; x <= 144; x += 72) palmSpots.push([x, 168]);
    for (const [x, z] of palmSpots) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 8), trunkMat);
      trunk.position.set(x, 4.5, z); trunk.castShadow = true; s.add(trunk);
      const top = new THREE.Mesh(new THREE.ConeGeometry(3.4, 3.2, 8), leafMat);
      top.position.set(x, 10, z); s.add(top);
      this.palms.push(trunk);
    }
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.6, metalness: 0.4 });
    for (const c of ROADS) {
      for (let t = -144; t <= 144; t += 72) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 7, 6), lampMat);
        pole.position.set(t + 6, 3.5, c + 6); s.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff2a8, emissive: 0xffe27a, emissiveIntensity: 1.6 }));
        bulb.position.set(t + 6, 7.2, c + 6); s.add(bulb);
      }
    }
  }
  animate(dt, t) {
    if (this.sea) this.sea.position.y = 0.01 + Math.sin(t * 0.7) * 0.15;
  }
}
