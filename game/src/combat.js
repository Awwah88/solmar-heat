// Combat for Solmar Heat: health, punching on foot, and the pistol (earned
// after Mission 2). Hitscan shooting with a short cooldown.

import { TUNING } from './config.js';

export class Combat {
  constructor(hooks) {
    this.hooks = hooks; // {onPlayerDown, toast, sound, addWanted}
    this.health = TUNING.maxHealth;
    this.hasPistol = false;
    this.punchCd = 0;
    this.shotCd = 0;
    this._downFired = false;
  }

  get alive() {
    return this.health > 0;
  }

  heal(n) {
    this.health = Math.min(TUNING.maxHealth, this.health + n);
  }

  hurt(n, source) {
    if (!this.alive) return;
    this.health -= n;
    if (this.health <= 0) {
      this.health = 0;
      if (!this._downFired) {
        this._downFired = true;
        this.hooks.onPlayerDown(source);
      }
    }
  }

  reset() {
    this.health = TUNING.maxHealth;
    this._downFired = false;
  }

  // Punch the nearest pedestrian or police car right in front of the player.
  punch(px, pz, heading, peds, policeCars) {
    if (this.punchCd > 0) return false;
    this.punchCd = 0.45;
    this.hooks.sound('punch');
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    let hit = false;
    for (const w of peds.walkers) {
      if (w.taxi) continue;
      const dx = w.group.position.x - px;
      const dz = w.group.position.z - pz;
      const d = Math.hypot(dx, dz);
      if (d < TUNING.punchRange && (dx * fx + dz * fz) > 0) {
        peds.fleeFrom(w.group.position.x, w.group.position.z, 2);
        w.group.position.x += fx * 1.5;
        w.group.position.z += fz * 1.5;
        this.hooks.addWanted(1);
        hit = true;
        break;
      }
    }
    return hit;
  }

  // Hitscan pistol shot along the camera forward direction.
  shoot(origin, dir, peds, policeCars) {
    if (!this.hasPistol || this.shotCd > 0) return false;
    this.shotCd = 0.35;
    this.hooks.sound('shot');
    this.hooks.addWanted(2);
    let best = null;
    let bestD = TUNING.shootRange;
    const targets = [];
    for (const w of peds.walkers) {
      if (!w.taxi) targets.push({ x: w.group.position.x, z: w.group.position.z, kind: 'ped', ref: w });
    }
    for (const c of policeCars) {
      targets.push({ x: c.group.position.x, z: c.group.position.z, kind: 'police', ref: c });
    }
    for (const t of targets) {
      const dx = t.x - origin.x;
      const dz = t.z - origin.z;
      const along = dx * dir.x + dz * dir.z;
      if (along < 2 || along > bestD) continue;
      const side = Math.abs(-dx * dir.z + dz * dir.x);
      if (side < 2.2) {
        bestD = along;
        best = t;
      }
    }
    if (best) {
      if (best.kind === 'ped') {
        peds.fleeFrom(best.x, best.z, 2);
        best.ref.state = 'flee';
        best.ref.fleeT = 4;
      } else {
        best.ref.speed = Math.max(0, best.ref.speed - 6);
        best.ref.group.position.x += dir.x * 1.5;
        best.ref.group.position.z += dir.z * 1.5;
      }
      return true;
    }
    return false;
  }

  update(dt) {
    this.punchCd = Math.max(0, this.punchCd - dt);
    this.shotCd = Math.max(0, this.shotCd - dt);
  }
}
