// Solmar Heat — health, fists and the pistol.
// The player has 100 health. Police rams and hard crashes wear it down;
// it grows back slowly once the player has been safe for a while. The
// pistol is earned by finishing Mission 2; before that the fists are all
// there is. Hurting anyone in public raises the wanted level.

import * as THREE from 'three';
import { TUNING } from './config.js';

export class CombatSystem {
  constructor(game) {
    this.game = game;
    this.health = 100;
    this.hasPistol = false;
    this.lastDamageAt = -100;
    this.punchCooldown = 0;
    this.shotCooldown = 0;
  }

  damage(amount, silent = false) {
    if (amount <= 0) return;
    // Staged screenshot scenes never hurt the player.
    if (this.game.shotMode) return;
    if (this.game.state !== 'playing') return;
    this.health -= amount;
    this.lastDamageAt = this.game.elapsed;
    if (!silent) this.game.audio.punch();
    if (this.health <= 0) {
      this.health = 0;
      this.game.wasted();
    }
    this.game.hud.refresh();
  }

  heal(amount) {
    this.health = Math.min(100, this.health + amount);
    this.game.hud.refresh();
  }

  // A swing at whatever is right in front of the player on foot.
  punch() {
    const g = this.game;
    if (g.state !== 'playing' || g.player.car || this.punchCooldown > 0) return;
    this.punchCooldown = 0.45;
    g.audio.punch();
    const from = g.player.pos;
    const target = g.pedestrians.nearestInFront(from, g.player.heading, 2.8);
    if (target) {
      const wentDown = target.hurt(16);
      g.police.addWanted(1);
      g.hud.toast(wentDown ? 'Walker down. The police saw that.' : 'You hit a pedestrian!');
      return;
    }
    // No walker in reach: swing at the air, and at any police car close by.
    for (const car of g.police.policeCars) {
      const dx = car.pos.x - from.x;
      const dz = car.pos.z - from.z;
      if (dx * dx + dz * dz < 9) {
        g.police.addWanted(1);
        g.hud.toast('Leave the police alone!');
        return;
      }
    }
  }

  // A pistol shot: hits the nearest walker or police car in a cone ahead.
  shoot() {
    const g = this.game;
    if (g.state !== 'playing' || g.player.car || !this.hasPistol || this.shotCooldown > 0) return;
    this.shotCooldown = 0.35;
    g.audio.gunshot();
    this._muzzle();
    const from = g.player.pos;
    const walker = g.pedestrians.nearestInFront(from, g.player.heading, 34);
    if (walker) {
      const wentDown = walker.hurt(34);
      g.police.addWanted(1);
      g.hud.toast(wentDown ? 'Walker down.' : 'Hit!');
      return;
    }
    let best = null;
    let bestD = 34;
    for (const car of g.police.policeCars) {
      const dx = car.pos.x - from.x;
      const dz = car.pos.z - from.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (best) {
      best.speed *= 0.4;
      g.police.addWanted(1);
      g.hud.toast('You shot a police car!');
    }
  }

  _muzzle() {
    const g = this.game;
    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe14d }),
    );
    const f = { x: Math.sin(g.player.heading), z: Math.cos(g.player.heading) };
    flash.position.set(g.player.pos.x + f.x * 1.2, 1.3, g.player.pos.z + f.z * 1.2);
    g.scene.add(flash);
    window.setTimeout(() => g.scene.remove(flash), 70);
  }

  update(dt) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    // Slow regen once the player has been safe for a while.
    const g = this.game;
    if (g.state === 'playing' && this.health > 0 && this.health < 100) {
      if (g.elapsed - this.lastDamageAt > TUNING.healthRegenDelay) {
        this.heal(TUNING.healthRegenRate * dt);
      }
    }
  }
}
