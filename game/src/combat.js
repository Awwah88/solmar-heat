// Solmar Heat — combat and health. On foot, Space (or click) punches the
// nearest pedestrian or officer in reach; after Mission 2 Dana carries a
// pistol, and F fires it at the nearest target ahead within range.
// Hurting a bystander raises the wanted level. Health regens slowly when
// the heat is off, and hitting zero triggers the down/respawn flow in
// world.js. M5's chase tuning lives here too: police rams hurt less while
// the limo run is live, so the finale stays tense but survivable.
import { TUNING } from './config.js';

export class Combat {
  constructor(game) {
    this.game = game;
    this.hasPistol = false;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
  }
  update(dt) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    // Slow regen while nobody is chasing.
    if (this.game.police.wanted === 0 && this.game.health < 100 && this.game.state === 'playing') {
      this.game.health = Math.min(100, this.game.health + 1.5 * dt);
    }
    const input = this.game.input;
    if (this.game.state !== 'playing' || this.game.player.car) return;
    if (input.punch && this.punchCooldown <= 0) this.punch();
    if (input.shoot && this.shootCooldown <= 0) this.shoot();
  }
  punch() {
    this.punchCooldown = 0.45;
    const p = this.game.playerPos();
    const target = this.game.pedestrians.nearest(p.x, p.z, 2.6);
    this.game.audio.punch();
    if (target) {
      target.knockDown();
      this.game.police.addWanted(1);
      this.game.hud.toast('You decked a bystander — wanted up!');
    }
  }
  shoot() {
    if (!this.hasPistol) {
      this.game.hud.toast('No pistol yet — finish Mission 2.');
      return;
    }
    this.shootCooldown = 0.5;
    this.game.audio.shoot();
    const p = this.game.playerPos();
    const heading = this.game.player.heading;
    let best = null;
    let bd = TUNING.pistolRange;
    for (const ped of this.game.pedestrians.list) {
      if (ped.down > 0) continue;
      const dx = ped.group.position.x - p.x;
      const dz = ped.group.position.z - p.z;
      const d = Math.hypot(dx, dz);
      const ahead = dx * Math.sin(heading) + dz * Math.cos(heading);
      if (d < bd && ahead > 0) { bd = d; best = ped; }
    }
    if (best) {
      best.knockDown();
      this.game.police.addWanted(1);
      this.game.hud.toast('Shot fired — wanted up!');
    }
  }
  // Damage multiplier while the M5 limo chase is live (stage 1).
  // R16 fix #2: was 1.5 (rams shredded 100 HP in ~22s — unsurvivable).
  // Now 0.5, and the armored limo halves police damage again in
  // world.js — the 4-star chase stays, but the ~180u Casino→Boardwalk
  // drive is survivable.
  chaseDamageScale() {
    const m = this.game.missions;
    return m.current && m.current.id === 5 && m.stage === 1 ? 0.5 : 1;
  }
}
