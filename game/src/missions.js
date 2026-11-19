// Story missions plus the taxi side job. The reward counter is the single
// source of truth for mission money: setDone(list) recomputes it, and
// nothing else writes missions.done directly, so save/load can never
// double-pay a mission.
import {
  GOLD_GT,
  LANDMARKS,
  MISSION_DEFS,
  MISSION_TIME,
  PACKAGES,
  TAXI_FARE,
  TAXI_STAND,
  WIN_BONUS,
  dist2d,
} from "./config.js";

function lm(id) {
  return LANDMARKS.find((l) => l.id === id);
}

export class Missions {
  constructor(game) {
    this.game = game;
    this.index = 0;
    this.done = [false, false, false, false];
    this.earned = 0;
    this.bonus = 0;
    this.timer = 0;
    this.packageIdx = 0;
    this.stage = "go";
    this.taxi = { active: false, dest: null, timer: 0, from: null };
    this._started = [false, false, false, false];
  }

  get current() {
    return this.index < MISSION_DEFS.length ? MISSION_DEFS[this.index] : null;
  }

  get allDone() {
    return this.done.every(Boolean);
  }

  _missionSum() {
    let s = 0;
    for (let i = 0; i < 4; i++) if (this.done[i]) s += MISSION_DEFS[i].reward;
    return s;
  }

  setDone(list) {
    this.done = [!!list[0], !!list[1], !!list[2], !!list[3]];
    this.earned = this._missionSum() + this.bonus;
    this.index = this.done.findIndex((d) => !d);
    if (this.index < 0) this.index = 4;
  }

  addBonus(n) {
    this.bonus += n;
    this.earned = this._missionSum() + this.bonus;
  }

  setCurrent(i) {
    this.index = i;
    this.stage = "go";
    this.packageIdx = 0;
    this.timer = i === 1 ? MISSION_TIME : 0;
    this._started[i] = false;
    this._begin(i);
  }

  _begin(i) {
    if (this._started[i]) return;
    this._started[i] = true;
    if (i === 1) {
      this.timer = MISSION_TIME;
      this.packageIdx = 0;
    }
    if (i === 2) {
      this.game.setWanted(3);
      this.stage = "lose-heat";
    }
    if (i === 3) {
      this.stage = "steal";
    }
  }

  // Where the HUD beacon should point right now (or null).
  marker() {
    const g = this.game;
    if (this.taxi.active && this.taxi.dest) return this.taxi.dest;
    if (this.index === 0) return { x: 154, z: -126 };
    if (this.index === 1) return PACKAGES[this.packageIdx] ?? null;
    if (this.index === 2) {
      return this.stage === "lose-heat" ? null : lm("safehouse");
    }
    if (this.index === 3) {
      if (this.stage === "steal") return GOLD_GT;
      if (this.stage === "deliver") return lm("lighthouse");
      return lm("safehouse");
    }
    return null;
  }

  objective() {
    if (this.taxi.active && this.taxi.dest) {
      return `Taxi fare: drop the passenger at ${this.taxi.dest.name ?? "the marker"} (+$${TAXI_FARE})`;
    }
    const c = this.current;
    if (!c) return "Debt paid — you are a Solmar Legend.";
    if (this.index === 0) return `M1 ${c.title} — ${c.blurb}`;
    if (this.index === 1) {
      return `M2 ${c.title} — package ${this.packageIdx + 1} of 3 (${Math.ceil(this.timer)}s left)`;
    }
    if (this.index === 2) {
      return this.stage === "lose-heat"
        ? `M3 ${c.title} — lose the heat (0 stars), then reach the Safehouse`
        : `M3 ${c.title} — reach the Safehouse`;
    }
    if (this.index === 3) {
      if (this.stage === "steal") return `M4 ${c.title} — steal the gold Marlin GT at Hotel Solmar`;
      if (this.stage === "deliver") return `M4 ${c.title} — deliver the GT to the Old Lighthouse (stay under 4 stars)`;
      return `M4 ${c.title} — escape to the Safehouse`;
    }
    return c.blurb;
  }

  _complete(i) {
    const next = this.done.slice();
    next[i] = true;
    this.setDone(next);
    this.game.onMissionComplete(i);
    if (i === 1) this.game.unlockPistol();
    if (this.allDone) {
      this.addBonus(WIN_BONUS);
      this.game.onWin();
    }
  }

  update(dt, px, pz, inCar, wanted) {
    if (this.index >= 4) return;
    this._begin(this.index);
    // Taxi runs alongside the story.
    if (this.taxi.active) {
      this.taxi.timer -= dt;
      if (this.taxi.dest && dist2d(px, pz, this.taxi.dest.x, this.taxi.dest.z) < 8) {
        this.taxi.active = false;
        this.addBonus(TAXI_FARE);
        this.game.toast(`Fare complete +$${TAXI_FARE}`);
        this.game.audio.jingle();
      } else if (this.taxi.timer <= 0) {
        this.taxi.active = false;
        this.game.toast("Taxi fare timed out");
      }
    }
    if (this.index === 0) {
      if (this.game.playerCarIsSedan) this._complete(0);
      return;
    }
    if (this.index === 1) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = MISSION_TIME;
        this.packageIdx = 0;
        this.game.toast("Out of time — packages reset, try again");
        return;
      }
      const pkg = PACKAGES[this.packageIdx];
      if (pkg && dist2d(px, pz, pkg.x, pkg.z) < 7) {
        this.packageIdx++;
        this.game.audio.pickup();
        this.game.toast(`Package ${this.packageIdx} of 3 delivered`);
        if (this.packageIdx >= PACKAGES.length) this._complete(1);
      }
      return;
    }
    if (this.index === 2) {
      if (this.stage === "lose-heat" && wanted === 0) {
        this.stage = "safehouse";
        this.game.toast("Heat lost — now reach the Safehouse");
      } else if (this.stage === "safehouse") {
        const s = lm("safehouse");
        if (dist2d(px, pz, s.x, s.z) < 9) this._complete(2);
      }
      return;
    }
    if (this.index === 3) {
      if (this.stage === "steal" && this.game.playerCarIsGold) {
        this.stage = "deliver";
        this.game.toast("GT stolen — deliver it to the Old Lighthouse");
        return;
      }
      if (this.stage === "deliver") {
        const lh = lm("lighthouse");
        if (dist2d(px, pz, lh.x, lh.z) < 9) {
          if (wanted >= 4) {
            this.game.toast("Too hot — lose a star before the drop");
          } else {
            this.stage = "escape";
            this.game.toast("GT delivered — escape to the Safehouse");
          }
        }
        return;
      }
      if (this.stage === "escape") {
        const s = lm("safehouse");
        if (dist2d(px, pz, s.x, s.z) < 9) this._complete(3);
      }
    }
  }

  tryStartTaxi(px, pz) {
    if (this.taxi.active) return false;
    if (dist2d(px, pz, TAXI_STAND.x, TAXI_STAND.z) > 9) return false;
    const choices = [lm("garage"), lm("hotel"), lm("lighthouse"), lm("pier")];
    const dest = choices[Math.floor(Math.random() * choices.length)];
    this.taxi = { active: true, dest, timer: 150, from: { ...TAXI_STAND } };
    this.game.toast(`Taxi fare: take the passenger to ${dest.name}`);
    return true;
  }

  taxiStand() {
    return TAXI_STAND;
  }

  reset() {
    this.index = 0;
    this.done = [false, false, false, false];
    this.earned = 0;
    this.bonus = 0;
    this.timer = 0;
    this.packageIdx = 0;
    this.stage = "go";
    this.taxi = { active: false, dest: null, timer: 0, from: null };
    this._started = [false, false, false, false];
  }
}
