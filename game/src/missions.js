// Solmar Heat — missions.js
// The story: three missions, their objectives, timers and rewards, plus
// the repeatable taxi side job. The mission system owns the story state
// and tells the HUD what to show; the Game owns money, the player and
// the police, which the missions call into.
//
// Each mission has its own per-frame check (checkHotWheels,
// checkCourier, checkHeat) so the update loop just dispatches on the
// active mission's id. Courier drop-offs run in a fixed order — Pier,
// Hotel Solmar, Old Lighthouse — and the clock resets the run if it
// runs out.

import { MISSIONS, SIDE_JOBS, distance2D } from './config.js';

export class MissionSystem {
  constructor(game) {
    this.game = game;
    this.index = 0; // which story mission is active
    this.done = [false, false, false];
    this.step = 0;
    this.timer = 0;
    this.active = false;
    this.packageIndex = 0;
    this.taxi = null; // { pickup: {x,z}, dest: {x,z}, passenger: bool }
    this.message = '';
  }

  get current() {
    return MISSIONS[this.index];
  }

  get finished() {
    return this.done.every(Boolean);
  }

  // The three courier drop-off points, in delivery order.
  courierSpots() {
    return [
      this.game.city.markers.pier,
      this.game.city.markers.hotel,
      this.game.city.markers.lighthouse,
    ];
  }

  start() {
    this.active = true;
    this.index = 0;
    this.step = 0;
    this.setObjective();
  }

  setObjective() {
    if (this.finished) {
      this.game.hud.setObjective('SOLMAR LEGEND', 'All missions done — free roam. Press T for a taxi fare.');
      this.game.hud.setMarker(null);
      return;
    }
    const m = this.current;
    this.game.hud.setObjective(m.title, m.brief);
    if (m.id === 'hot-wheels') {
      this.game.hud.setMarker(this.game.city.markers.garage, 'GARAGE');
    } else if (m.id === 'sunset-courier') {
      this.packageIndex = 0;
      this.timer = m.timeLimit;
      this.setPackageMarker();
    } else if (m.id === 'the-heat') {
      this.game.police.addWanted(3, 'heat');
      this.game.hud.setMarker(this.game.city.markers.safehouse, 'SAFEHOUSE');
    }
  }

  setPackageMarker() {
    const spot = this.courierSpots()[this.packageIndex];
    this.game.hud.setMarker(spot, `PACKAGE ${this.packageIndex + 1}/3`);
  }

  completeMission() {
    const m = this.current;
    const reward = m.reward;
    this.game.addMoney(reward);
    this.game.audio.missionComplete();
    this.game.hud.toast(`${m.title} COMPLETE — +$${reward}`);
    this.done[this.index] = true;
    this.index += 1;
    this.step = 0;
    if (m.id === 'sunset-courier') {
      // Finishing the courier run earns the pistol.
      this.game.combat.armed = true;
      this.game.combat.ammo += 24;
      this.game.hud.toast('You got a pistol — 24 rounds. Click to shoot, F to punch.');
    }
    this.game.saveGame();
    if (this.finished) {
      this.game.winGame();
    } else {
      this.setObjective();
    }
  }

  // Mission 1: steal a car, then drive it to the Marina Garage.
  checkHotWheels(m) {
    if (this.step === 0 && this.game.player.car) {
      this.step = 1;
      this.game.hud.setObjective(m.title, 'Nice wheels. Now drive to the Marina Garage marker.');
    }
    if (this.step === 1 && this.game.player.car) {
      const g = this.game.city.markers.garage;
      const p = this.game.player.pos;
      if (distance2D(p.x, p.z, g.x, g.z) < 8) this.completeMission();
    }
  }

  // Mission 2: three packages on a 4-minute clock.
  checkCourier(m, dt) {
    this.timer -= dt;
    this.game.hud.setTimer(Math.max(0, Math.ceil(this.timer)));
    if (this.timer <= 0) {
      this.game.hud.toast('Courier run failed — the clock ran out. Try again from the pause menu.');
      this.timer = m.timeLimit;
      this.packageIndex = 0;
      this.setPackageMarker();
      return;
    }
    const spot = this.courierSpots()[this.packageIndex];
    const p = this.game.player.pos;
    if (distance2D(p.x, p.z, spot.x, spot.z) < 7) {
      this.game.addMoney(0);
      this.game.audio.coin();
      this.packageIndex += 1;
      this.game.hud.toast(`Package ${this.packageIndex}/3 delivered`);
      if (this.packageIndex >= 3) this.completeMission();
      else this.setPackageMarker();
    }
  }

  // Mission 3: lose all wanted stars, then reach the Safehouse.
  checkHeat(m) {
    if (this.step === 0 && this.game.police.wanted === 0) {
      this.step = 1;
      this.game.hud.setObjective(m.title, 'Clean! Now reach the blue Safehouse marker.');
    }
    if (this.step === 1) {
      const s = this.game.city.markers.safehouse;
      const p = this.game.player.pos;
      if (distance2D(p.x, p.z, s.x, s.z) < 8) this.completeMission();
    }
  }

  // Called every frame while playing.
  update(dt) {
    if (!this.active || this.finished) return;
    const m = this.current;
    if (m.id === 'hot-wheels') this.checkHotWheels(m);
    else if (m.id === 'sunset-courier') this.checkCourier(m, dt);
    else if (m.id === 'the-heat') this.checkHeat(m);
  }

  // Taxi side job: press T near a waiting passenger, drive them to the
  // destination for a fare.
  tryTaxi() {
    if (this.taxi) return;
    const p = this.game.player.pos;
    const stands = [
      { x: -120, z: -120 },
      { x: 40, z: 80 },
      { x: 120, z: 120 },
    ];
    const stand = stands.find((s) => distance2D(p.x, p.z, s.x, s.z) < 12);
    if (!stand) {
      this.game.hud.toast('No taxi passenger nearby — look for a gold T marker.');
      return;
    }
    const dests = [
      this.game.city.markers.hotel,
      this.game.city.markers.pier,
      this.game.city.markers.garage,
    ];
    const dest = dests[Math.floor(Math.random() * dests.length)];
    this.taxi = { pickup: stand, dest, passenger: false };
    this.game.hud.setMarker(dest, 'TAXI DROP-OFF');
    this.game.hud.toast('Taxi fare! Pick up the passenger at the gold marker.');
  }

  updateTaxi(dt) {
    if (!this.taxi) return;
    const p = this.game.player.pos;
    if (!this.taxi.passenger) {
      if (distance2D(p.x, p.z, this.taxi.pickup.x, this.taxi.pickup.z) < 6) {
        this.taxi.passenger = true;
        this.game.hud.toast('Passenger aboard — drive to the gold marker.');
      }
    } else if (distance2D(p.x, p.z, this.taxi.dest.x, this.taxi.dest.z) < 8) {
      this.game.addMoney(SIDE_JOBS.taxiFare);
      this.game.audio.coin();
      this.game.hud.toast(`Taxi fare complete — +$${SIDE_JOBS.taxiFare}`);
      this.taxi = null;
      this.setObjective();
    }
  }
}
