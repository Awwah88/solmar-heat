// Solmar Heat — combat: health, punching, pistol (Round 17).
// F punches on foot; after Mission 2 the pistol is unlocked and F fires it
// toward the nearest pedestrian or police car in front of the player.
// Hurting people raises the wanted level; getting hurt can drop the player.
import { dist2d } from './config.js';

export class Combat {
  constructor(game) {
    this.game = game;
    this.hasPistol = false;
    this._shotCooldown = 0;
    this._punchCooldown = 0;
  }

  update(dt) {
    this._shotCooldown = Math.max(0, this._shotCooldown - dt);
    this._punchCooldown = Math.max(0, this._punchCooldown - dt);
    // Slow health regen while calm.
    if (this.game.police.wanted === 0 && this.game.health < 100) {
      this.game.health = Math.min(100, this.game.health + 2.2 * dt);
    }
  }

  tryPunch() {
    if (this._punchCooldown > 0) return;
    this._punchCooldown = 0.45;
    const g = this.game;
    const p = g.playerPos();
    let best = null;
    let bd = 2.6;
    for (const w of g.pedestrians.walkers) {
      const d = dist2d(w.x, w.z, p.x, p.z);
      if (d < bd) {
        bd = d;
        best = w;
      }
    }
    g.audio.punch();
    if (best) {
      g.pedestrians.scare(p.x, p.z, 14);
      best.fleeing = 4;
      g.police.addWanted(1);
      g.hud.toast('You roughed up a pedestrian — the cops noticed!');
    }
  }

  tryShoot() {
    if (!this.hasPistol) {
      this.tryPunch();
      return;
    }
    if (this._shotCooldown > 0) return;
    this._shotCooldown = 0.4;
    const g = this.game;
    const p = g.playerPos();
    const h = g.playerHeading();
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    g.audio.shot();
    g.police.addWanted(1);
    // Nearest target roughly in front of the player.
    let best = null;
    let bd = 34;
    const consider = (x, z) => {
      const dx = x - p.x;
      const dz = z - p.z;
      const d = Math.hypot(dx, dz);
      const ahead = dx * fx + dz * fz;
      if (d < bd && ahead > d * 0.55) {
        bd = d;
        best = { x, z, d };
      }
    };
    for (const w of g.pedestrians.walkers) consider(w.x, w.z);
    for (const pc of g.police.policeCars) consider(pc.x, pc.z);
    if (best) {
      g.pedestrians.scare(best.x, best.z, 10);
      g.hud.toast('Hit! The street scatters.');
    }
  }
}
