// Health, punching and the pistol. Shooting is a short cone check against
// the nearest pedestrian or police car; every shot raises the heat.
// Damage goes through hurt() so the wasted state fires exactly once.
export class Combat {
  constructor(game) {
    this.game = game;
    this.health = 100;
    this.pistol = false;
    this._punchCooldown = 0;
    this._shotCooldown = 0;
    this._wasted = false;
  }

  get alive() {
    return this.health > 0 && !this._wasted;
  }

  unlockPistol() {
    this.pistol = true;
    this.game.toast("Pistol unlocked — click to shoot");
  }

  hurt(n) {
    if (this._wasted) return;
    this.health = Math.max(0, this.health - n);
    if (this.health <= 0) {
      this._wasted = true;
      this.game.onWasted();
    }
  }

  heal(n) {
    this.health = Math.min(100, this.health + n);
    if (this.health > 0) this._wasted = false;
  }

  reset() {
    this.health = 100;
    this.pistol = false;
    this._wasted = false;
    this._punchCooldown = 0;
    this._shotCooldown = 0;
  }

  update(dt) {
    this._punchCooldown = Math.max(0, this._punchCooldown - dt);
    this._shotCooldown = Math.max(0, this._shotCooldown - dt);
  }

  punch(px, pz, heading) {
    if (this._punchCooldown > 0) return;
    this._punchCooldown = 0.45;
    this.game.audio.punch();
    const reach = 2.4;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const { walker, dist } = this.game.pedestrians.nearest(px + fx * 1.2, pz + fz * 1.2, reach);
    if (walker && dist < reach) {
      this.game.pedestrians.knockback(walker, px, pz, 7);
      this.game.toast("You shoved a pedestrian — careful, the cops noticed");
      this.game.addWanted(1);
      return;
    }
    const near = this.game.nearestPolice(px, pz, 3.2);
    if (near) {
      this.game.toast("You swung at a cop — bad idea");
      this.game.addWanted(1);
    }
  }

  shoot(px, pz, heading) {
    if (!this.pistol || this._shotCooldown > 0) return;
    this._shotCooldown = 0.35;
    this.game.audio.shot();
    this.game.showTracer(px, pz, heading);
    this.game.addWanted(1);
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    let best = null;
    let bestD = 48;
    let bestKind = null;
    for (const w of this.game.pedestrians.walkers) {
      const dx = w.x - px;
      const dz = w.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const dot = (dx * fx + dz * fz) / Math.max(d, 0.001);
      if (dot > 0.93) {
        best = w;
        bestD = d;
        bestKind = "ped";
      }
    }
    for (const car of this.game.police.policeCars) {
      const dx = car.x - px;
      const dz = car.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const dot = (dx * fx + dz * fz) / Math.max(d, 0.001);
      if (dot > 0.93) {
        best = car;
        bestD = d;
        bestKind = "cop";
      }
    }
    if (best && bestKind === "ped") {
      this.game.pedestrians.knockback(best, px, pz, 9);
      this.game.toast("You shot a pedestrian — the heat is on");
    } else if (best && bestKind === "cop") {
      this.game.damagePoliceCar(best);
      this.game.toast("You hit a police cruiser");
    }
  }
}
