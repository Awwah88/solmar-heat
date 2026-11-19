// Solmar Heat — hand-to-hand and the pistol.
// The punch is the starting weapon; the pistol unlocks with Mission 2.
// Both are short-range cone attacks in front of the player: a punch
// floors a pedestrian (and draws the law), a shot does the same at
// range and can slow a chasing cop car.

import { dist2 } from './config.js';

export class Combat {
  constructor(game) {
    this.game = game;
    this.hasPistol = false;
    this._punchAt = -10;
    this._shotAt = -10;
  }

  // Targets within a cone in front of the player.
  _inFront(target, px, pz, heading, range, cosHalf) {
    const dx = target.x - px;
    const dz = target.z - pz;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > range || d < 0.01) return false;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    return (dx * fx + dz * fz) / d > cosHalf;
  }

  punch(now, px, pz, heading) {
    if (now - this._punchAt < 0.4) return;
    this._punchAt = now;
    this.game.audio.punch();
    const g = this.game;
    const ped = g.pedestrians.nearest(px, pz, 2.8);
    if (ped && this._inFront(
      { x: ped.group.position.x, z: ped.group.position.z },
      px, pz, heading, 2.8, 0.5,
    )) {
      g.pedestrians.knockDown(ped);
      g.addMoney(8);
      g.police.addWanted(1);
      g.hud.flash('Pedestrian down  +$8  (wanted +1)');
      return;
    }
    // Swinging at a cop car dents it and slows the chase.
    for (const car of g.police.policeCars) {
      if (this._inFront({ x: car.x, z: car.z }, px, pz, heading, 3.2, 0.5)) {
        car.speed *= 0.3;
        g.police.addWanted(1);
        g.hud.flash('You hit a cop car!  (wanted +1)');
        return;
      }
    }
  }

  shoot(now, px, pz, heading) {
    if (!this.hasPistol) return;
    if (now - this._shotAt < 0.35) return;
    this._shotAt = now;
    this.game.audio.shot();
    const g = this.game;
    // Pedestrians first, then police cars.
    const ped = g.pedestrians.nearest(px, pz, 26);
    if (ped && this._inFront(
      { x: ped.group.position.x, z: ped.group.position.z },
      px, pz, heading, 26, 0.94,
    )) {
      g.pedestrians.knockDown(ped);
      g.addMoney(8);
      g.police.addWanted(1);
      g.hud.flash('Target down  +$8  (wanted +1)');
      return;
    }
    let best = null;
    let bestD = 26;
    for (const car of g.police.policeCars) {
      const d = dist2(px, pz, car.x, car.z);
      if (d < bestD && this._inFront({ x: car.x, z: car.z }, px, pz, heading, 26, 0.94)) {
        bestD = d;
        best = car;
      }
    }
    if (best) {
      best.speed *= 0.15;
      best.angle += (Math.random() - 0.5) * 0.6;
      g.police.addWanted(1);
      g.hud.flash('Cop car hit — it swerves!');
    }
  }
}
