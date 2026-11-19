// Solmar Heat — missions and the taxi side job.
// Four story missions (Hot Wheels, Sunset Courier, The Heat,
// Marlin's Debt) plus fares for anyone driving a cab. Rewards are
// paid exactly once, in completeMission / payPackage; setDone only
// re-syncs the reward counter from the completed list, so saving
// and loading can never pay a mission twice.

import { MISSIONS, MARKERS, PRICES, ROADS, dist2 } from './config.js';
import { Car } from './vehicles.js';

const PACKAGE_STOPS = [MARKERS.hotel, MARKERS.pier, MARKERS.safehouse];
export { PACKAGE_STOPS };

export class Missions {
  constructor(game) {
    this.game = game;
    this.missionIndex = 0;
    this.done = [];
    this.current = null;
    this.marker = null;
    this.goldCar = null;
    this.shellsTaken = 0;
    this.packageIndex = 0;
    this.timer = 0;
    this.rewardTotal = 0;
    this.m4Stage = 'steal'; // steal -> lighthouse -> escape
    this.taxi = { active: false, phase: '', pickup: null, dest: null, cooldown: 0 };
    this.taxiMarker = null;
  }

  // The only way to set the completed list: it re-syncs the reward
  // counter from the list, so a save-load round trip stays exact.
  setDone(list) {
    this.done = [...list];
    let total = 0;
    for (const id of this.done) {
      const def = MISSIONS.find((m) => m.id === id);
      if (def) total += def.reward;
    }
    total += this.shellsTaken * (MISSIONS[1].packageReward || 50);
    this.rewardTotal = total;
  }

  reset() {
    this.missionIndex = 0;
    this.shellsTaken = 0;
    this.packageIndex = 0;
    this.timer = 0;
    this.m4Stage = 'steal';
    this.taxi = { active: false, phase: '', pickup: null, dest: null, cooldown: 0 };
    this.taxiMarker = null;
    this.setDone([]);
    this._clearGoldCar();
    this.startMission(0);
  }

  _clearGoldCar() {
    if (this.goldCar) {
      this.goldCar.remove();
      this.goldCar = null;
    }
  }

  startMission(i) {
    this.missionIndex = i;
    const def = MISSIONS[i];
    if (!def) {
      this.current = null;
      this.marker = null;
      return;
    }
    this.current = { id: def.id, title: def.title, objective: def.objective };
    if (def.id === 'm1') {
      this.marker = { x: MARKERS.garage.x, z: MARKERS.garage.z };
    } else if (def.id === 'm2') {
      this.packageIndex = 0;
      this.shellsTaken = 0;
      this.timer = def.timeLimit;
      this.marker = { x: PACKAGE_STOPS[0].x, z: PACKAGE_STOPS[0].z };
    } else if (def.id === 'm3') {
      this.game.police.setWanted(3);
      this.marker = { x: MARKERS.spray.x, z: MARKERS.spray.z };
    } else if (def.id === 'm4') {
      this.m4Stage = 'steal';
      this._clearGoldCar();
      this.goldCar = new Car(this.game.scene, {
        x: MARKERS.goldCar.x, z: MARKERS.goldCar.z,
        heading: Math.PI / 2, color: 0xe9c46a, gold: true,
      });
      this.game.parkedCars.push(this.goldCar);
      this.marker = { x: MARKERS.goldCar.x, z: MARKERS.goldCar.z };
    }
    this.game.hud.setMission(def.title);
    this.game.hud.setObjective(def.objective);
  }

  // Pay the current mission's reward once and move on.
  completeMission() {
    const def = MISSIONS[this.missionIndex];
    if (!def) return;
    this.game.addMoney(def.reward);
    this.setDone([...this.done, def.id]);
    this.game.audio.mission();
    this.game.hud.flash(`Mission complete: ${def.title}  +$${def.reward}`);
    this.game.saveSoon();
    const next = this.missionIndex + 1;
    if (next >= MISSIONS.length) {
      this.missionIndex = next;
      this.current = null;
      this.marker = null;
      this.game.winGame();
    } else {
      this.startMission(next);
    }
  }

  payPackage() {
    this.shellsTaken++;
    this.game.addMoney(MISSIONS[1].packageReward);
    this.game.audio.pickup();
    this.game.hud.flash(`Package delivered  +$${MISSIONS[1].packageReward}`);
    if (this.shellsTaken >= 3) {
      this.completeMission();
    } else {
      this.packageIndex = this.shellsTaken;
      const stop = PACKAGE_STOPS[this.packageIndex];
      this.marker = { x: stop.x, z: stop.z };
    }
  }

  _randomRoadPoint(minD, playerPos) {
    for (let tries = 0; tries < 20; tries++) {
      const x = ROADS[Math.floor(Math.random() * ROADS.length)];
      const z = ROADS[Math.floor(Math.random() * ROADS.length)];
      if (dist2(x, z, playerPos.x, playerPos.z) >= minD) return { x, z };
    }
    return { x: 18, z: 18 };
  }

  update(dt, playerPos, playerInCar, inGoldCar, carSpeed = 0) {
    const g = this.game;
    // --- story triggers ---------------------------------------------
    if (this.current) {
      const id = this.current.id;
      if (id === 'm1') {
        if (playerInCar && dist2(playerPos.x, playerPos.z, MARKERS.garage.x, MARKERS.garage.z) < MARKERS.garage.r) {
          this.completeMission();
        }
      } else if (id === 'm2') {
        // Countdown; running out just extends the deadline — the
        // courier never fails on time alone.
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = MISSIONS[1].timeLimit;
          g.hud.flash('Sunset extended — keep delivering!');
        }
        g.hud.setTimer(Math.ceil(this.timer));
        const stop = PACKAGE_STOPS[this.packageIndex];
        if (stop && dist2(playerPos.x, playerPos.z, stop.x, stop.z) < stop.r) {
          this.payPackage();
        }
      } else if (id === 'm3') {
        if (g.police.wanted > 0) {
          this.marker = { x: MARKERS.spray.x, z: MARKERS.spray.z };
          g.hud.setObjective('Lose the heat at the Spray Shop first');
        } else {
          this.marker = { x: MARKERS.safehouse.x, z: MARKERS.safehouse.z };
          g.hud.setObjective('Heat is off — reach the Safehouse');
          if (dist2(playerPos.x, playerPos.z, MARKERS.safehouse.x, MARKERS.safehouse.z) < MARKERS.safehouse.r) {
            this.completeMission();
          }
        }
      } else if (id === 'm4') {
        if (this.m4Stage === 'steal') {
          if (inGoldCar) {
            this.m4Stage = 'lighthouse';
            this.marker = { x: MARKERS.lighthouse.x, z: MARKERS.lighthouse.z };
            g.hud.setObjective('Gold GT secured — drop it at the Old Lighthouse (stay under 4 stars)');
            g.police.setWanted(3);
          }
        } else if (this.m4Stage === 'lighthouse') {
          if (inGoldCar && g.police.wanted < 4
            && dist2(playerPos.x, playerPos.z, MARKERS.lighthouse.x, MARKERS.lighthouse.z) < MARKERS.lighthouse.r) {
            this.m4Stage = 'escape';
            this.marker = { x: MARKERS.safehouse.x, z: MARKERS.safehouse.z };
            g.hud.setObjective('Delivered — escape to the Safehouse');
            g.audio.mission();
          } else if (!inGoldCar) {
            this.m4Stage = 'steal';
            this.marker = { x: MARKERS.goldCar.x, z: MARKERS.goldCar.z };
            g.hud.setObjective('Steal the gold Marlin GT at the Hotel Solmar');
          }
        } else if (this.m4Stage === 'escape') {
          if (inGoldCar
            && dist2(playerPos.x, playerPos.z, MARKERS.safehouse.x, MARKERS.safehouse.z) < MARKERS.safehouse.r) {
            this.completeMission();
          } else if (!inGoldCar) {
            this.m4Stage = 'steal';
            this.marker = { x: MARKERS.goldCar.x, z: MARKERS.goldCar.z };
          }
        }
      }
    }

    // --- taxi side job ----------------------------------------------
    const t = this.taxi;
    if (t.cooldown > 0) t.cooldown -= dt;
    if (!t.active && playerInCar && this.missionIndex >= 1 && t.cooldown <= 0) {
      t.active = true;
      t.phase = 'pickup';
      t.pickup = this._randomRoadPoint(50, playerPos);
      this.taxiMarker = { ...t.pickup, taxi: true };
    } else if (t.active) {
      if (t.phase === 'pickup') {
        this.taxiMarker = { ...t.pickup, taxi: true };
        // A fare is only picked up when the cab actually stops for it —
        // a car blasting past an intersection does not collect one.
        if (Math.abs(carSpeed) < 3
          && dist2(playerPos.x, playerPos.z, t.pickup.x, t.pickup.z) < 6) {
          t.phase = 'drop';
          t.dest = this._randomRoadPoint(60, playerPos);
          g.hud.flash('Fare picked up — drive to the destination');
        }
      } else if (t.phase === 'drop') {
        this.taxiMarker = { ...t.dest, taxi: true };
        if (Math.abs(carSpeed) < 3
          && dist2(playerPos.x, playerPos.z, t.dest.x, t.dest.z) < 6) {
          g.addMoney(PRICES.taxi);
          g.audio.pickup();
          g.hud.flash(`Fare complete  +$${PRICES.taxi}`);
          t.active = false;
          t.cooldown = 20;
          this.taxiMarker = null;
        }
      }
      if (!playerInCar) {
        // Passenger bails if Dash ditches the cab.
        t.active = false;
        this.taxiMarker = null;
        t.cooldown = 10;
      }
    }
  }
}
