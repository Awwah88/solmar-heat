// Solmar Heat — city, landmarks and colliders (Round 17).
// A 9x9-block coastal city on a 36u grid: roads at ROADS, block centres at
// BLOCKS. Every building collider is clamped to <=10u half-extent from its
// block centre, so every road keeps a clear centre slot for cars.
// Landmark colliders are small boxes offset into their block, never covering
// the gameplay marker on the road.
import * as THREE from 'three';
import { ROADS, BLOCKS, CITY_HALF, LANDMARKS, COLORS, mulberry32, clamp } from './config.js';

function makeSign(text, w, h, fg, bg) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg;
  g.font = 'bold 34px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return mesh;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.landmarks = {};
    this.neon = [];
    this.lighthouseBeam = null;
    this.sea = null;
    this._rng = mulberry32(20261117);
    this._buildGround();
    this._buildRoads();
    this._buildBlocks();
    this._buildLandmarks();
    this._buildBeach();
    this._buildAirport();
    this._buildLamps();
    this._buildPalms();
  }

  _box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05 }),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  _addCollider(kind, cx, cz, hx, hz) {
    const c = { kind, xmin: cx - hx, xmax: cx + hx, zmin: cz - hz, zmax: cz + hz };
    this.colliders.push(c);
    return c;
  }

  _buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_HALF * 2 + 240, CITY_HALF * 2 + 240),
      new THREE.MeshStandardMaterial({ color: COLORS.sidewalk, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _buildRoads() {
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.asphalt, roughness: 0.95 });
    const lineMat = new THREE.MeshBasicMaterial({ color: COLORS.roadLine });
    for (const r of ROADS) {
      const ew = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, 12), mat);
      ew.rotation.x = -Math.PI / 2;
      ew.position.set(0, 0.02, r);
      ew.receiveShadow = true;
      this.scene.add(ew);
      const ns = new THREE.Mesh(new THREE.PlaneGeometry(12, CITY_HALF * 2), mat);
      ns.rotation.x = -Math.PI / 2;
      ns.position.set(r, 0.02, 0);
      ns.receiveShadow = true;
      this.scene.add(ns);
      // Dashed centre lines.
      for (let d = -CITY_HALF + 9; d < CITY_HALF; d += 18) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.5), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(d, 0.04, r);
        this.scene.add(dash);
        const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 6), lineMat);
        dash2.rotation.x = -Math.PI / 2;
        dash2.position.set(r, 0.04, d);
        this.scene.add(dash2);
      }
    }
  }

  _buildBlocks() {
    const palette = [COLORS.buildingA, COLORS.buildingB, COLORS.buildingC, COLORS.buildingD];
    const landmarkBlocks = new Set(
      Object.values(LANDMARKS).map((l) => `${l.block.x},${l.block.z}`),
    );
    for (const bx of BLOCKS) {
      for (const bz of BLOCKS) {
        if (landmarkBlocks.has(`${bx},${bz}`)) continue;
        const r = this._rng;
        const n = r() < 0.45 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const w = 8 + r() * 10; // <= 18 wide: half-extent <= 9 < 10
          const d = 8 + r() * 10;
          const h = 6 + r() * 16;
          const ox = n === 2 ? (i === 0 ? -5 : 5) : 0;
          const oz = n === 2 ? (i === 0 ? -5 : 5) : 0;
          const cx = clamp(bx + ox, bx - 10 + w / 2, bx + 10 - w / 2);
          const cz = clamp(bz + oz, bz - 10 + d / 2, bz + 10 - d / 2);
          const color = palette[Math.floor(r() * palette.length)];
          this._box(w, h, d, color, cx, h / 2, cz);
          // Roof trim.
          this._box(w + 0.6, 0.5, d + 0.6, 0x3a3f47, cx, h + 0.25, cz);
          // Lit windows: a few emissive quads on the faces.
          const winMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
          const wins = 2 + Math.floor(r() * 3);
          for (let k = 0; k < wins; k++) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), winMat);
            win.position.set(cx - w / 2 + 1.5 + r() * (w - 3), 3 + r() * (h - 5), cz + d / 2 + 0.06);
            this.scene.add(win);
          }
          this._addCollider('building', cx, cz, w / 2, d / 2);
        }
      }
    }
  }

  _buildLandmarks() {
    const L = LANDMARKS;
    // Marina Garage — open-front hall on its block, marker on the road.
    this._box(18, 8, 14, 0x5a6b7d, L.garage.block.x, 4, L.garage.block.z);
    const gSign = makeSign('MARINA GARAGE', 12, 3, '#dff3ff', '#243447');
    gSign.position.set(L.garage.block.x, 8.6, L.garage.block.z + 7.2);
    this.scene.add(gSign);
    this._addCollider('landmark', L.garage.block.x, L.garage.block.z, 9, 7);
    this.landmarks.garage = { x: L.garage.marker.x, z: L.garage.marker.z };

    // Hotel Solmar — tall tower with a cyan neon sign.
    this._box(16, 26, 14, 0xc7b299, L.hotel.block.x, 13, L.hotel.block.z);
    const hSign = makeSign('HOTEL SOLMAR', 12, 3, '#19e3ff', '#10202e');
    hSign.position.set(L.hotel.block.x, 27, L.hotel.block.z + 7.2);
    this.scene.add(hSign);
    this.neon.push(hSign);
    this._addCollider('landmark', L.hotel.block.x, L.hotel.block.z, 8, 7);
    this.landmarks.hotel = { x: L.hotel.marker.x, z: L.hotel.marker.z };

    // Old Lighthouse — striped tower on the west cliff block, rotating beam.
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 4.5, 24, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.85 }),
    );
    tower.position.set(L.lighthouse.block.x, 12, L.lighthouse.block.z);
    tower.castShadow = true;
    this.scene.add(tower);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(2, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
    );
    lamp.position.set(L.lighthouse.block.x, 25, L.lighthouse.block.z);
    this.scene.add(lamp);
    const beamPivot = new THREE.Group();
    beamPivot.position.set(L.lighthouse.block.x, 25, L.lighthouse.block.z);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(3, 30, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.rotation.z = -Math.PI / 2;
    beam.position.x = 15;
    beamPivot.add(beam);
    this.scene.add(beamPivot);
    this.lighthouseBeam = beamPivot;
    this._addCollider('landmark', L.lighthouse.block.x, L.lighthouse.block.z, 5, 5);
    this.landmarks.lighthouse = { x: L.lighthouse.marker.x, z: L.lighthouse.marker.z };

    // Spray Shop — low shop with a pink neon sign.
    this._box(12, 6, 10, 0x7e93a8, L.spray.block.x, 3, L.spray.block.z);
    const sSign = makeSign('SPRAY SHOP', 10, 2.5, '#ff2e88', '#1c0f1e');
    sSign.position.set(L.spray.block.x, 6.6, L.spray.block.z + 5.2);
    this.scene.add(sSign);
    this.neon.push(sSign);
    this._addCollider('landmark', L.spray.block.x, L.spray.block.z, 6, 5);
    this.landmarks.spray = { x: L.spray.marker.x, z: L.spray.marker.z };

    // Safehouse — small house with a warm porch light.
    this._box(10, 6, 9, 0xb98a5e, L.safehouse.block.x, 3, L.safehouse.block.z);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(7.5, 4, 4),
      new THREE.MeshStandardMaterial({ color: 0x6e3b2e, roughness: 0.95 }),
    );
    roof.position.set(L.safehouse.block.x, 8, L.safehouse.block.z);
    roof.rotation.y = Math.PI / 4;
    this.scene.add(roof);
    this._addCollider('landmark', L.safehouse.block.x, L.safehouse.block.z, 5, 4.5);
    this.landmarks.safehouse = { x: L.safehouse.marker.x, z: L.safehouse.marker.z };

    // The Pier — wooden deck reaching east into the sea.
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 9), deckMat);
      plank.position.set(164 + i * 5, 1.2, L.pier.marker.z);
      plank.receiveShadow = true;
      this.scene.add(plank);
    }
    this._addCollider('landmark', 176, L.pier.marker.z, 6, 4);
    this.landmarks.pier = { x: L.pier.marker.x, z: L.pier.marker.z };

    // Casino Solmar — wide hall, pink + gold neon, awning.
    this._box(20, 10, 16, 0x3d2b52, L.casino.block.x, 5, L.casino.block.z);
    const cSign = makeSign('CASINO SOLMAR', 14, 3.5, '#ff2e88', '#1c0f1e');
    cSign.position.set(L.casino.block.x, 11, L.casino.block.z + 8.2);
    this.scene.add(cSign);
    this.neon.push(cSign);
    const awn = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.6, 4),
      new THREE.MeshStandardMaterial({ color: COLORS.neonGold, roughness: 0.7 }),
    );
    awn.position.set(L.casino.block.x, 4.4, L.casino.block.z + 9.5);
    this.scene.add(awn);
    this._addCollider('landmark', L.casino.block.x, L.casino.block.z, 10, 8);
    this.landmarks.casino = { x: L.casino.marker.x, z: L.casino.marker.z };

    // Solmar Boardwalk — deck strip beside the Pier.
    const bwMat = new THREE.MeshStandardMaterial({ color: 0x9a7a50, roughness: 1 });
    const bw = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 8), bwMat);
    bw.position.set(140, 0.6, L.boardwalk.marker.z + 6);
    bw.receiveShadow = true;
    this.scene.add(bw);
    this._addCollider('landmark', 140, L.boardwalk.marker.z + 6, 12, 4);
    this.landmarks.boardwalk = { x: L.boardwalk.marker.x, z: L.boardwalk.marker.z };

    // Solmar Bank — stone hall with columns and a gold BANK sign.
    this._box(18, 12, 14, 0x9a938a, L.bank.block.x, 6, L.bank.block.z);
    for (let i = -1; i <= 1; i++) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.8 }),
      );
      col.position.set(L.bank.block.x + i * 6, 5, L.bank.block.z - 7.5);
      this.scene.add(col);
    }
    const bSign = makeSign('SOLMAR BANK', 12, 3, '#ffc233', '#241d08');
    bSign.position.set(L.bank.block.x, 13, L.bank.block.z - 7.2);
    bSign.rotation.y = Math.PI;
    this.scene.add(bSign);
    this.neon.push(bSign);
    this._addCollider('landmark', L.bank.block.x, L.bank.block.z, 9, 7);
    this.landmarks.bank = { x: L.bank.marker.x, z: L.bank.marker.z };

    // Solmar Airport — terminal block (runway itself is built in _buildAirport).
    this._box(16, 9, 12, 0x6f7f92, L.airport.block.x, 4.5, L.airport.block.z);
    const aSign = makeSign('AIRPORT', 10, 2.5, '#dff3ff', '#1a2a3a');
    aSign.position.set(L.airport.block.x, 10, L.airport.block.z + 6.2);
    this.scene.add(aSign);
    const tower2 = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2.6, 16, 10),
      new THREE.MeshStandardMaterial({ color: 0x8d8578, roughness: 0.85 }),
    );
    tower2.position.set(L.airport.block.x + 12, 8, L.airport.block.z - 4);
    this.scene.add(tower2);
    this._addCollider('landmark', L.airport.block.x, L.airport.block.z, 8, 6);
    this.landmarks.airport = { x: L.airport.marker.x, z: L.airport.marker.z };
  }

  _buildBeach() {
    // Sand strip + sea on the east edge, past the last road.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(22, CITY_HALF * 2 + 60),
      new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 1 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(173, 0.03, 0);
    sand.receiveShadow = true;
    this.scene.add(sand);
    this.sea = new THREE.Mesh(
      new THREE.PlaneGeometry(220, CITY_HALF * 2 + 120),
      new THREE.MeshStandardMaterial({ color: COLORS.sea, roughness: 0.25, metalness: 0.35 }),
    );
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.position.set(294, 0.01, 0);
    this.scene.add(this.sea);
  }

  _buildAirport() {
    // Runway strip along the north edge with dashes and edge lights.
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 22),
      new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.95 }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.03, -169);
    strip.receiveShadow = true;
    this.scene.add(strip);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
    for (let x = -140; x <= 140; x += 28) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.2), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.05, -169);
      this.scene.add(dash);
    }
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x7dff9a });
    for (let x = -150; x <= 150; x += 30) {
      for (const z of [-179, -159]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 1), lightMat);
        l.position.set(x, 0.3, z);
        this.scene.add(l);
      }
    }
  }

  _buildLamps() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e3238, roughness: 0.7, metalness: 0.4 });
    const glowMat = new THREE.MeshBasicMaterial({ color: COLORS.lampGlow });
    for (const r of ROADS) {
      for (let d = -144; d <= 144; d += 72) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
        pole.position.set(r + 7, 3.5, d);
        this.scene.add(pole);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), glowMat);
        head.position.set(r + 7, 7.2, d);
        this.scene.add(head);
        const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
        pole2.position.set(d, 3.5, r + 7);
        this.scene.add(pole2);
        const head2 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), glowMat);
        head2.position.set(d, 7.2, r + 7);
        this.scene.add(head2);
      }
    }
  }

  _buildPalms() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e5233, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3d, roughness: 0.9 });
    const r = this._rng;
    const spots = [];
    for (let z = -160; z <= 160; z += 24) spots.push([166, z]);
    for (let i = 0; i < 14; i++) {
      spots.push([BLOCKS[Math.floor(r() * 9)] + (r() < 0.5 ? -13 : 13), BLOCKS[Math.floor(r() * 9)] + (r() < 0.5 ? -13 : 13)]);
    }
    for (const [x, z] of spots) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 6, 6), trunkMat);
      trunk.position.set(x, 3, z);
      trunk.rotation.z = (r() - 0.5) * 0.2;
      this.scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.4, 7), leafMat);
      crown.position.set(x, 7, z);
      this.scene.add(crown);
    }
  }

  update(dt, time) {
    // Neon signs gently pulse; the lighthouse beam sweeps; the sea shimmers.
    const pulse = 0.85 + 0.15 * Math.sin(time * 2.2);
    for (const s of this.neon) s.material.opacity = 1;
    if (this.neon.length) this.neon[0].material.opacity = pulse;
    if (this.lighthouseBeam) {
      this.lighthouseBeam.rotation.y = time * 0.5;
    }
    if (this.sea) {
      this.sea.position.y = 0.01 + Math.sin(time * 0.8) * 0.05;
    }
  }
}
