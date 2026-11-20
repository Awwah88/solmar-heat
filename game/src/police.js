// Solmar Heat — police and the wanted system (Round 17).
// Wanted 0-5 stars. Police spawn at road points near the player, chase and
// ram; rams damage the player. Wanted decays when the player stays out of
// sight at low stars, and clears at the Spray Shop. At 5 stars (the M6
// escape) the chase is faster, tighter and relentless.
import * as THREE from 'three';
import { ROADS, TUNING, nearestRoad, dist2d, clamp } from './config.js';
import { Car } from './vehicles.js';

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.wanted = 0;
    this.policeCars = [];
    this._decayTimer = 0;
    this._spawnTimer = 0;
    this._ramCooldown = 0;
  }

  setWanted(n) {
    this.wanted = clamp(Math.round(n), 0, 5);
    this._decayTimer = 0;
  }

  addWanted(n) {
    this.setWanted(this.wanted + n);
  }

  clearWanted() {
    this.wanted = 0;
    this._decayTimer = 0;
  }

  _spawnPointNear(px, pz) {
    // A road intersection 25-40u away from the player, on the road grid.
    const cands = [];
    for (const rx of ROADS) {
      for (const rz of ROADS) {
        const d = dist2d(rx, rz, px, pz);
        if (d > 25 && d < 60) cands.push({ x: rx, z: rz, d });
      }
    }
    if (!cands.length) return { x: nearestRoad(px), z: nearestRoad(pz) };
    cands.sort((a, b) => a.d - b.d);
    return cands[Math.floor(Math.random() * Math.min(4, cands.length))];
  }

  _syncFleet(px, pz) {
    const want = this.wanted === 0 ? 0 : Math.min(this.wanted, 5);
    while (this.policeCars.length < want) {
      const p = this._spawnPointNear(px, pz);
      const car = new Car(this.scene, 'police', 0x1c1e26, p.x, p.z, 0);
      car.police = true;
      car.speed = 0;
      this.policeCars.push(car);
    }
    while (this.policeCars.length > want) {
      const car = this.policeCars.pop();
      this.scene.remove(car.group);
    }
  }

  update(dt, game) {
    const px = game.playerPos().x;
    const pz = game.playerPos().z;
    this._syncFleet(px, pz);
    this._ramCooldown = Math.max(0, this._ramCooldown - dt);
    // Wanted decays slowly when the player is not actively committing crimes.
    if (this.wanted > 0 && this.wanted <= 2) {
      this._decayTimer += dt;
      if (this._decayTimer > TUNING.wantedDecaySeconds) {
        this.wanted -= 1;
        this._decayTimer = 0;
        this._syncFleet(px, pz);
      }
    } else {
      this._decayTimer = 0;
    }
    const fiveStar = this.wanted >= 5;
    const maxSpeed = fiveStar ? TUNING.policeMaxSpeed + 3 : TUNING.policeMaxSpeed;
    for (const pc of this.policeCars) {
      const dx = px - pc.x;
      const dz = pz - pc.z;
      const d = Math.hypot(dx, dz);
      const desired = Math.atan2(dx, dz);
      let err = desired - pc.heading;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      const turnRate = fiveStar ? 2.6 : 2.1;
      pc.heading += clamp(err, -turnRate * dt, turnRate * dt);
      const targetSpeed = d > 60 ? maxSpeed : d > 14 ? maxSpeed * 0.85 : maxSpeed * 0.55;
      pc.speed += clamp(targetSpeed - pc.speed, -20 * dt, 14 * dt);
      let nx = pc.x + Math.sin(pc.heading) * pc.speed * dt;
      let nz = pc.z + Math.cos(pc.heading) * pc.speed * dt;
      // Police ignore building colliders on the chase line (they cut corners),
      // but stay inside the city.
      nx = clamp(nx, -176, 176);
      nz = clamp(nz, -176, 176);
      pc.group.position.set(nx, 0, nz);
      pc.syncRotation();
      // Ram: touching the player car damages it and shoves it.
      if (d < 4.4 && this._ramCooldown <= 0) {
        this._ramCooldown = 0.9;
        game.damagePlayer(TUNING.policeRamDamage, 'ram');
        const push = 3.5;
        const ppos = game.playerPos();
        if (game.player.car) {
          game.player.car.group.position.x += (ppos.x - pc.x) / (d || 1) * push * 0.3;
          game.player.car.group.position.z += (ppos.z - pc.z) / (d || 1) * push * 0.3;
        }
      }
    }
    game.audio.siren(this.wanted > 0);
    game.audio.updateSiren(dt, this.wanted);
  }
}
