// Solmar Heat — missions.js
// The story: three missions, a taxi side job, and the win. Each mission
// has a marker on the road, an objective line for the HUD, and a reward.
// The module never touches the renderer — it just watches positions,
// timers and the wanted level, and tells the world when something is done.

import { CONFIG, LANDMARKS, MISSIONS, distance2D } from './config.js';

export class Missions {
  constructor(game) {
    this.game = game;
    this.index = 0; // 0..2 while the story runs, 3 when it is won
    this.done = [false, false, false];
    this.timer = 0;
    this.packageIndex = 0;
    this.objective = MISSIONS[0].objective;
    this.current = MISSIONS[0];
    this.marker = { ...LANDMARKS.garage.marker };
    this.markerColor = 0xe8c832;
    this.taxi = { active: false, stage: 0, pickup: null, dropoff: null, fare: 0 };
    this._courierDrops = [
      { ...LANDMARKS.pier.marker, name: 'The Pier' },
      { ...LANDMARKS.hotel.marker, name: 'Hotel Solmar' },
      { ...LANDMARKS.lighthouse.marker, name: 'Old Lighthouse' },
    ];
  }

  get active() {
    return this.index < 3;
  }

  refreshObjective() {
    if (this.index >= 3) {
      this.objective = 'Solmar Legend — free roam. Enjoy the city, Dash.';
      this.current = null;
      this.marker = null;
      return;
    }
    this.current = MISSIONS[this.index];
    this.objective = this.current.objective;
    if (this.index === 0) {
      this.marker = { ...LANDMARKS.garage.marker };
    } else if (this.index === 1) {
      const drop = this._courierDrops[this.packageIndex];
      this.marker = drop ? { x: drop.x, z: drop.z } : null;
    } else if (this.index === 2) {
      this.marker = { ...LANDMARKS.safehouse.marker };
    }
  }

  start() {
    this.index = 0;
    this.done = [false, false, false];
    this.packageIndex = 0;
    this.timer = 0;
    this.refreshObjective();
  }

  startMission2() {
    this.index = 1;
    this.packageIndex = 0;
    this.timer = CONFIG.MISSION2_TIME_LIMIT;
    this.refreshObjective();
  }

  startMission3() {
    this.index = 2;
    this.game.police.setWanted(CONFIG.MISSION3_WANTED);
    this.refreshObjective();
  }

  completeMission(i) {
    if (this.done[i]) return;
    this.done[i] = true;
    const reward = MISSIONS[i].reward;
    this.game.money += reward;
    this.game.score += reward;
    this.game.audio.missionDone();
    this.game.save.write(this.game);
    if (i === 0) {
      this.game.hud.toast(`Mission complete: ${MISSIONS[0].title} — +$${reward}`);
      this.startMission2();
    } else if (i === 1) {
      this.game.combat.givePistol();
      this.game.hud.toast(`Mission complete: ${MISSIONS[1].title} — +$${reward} and a pistol`);
      this.startMission3();
    } else if (i === 2) {
      this.game.hud.toast(`Mission complete: ${MISSIONS[2].title} — +$${reward}`);
      this.index = 3;
      this.refreshObjective();
      this.game.win();
    }
  }

  // Called every frame while the story runs.
  update(dt, playerPos, inCar) {
    if (this.index >= 3) {
      this._updateTaxi(dt, playerPos, inCar);
      return;
    }
    if (this.index === 1) {
      this.timer -= dt;
      if (this.timer <= 0) {
        // Out of time: the courier job fails, but the story goes on —
        // restart the mission with a fresh clock instead of a dead end.
        this.timer = CONFIG.MISSION2_TIME_LIMIT;
        this.packageIndex = 0;
        this.refreshObjective();
        this.game.hud.toast('Out of time! The courier run restarts.');
        return;
      }
    }
    const marker = this.marker;
    if (!marker) return;
    const d = distance2D(playerPos.x, playerPos.z, marker.x, marker.z);
    if (d > 7) return;

    if (this.index === 0) {
      // Hot Wheels: only counts in a car — Dash has to drive it in.
      if (inCar) this.completeMission(0);
      else this.game.hud.hint('Get in a car first — the garage wants the car, not you.');
    } else if (this.index === 1) {
      if (!inCar) {
        this.game.hud.hint('Deliveries are by car — get back behind the wheel.');
        return;
      }
      const drop = this._courierDrops[this.packageIndex];
      this.packageIndex += 1;
      this.game.audio.pickup();
      this.game.hud.toast(`Package delivered: ${drop.name} (${this.packageIndex}/3)`);
      if (this.packageIndex >= 3) {
        this.completeMission(1);
      } else {
        this.refreshObjective();
      }
    } else if (this.index === 2) {
      // The Heat: the Safehouse only counts once the stars are gone.
      if (this.game.police.wanted > 0) {
        this.game.hud.hint('Too hot! Lose the stars at the Spray Shop first.');
        return;
      }
      this.completeMission(2);
    }
  }

  // --- Taxi side job ----------------------------------------------------------
  // Enter the yellow cab and a fare appears: pick the passenger up, drop
  // them off, pocket $40. It runs in free roam and between story beats,
  // never during a timed courier run.

  startTaxi(playerPos) {
    if (this.taxi.active || this.index === 1) return;
    const spots = [
      { ...LANDMARKS.hotel.marker, name: 'Hotel Solmar' },
      { ...LANDMARKS.pier.marker, name: 'The Pier' },
      { ...LANDMARKS.garage.marker, name: 'Marina Garage' },
      { ...LANDMARKS.lighthouse.marker, name: 'Old Lighthouse' },
    ];
    const pickup = spots[Math.floor(Math.random() * spots.length)];
    let dropoff = spots[Math.floor(Math.random() * spots.length)];
    if (dropoff.name === pickup.name) dropoff = spots[(spots.indexOf(pickup) + 2) % spots.length];
    this.taxi = { active: true, stage: 0, pickup, dropoff, fare: CONFIG.TAXI_FARE };
    this.game.hud.toast(`Taxi fare: pick up at ${pickup.name}`);
  }

  _updateTaxi(dt, playerPos, inCar) {
    if (!this.taxi.active) return;
    if (!inCar) return;
    const target = this.taxi.stage === 0 ? this.taxi.pickup : this.taxi.dropoff;
    const d = distance2D(playerPos.x, playerPos.z, target.x, target.z);
    if (d > 7) return;
    if (this.taxi.stage === 0) {
      this.taxi.stage = 1;
      this.game.hud.toast(`Passenger aboard — drop them at ${this.taxi.dropoff.name}`);
      this.game.audio.pickup();
    } else {
      this.taxi.active = false;
      this.game.money += this.taxi.fare;
      this.game.score += this.taxi.fare;
      this.game.audio.missionDone();
      this.game.hud.toast(`Fare complete — +$${this.taxi.fare}`);
      this.game.save.write(this.game);
    }
  }

  get taxiMarker() {
    if (!this.taxi.active) return null;
    return this.taxi.stage === 0 ? this.taxi.pickup : this.taxi.dropoff;
  }
}
