// Solmar Heat — the wanted level and the Solmar Bay police.
// Wanted runs 0-5. Stealing a car, hitting someone or firing a gun raises
// it; the Spray Shop clears it for cash, and it fades on its own if the
// player stays clean. Police cars chase and ram, and a cop who catches the
// player on foot holds them until they are busted.

import * as THREE from 'three';
import { TUNING, clamp, wrapAngle, dist2d } from './config.js';
import { Car } from './vehicles.js';

export class PoliceSystem {
  constructor(game) {
    this.game = game;
    this.wanted = 0;
    this.policeCars = [];
    this.decayTimer = 0;
    this.bustTimer = 0;
    this.blink = 0;
  }

  setWanted(n) {
    this.wanted = clamp(Math.floor(n), 0, TUNING.maxWanted);
    this.decayTimer = 0;
    this.game.hud.refresh();
  }

  addWanted(n) {
    this.setWanted(this.wanted + n);
  }

  _spawnPolice() {
    const g = this.game;
    const px = g.player.pos.x;
    const pz = g.player.pos.z;
    const angle = Math.random() * Math.PI * 2;
    const car = new Car(g, {
      kind: 'police',
      name: 'Police',
      color: 0x1a1a1a,
      x: px + Math.sin(angle) * 55,
      z: pz + Math.cos(angle) * 55,
      heading: angle,
    });
    car.ramCooldown = 0;
    g.scene.add(car.mesh);
    g.vehicles.cars.push(car);
    this.policeCars.push(car);
  }

  _removePolice(car) {
    const g = this.game;
    g.scene.remove(car.mesh);
    const i = g.vehicles.cars.indexOf(car);
    if (i >= 0) g.vehicles.cars.splice(i, 1);
    const j = this.policeCars.indexOf(car);
    if (j >= 0) this.policeCars.splice(j, 1);
  }

  update(dt) {
    const g = this.game;
    if (g.state !== 'playing') return;
    // Keep the number of police cars equal to the wanted level.
    while (this.policeCars.length < this.wanted) this._spawnPolice();
    while (this.policeCars.length > this.wanted) this._removePolice(this.policeCars[this.policeCars.length - 1]);
    // Wanted fades when the player stays clean — never below 3 during
    // the final mission, so the Spray Shop stays the way out.
    if (this.wanted > 0 && !(g.missions.index === 2 && !g.missions.done[2])) {
      this.decayTimer += dt;
      if (this.decayTimer >= TUNING.wantedDecaySeconds) {
        this.decayTimer = 0;
        this.setWanted(this.wanted - 1);
      }
    }
    this.blink += dt;
    const playerCar = g.player.car;
    let busting = false;
    for (const car of this.policeCars) {
      car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
      // Chase the player with the same road autopilot the traffic uses.
      const d = g.vehicles.autopilotDrive(car, { x: g.player.pos.x, z: g.player.pos.z }, dt);
      // Flash the light bar.
      const bar = car.mesh.getObjectByName('lightbar');
      if (bar) bar.material.color.setHex(Math.floor(this.blink * 4) % 2 === 0 ? 0xff2d2d : 0x2d6bff);
      if (d < 5) {
        if (playerCar) {
          // Ram: damage with a per-car cooldown, plus a jolt.
          if (car.ramCooldown <= 0) {
            car.ramCooldown = TUNING.policeRamCooldown;
            g.combat.damage(TUNING.policeRamDamage, true);
            playerCar.speed *= 0.7;
            g.audio.punch();
          }
        } else {
          // On foot and caught: hold still and the bust meter fills.
          const slow = Math.abs(g.player.walkSpeedNow || 0) < 1;
          if (slow) busting = true;
        }
      }
    }
    if (busting) {
      this.bustTimer += dt;
      if (this.bustTimer >= TUNING.bustHoldSeconds) {
        this.bustTimer = 0;
        g.busted();
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
    g.audio.setSiren(this.wanted > 0 && g.state === 'playing');
  }

  clearAll() {
    while (this.policeCars.length > 0) this._removePolice(this.policeCars[0]);
    this.bustTimer = 0;
  }
}
