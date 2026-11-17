// Solmar Heat — the story missions and the taxi side job.
// Three missions, in order: steal a car for the Marina Garage, run three
// courier packages against a 240-second clock, then lose a three-star
// wanted level and reach the Safehouse. A taxi job pays $40 a fare for
// anyone driving the cab. Markers are glowing rings with a beam of light,
// so the player always knows where to go.

import * as THREE from 'three';
import { ECONOMY, MISSIONS, TUNING, dist2d, clamp, mulberry32 } from './config.js';

function makeMarker(color) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4.4, 5.6, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  group.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.6, 42, 10, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 21;
  group.add(beam);
  const pin = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 4, 10),
    new THREE.MeshBasicMaterial({ color }),
  );
  pin.rotation.x = Math.PI;
  pin.position.y = 9;
  group.add(pin);
  return group;
}

export class MissionSystem {
  constructor(game) {
    this.game = game;
    this.index = 0;
    this.done = [false, false, false];
    this.packageIndex = 0;
    this.timer = TUNING.mission2Seconds;
    this.taxiJobs = 0;
    this.taxiState = 'idle';
    this.taxiTarget = null;
    this.taxiPassengerAt = null;
    this.marker = null;
    this.taxiMarker = null;
    this.rng = game.seed ? mulberry32(game.seed + 21) : Math.random;
  }

  get current() {
    return MISSIONS[this.index] || null;
  }

  get active() {
    return this.index < 3 && !this.done[this.index];
  }

  build() {
    this.marker = makeMarker(0xffd23f);
    this.marker.visible = false;
    this.game.scene.add(this.marker);
    this.taxiMarker = makeMarker(0xf7c948);
    this.taxiMarker.visible = false;
    this.game.scene.add(this.taxiMarker);
    this.refreshObjective();
    return this;
  }

  refreshObjective() {
    const g = this.game;
    if (this.index >= 3 || this.done[2]) {
      this.marker.visible = false;
      g.hud.setObjective('Free roam', 'Solmar Bay is yours. Earn cash, dodge the law.');
      return;
    }
    const m = this.current;
    if (!m) return;
    if (this.index === 1) {
      const pkg = m.packages[this.packageIndex];
      if (pkg) {
        this.marker.position.set(pkg.at[0], 0, pkg.at[1]);
        this.marker.visible = true;
        g.hud.setObjective(m.title, `Deliver package ${this.packageIndex + 1} of 3 — ${pkg.name} (${Math.ceil(this.timer)}s)`);
      }
      return;
    }
    this.marker.position.set(m.marker[0], 0, m.marker[1]);
    this.marker.visible = true;
    g.hud.setObjective(m.title, m.objective);
  }

  completeMission() {
    const g = this.game;
    const m = this.current;
    if (!m) return;
    this.done[this.index] = true;
    g.money += m.reward;
    g.audio.missionDone();
    g.hud.toast(`${m.title} complete — +$${m.reward}`);
    g.save.save();
    if (this.index === 1) {
      g.combat.hasPistol = true;
      g.police.setWanted(3);
      g.hud.toast('The Marlin Club gave you a pistol. And the heat is on.');
    }
    this.index++;
    if (this.index === 1) {
      this.packageIndex = 0;
      this.timer = TUNING.mission2Seconds;
    }
    if (this.index >= 3) {
      g.win();
      return;
    }
    this.refreshObjective();
    g.hud.refresh();
  }

  failMission2() {
    const g = this.game;
    this.packageIndex = 0;
    this.timer = TUNING.mission2Seconds;
    g.audio.missionFail();
    g.hud.toast('Out of time — the packages go back. Try the run again.');
    this.refreshObjective();
  }

  _checkMissions() {
    const g = this.game;
    const p = g.player.pos;
    if (this.index === 0 && !this.done[0]) {
      if (g.player.car && dist2d(p.x, p.z, 140, -118) < TUNING.markerRadius) this.completeMission();
      return;
    }
    if (this.index === 1 && !this.done[1]) {
      const m = this.current;
      const pkg = m.packages[this.packageIndex];
      if (pkg && dist2d(p.x, p.z, pkg.at[0], pkg.at[1]) < TUNING.packageRadius) {
        this.packageIndex++;
        g.audio.pickup();
        if (this.packageIndex >= 3) {
          this.completeMission();
        } else {
          g.hud.toast(`Package ${this.packageIndex} of 3 delivered.`);
          this.refreshObjective();
        }
      }
      return;
    }
    if (this.index === 2 && !this.done[2]) {
      if (g.police.wanted === 0 && dist2d(p.x, p.z, -140, 120) < TUNING.markerRadius) {
        this.completeMission();
      }
    }
  }

  _checkTaxi(dt) {
    const g = this.game;
    const inTaxi = g.player.car === g.vehicles.taxiCar;
    if (!inTaxi) {
      if (this.taxiState !== 'idle') {
        this.taxiState = 'idle';
        this.taxiMarker.visible = false;
      }
      return;
    }
    const p = g.player.pos;
    if (this.taxiState === 'idle') {
      // A passenger waves from a random roadside corner.
      const spot = this._randomRoadside();
      this.taxiPassengerAt = spot;
      this.taxiTarget = null;
      this.taxiState = 'waiting';
      this.taxiMarker.position.set(spot.x, 0, spot.z);
      this.taxiMarker.visible = true;
      g.hud.toast('Taxi job: pick up the passenger at the yellow marker.');
    } else if (this.taxiState === 'waiting') {
      if (dist2d(p.x, p.z, this.taxiPassengerAt.x, this.taxiPassengerAt.z) < 9) {
        this.taxiState = 'aboard';
        this.taxiTarget = this._randomRoadside();
        this.taxiMarker.position.set(this.taxiTarget.x, 0, this.taxiTarget.z);
        g.hud.toast('Passenger aboard — take them to the yellow marker.');
      }
    } else if (this.taxiState === 'aboard') {
      if (dist2d(p.x, p.z, this.taxiTarget.x, this.taxiTarget.z) < 9) {
        this.taxiJobs++;
        g.money += ECONOMY.taxiFare;
        g.audio.cashRegister();
        g.hud.toast(`Fare complete — +$${ECONOMY.taxiFare}`);
        this.taxiState = 'idle';
        this.taxiMarker.visible = false;
        g.hud.refresh();
      }
    }
  }

  _randomRoadside() {
    const rng = this.rng;
    const line = -160 + Math.floor(rng() * 9) * 40;
    const along = -140 + Math.floor(rng() * 8) * 40;
    const off = rng() < 0.5 ? -8 : 8;
    if (rng() < 0.5) return { x: line + off, z: along };
    return { x: along, z: line + off };
  }

  update(dt) {
    const g = this.game;
    if (g.state !== 'playing') return;
    if (this.index === 1 && !this.done[1] && !g.shotMode) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0;
        this.failMission2();
      }
      // Refresh the countdown text a few times a second.
      if (Math.floor(this.timer * 4) !== Math.floor((this.timer + dt) * 4)) this.refreshObjective();
    }
    // Pulse the marker ring.
    if (this.marker && this.marker.visible) {
      const s = 1 + Math.sin(g.elapsed * 3) * 0.08;
      this.marker.scale.set(s, 1, s);
    }
    this._checkMissions();
    this._checkTaxi(dt);
  }
}
