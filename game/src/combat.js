// Solmar Heat — combat.js
// Health, fists and the pistol. On foot the player can punch the nearest
// pedestrian and, once Mission 2 hands it over, shoot. Health drops from
// police rams and falls; at zero the player is wasted and wakes up at
// the Safehouse poorer but alive.

import { CONFIG, distance2D } from './config.js';

export class Combat {
  constructor(game) {
    this.game = game;
    this.health = CONFIG.START_HEALTH;
    this.hasPistol = false;
    this.ammo = 0;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.flashTimer = 0; // red vignette timer after taking damage
  }

  damage(amount, source) {
    if (this.game.state !== 'playing') return;
    this.health = Math.max(0, this.health - amount);
    this.flashTimer = 0.6;
    if (this.health <= 0) this.game.wasted();
    void source;
  }

  heal(amount) {
    this.health = Math.min(CONFIG.START_HEALTH, this.health + amount);
  }

  givePistol() {
    this.hasPistol = true;
    this.ammo = 48;
  }

  update(dt) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.flashTimer = Math.max(0, this.flashTimer - dt);
  }

  // A short-range punch at the nearest person in front of the player.
  punch(playerPos, heading) {
    if (this.punchCooldown > 0) return false;
    this.punchCooldown = 0.45;
    const reach = 2.6;
    const fx = playerPos.x + Math.sin(heading) * 1.4;
    const fz = playerPos.z + Math.cos(heading) * 1.4;
    const victim = this.game.pedestrians.nearest(fx, fz, reach);
    if (victim) {
      victim.knockDown();
      this.game.audio.punch();
      this.game.score += 5;
      this.game.police.addWanted(1);
      return true;
    }
    // Whiff: still make the sound so the punch feels real.
    this.game.audio.punch();
    return false;
  }

  // Fire the pistol at the nearest target in front of the player —
  // a pedestrian, or a police car. Loud, so it draws the heat.
  shoot(playerPos, heading) {
    if (!this.hasPistol || this.ammo <= 0 || this.shootCooldown > 0) return false;
    this.shootCooldown = 0.35;
    this.ammo -= 1;
    this.game.audio.gunshot();
    this.game.police.addWanted(CONFIG.SHOOT_WANTED);
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    let best = null;
    let bestAlong = 40;
    for (const person of this.game.pedestrians.people) {
      if (person.state === 'down') continue;
      const dx = person.pos.x - playerPos.x;
      const dz = person.pos.z - playerPos.z;
      const along = dx * fx + dz * fz;
      const across = Math.abs(dx * fz - dz * fx);
      if (along > 1 && along < bestAlong && across < 2.5) {
        bestAlong = along;
        best = person;
      }
    }
    if (best) {
      best.knockDown();
      this.game.score += 10;
      return true;
    }
    // No pedestrian in the cone: try a police car instead.
    for (const car of this.game.police.policeCars) {
      const dx = car.pos.x - playerPos.x;
      const dz = car.pos.z - playerPos.z;
      const along = dx * fx + dz * fz;
      const across = Math.abs(dx * fz - dz * fx);
      if (along > 1 && along < 38 && across < 3) {
        car.speed *= 0.4;
        this.game.score += 15;
        return true;
      }
    }
    return true;
  }

  // A tracer line the world draws for a split second after a shot.
  tracerFrom(playerPos, heading) {
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    return {
      x1: playerPos.x + fx * 1.2,
      z1: playerPos.z + fz * 1.2,
      x2: playerPos.x + fx * 34,
      z2: playerPos.z + fz * 34,
    };
  }

  get alive() {
    return this.health > 0;
  }
}
