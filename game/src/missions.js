// Solmar Heat — story missions, taxi fares and doubloon collectibles.
// M1 Hot Wheels ($150) · M2 Sunset Courier ($250 + pistol) · M3 The Heat
// ($400) · M4 Marlin's Debt ($300) · M5 The Marlin's Last Hand ($500,
// NEW in R16): steal the black limo at Casino Solmar, outrun a 4-star
// chase to the Boardwalk, deliver it to the Pier on a timer. The win
// screen only fires once M1–M5 are all done.
// Taxi fares (expanded in R16): a pickup beacon appears across the city;
// delivering a fare pays $40 plus a tip that grows with your streak, and
// the streak resets if a fare times out. Fares never block missions.
// Doubloons (new in R16): 12 hidden gold coins; each is $10, all 12 pay
// a $200 bonus. Never assign missions.done directly — use setDone().
import { MISSIONS, M2_PACKAGES, LANDMARKS, PARKED, M5, FARE_POINTS, FARE, DOUBLOONS, DOUBLOON_BONUS, DOUBLOON_VALUE } from './config.js';

function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.stage = 0;
    this.timer = 0;
    this.delivered = new Set();
    this.doneIds = [];
    this.taxi = { active: null, streak: 0, done: 0, respawnIn: 2 };
    this.doubloons = { collected: new Set(), total: DOUBLOONS.length };
  }
  get doneCount() { return this.doneIds.length; }
  get doubloonCount() { return this.doubloons.collected.size; }
  setDone(list) {
    this.doneIds = [...new Set(list || [])];
    if (this.current && this.doneIds.includes(this.current.id)) this.current = null;
  }
  startMission(id, stage = 0) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) { this.current = null; return; }
    this.current = { id: def.id, title: def.title };
    this.stage = stage;
    this.timer = def.timeLimit || 0;
    this.delivered = new Set();
    this.game.hud.toast(`Mission ${id}: ${def.title} — ${def.brief}`);
    this.game.audio.missionDone();
  }
  forceStage(id, stage) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) return;
    this.current = { id: def.id, title: def.title };
    this.stage = stage;
    this.timer = def.timeLimit || 0;
    this.delivered = new Set();
  }
  completeMission(id) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def || this.doneIds.includes(id)) return;
    this.doneIds.push(id);
    this.game.money += def.reward;
    this.game.audio.missionDone();
    this.game.hud.toast(`Mission complete: ${def.title} +$${def.reward}`);
    this.current = null;
    this.game.save.save();
    if (id === 2) this.game.combat.hasPistol = true;
    if (id === 5) {
      this.game.win();
      return;
    }
    this.startMission(id + 1);
  }
  objective() {
    if (!this.current) return this.doneIds.length >= 5 ? 'All missions complete — Solmar Legend!' : 'Find your next job.';
    const p = this.game.playerPos();
    const mmss = (t) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;
    switch (this.current.id) {
      case 1: return 'M1 Hot Wheels: steal the red sedan at Marina Garage ($150)';
      case 2: return `M2 Sunset Courier: deliver packages ${this.delivered.size}/3 — ${mmss(this.timer)} left ($250)`;
      case 3: return this.game.police.wanted > 0
        ? `M3 The Heat: lose the heat (wanted ${this.game.police.wanted}★), then reach the Safehouse ($400)`
        : 'M3 The Heat: reach the Safehouse ($400)';
      case 4:
        if (this.stage === 0) return "M4 Marlin's Debt: steal the gold Marlin GT at Hotel Solmar ($300)";
        if (this.stage === 1) return 'M4: show the gold GT at the Old Lighthouse';
        return 'M4: deliver the GT to the Safehouse';
      case 5:
        if (this.stage === 0) return "M5 The Marlin's Last Hand: steal the black limo at Casino Solmar ($500)";
        if (this.stage === 1) return 'M5: outrun the 4-star chase — reach the Solmar Boardwalk!';
        return `M5: deliver the limo to the Pier — ${mmss(this.timer)} left!`;
      default: return this.current.title;
    }
    void p;
  }
  targetPos() {
    if (!this.current) return null;
    switch (this.current.id) {
      case 1: return { x: PARKED.redSedan.x, z: PARKED.redSedan.z };
      case 2: {
        const next = [0, 1, 2].find((i) => !this.delivered.has(i));
        return next === undefined ? null : M2_PACKAGES[next];
      }
      case 3: return this.game.police.wanted > 0 ? { x: LANDMARKS.spray.x, z: LANDMARKS.spray.z } : { x: LANDMARKS.safehouse.x, z: LANDMARKS.safehouse.z };
      case 4:
        if (this.stage === 0) return { x: PARKED.goldGt.x, z: PARKED.goldGt.z };
        if (this.stage === 1) return { x: LANDMARKS.lighthouse.x, z: LANDMARKS.lighthouse.z };
        return { x: LANDMARKS.safehouse.x, z: LANDMARKS.safehouse.z };
      case 5:
        if (this.stage === 0) return { x: M5.limo.x, z: M5.limo.z };
        if (this.stage === 1) return { x: M5.boardwalk.x, z: M5.boardwalk.z };
        return { x: M5.pier.x, z: M5.pier.z };
      default: return null;
    }
  }
  update(dt) {
    const g = this.game;
    const p = g.playerPos();
    const inLimo = g.player.car === g.parked.limo;
    if (this.current) {
      const id = this.current.id;
      if (id === 1) {
        if (g.player.car === g.parked.redSedan) this.completeMission(1);
      } else if (id === 2) {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.delivered.clear();
          this.timer = 240;
          g.hud.toast('Courier time up — the packages reset. Try again!');
        } else {
          M2_PACKAGES.forEach((pkg, i) => {
            if (!this.delivered.has(i) && Math.hypot(pkg.x - p.x, pkg.z - p.z) < 7) {
              this.delivered.add(i);
              g.audio.pickup();
              g.hud.toast(`Package ${i + 1}/3 delivered`);
            }
          });
          if (this.delivered.size === 3) this.completeMission(2);
        }
      } else if (id === 3) {
        if (g.police.wanted === 0 && Math.hypot(LANDMARKS.safehouse.x - p.x, LANDMARKS.safehouse.z - p.z) < 10) {
          this.completeMission(3);
        }
      } else if (id === 4) {
        if (this.stage === 0 && g.player.car === g.parked.goldGt) {
          this.stage = 1;
          g.hud.toast('Gold Marlin GT secured — show it at the Old Lighthouse');
        } else if (this.stage === 1 && Math.hypot(LANDMARKS.lighthouse.x - p.x, LANDMARKS.lighthouse.z - p.z) < 10) {
          this.stage = 2;
          g.hud.toast('The Marlin saw the GT — now vanish at the Safehouse');
        } else if (this.stage === 2 && Math.hypot(LANDMARKS.safehouse.x - p.x, LANDMARKS.safehouse.z - p.z) < 10) {
          this.completeMission(4);
        }
      } else if (id === 5) {
        if (this.stage === 0 && inLimo) {
          this.stage = 1;
          g.police.setWanted(M5.chaseStars);
          g.audio.limoAlarm();
          g.hud.toast('Limo stolen! 4-star chase — run for the Boardwalk!');
        } else if (this.stage === 1 && inLimo && Math.hypot(M5.boardwalk.x - p.x, M5.boardwalk.z - p.z) < M5.arriveRadius) {
          this.stage = 2;
          this.timer = M5.deliveryTime;
          g.audio.casinoWin();
          g.hud.toast('You shook them at the Boardwalk — now deliver the limo to the Pier!');
        } else if (this.stage === 2) {
          this.timer -= dt;
          if (this.timer <= 0) {
            this.stage = 1;
            this.timer = 0;
            g.hud.toast('Delivery time up — get back to the Boardwalk and run it again!');
          } else if (inLimo && Math.hypot(M5.pier.x - p.x, M5.pier.z - p.z) < M5.arriveRadius) {
            this.completeMission(5);
          }
        }
      }
    }
    this._updateTaxi(dt, p);
    this._updateDoubloons(p);
    this._updateBeacons();
  }
  _updateTaxi(dt, p) {
    const g = this.game;
    const t = this.taxi;
    if (!t.active) {
      t.respawnIn -= dt;
      if (t.respawnIn <= 0) {
        const pickup = FARE_POINTS[Math.floor(Math.random() * FARE_POINTS.length)];
        let dest = FARE_POINTS[Math.floor(Math.random() * FARE_POINTS.length)];
        while (dest === pickup) dest = FARE_POINTS[Math.floor(Math.random() * FARE_POINTS.length)];
        t.active = { pickup, dest, timer: FARE.timeLimit, state: 'pickup' };
      }
      return;
    }
    const a = t.active;
    if (a.state === 'pickup') {
      if (Math.hypot(a.pickup.x - p.x, a.pickup.z - p.z) < FARE.pickupRadius) {
        a.state = 'dropoff';
        a.timer = FARE.timeLimit;
        g.audio.fareBell();
        g.hud.toast('Fare picked up — drive them to the marker!');
      }
    } else {
      a.timer -= dt;
      if (Math.hypot(a.dest.x - p.x, a.dest.z - p.z) < FARE.dropRadius) {
        const tip = FARE.tipPerStreak * t.streak;
        const pay = FARE.base + tip;
        g.money += pay;
        t.streak += 1;
        t.done += 1;
        g.audio.fareDone();
        g.hud.toast(`Fare complete +$${pay} (tip $${tip}) — streak ${t.streak}`);
        t.active = null;
        t.respawnIn = FARE.respawnDelay;
      } else if (a.timer <= 0) {
        t.streak = 0;
        g.hud.toast('Fare timed out — streak reset.');
        t.active = null;
        t.respawnIn = FARE.respawnDelay;
      }
    }
  }
  _updateDoubloons(p) {
    const g = this.game;
    DOUBLOONS.forEach((d, i) => {
      if (this.doubloons.collected.has(i)) return;
      if (Math.hypot(d.x - p.x, d.z - p.z) < 4) {
        this.doubloons.collected.add(i);
        g.money += DOUBLOON_VALUE;
        g.audio.doubloon();
        g.hud.toast(`Doubloon ${this.doubloons.collected.size}/12 found +$${DOUBLOON_VALUE}`);
        if (g.doubloonMeshes && g.doubloonMeshes[i]) g.doubloonMeshes[i].visible = false;
        if (this.doubloons.collected.size === DOUBLOONS.length) {
          g.money += DOUBLOON_BONUS;
          g.audio.casinoWin();
          g.hud.toast(`ALL 12 DOUBLOONS! Bonus +$${DOUBLOON_BONUS}`);
        }
        g.save.save();
      }
    });
  }
  refreshDoubloonMeshes() {
    if (!this.game.doubloonMeshes) return;
    this.game.doubloonMeshes.forEach((m, i) => { m.visible = !this.doubloons.collected.has(i); });
  }
  _updateBeacons() {
    const g = this.game;
    const target = this.targetPos();
    if (g.beacon) {
      g.beacon.visible = !!target;
      if (target) g.beacon.position.set(target.x, 2, target.z);
    }
    if (g.packageBeacons) {
      g.packageBeacons.forEach((b, i) => {
        const show = this.current && this.current.id === 2 && !this.delivered.has(i);
        b.visible = !!show;
        if (show) b.position.set(M2_PACKAGES[i].x, 2, M2_PACKAGES[i].z);
      });
    }
    if (g.fareBeacon) {
      const a = this.taxi.active;
      g.fareBeacon.visible = !!a;
      if (a) {
        const t = a.state === 'pickup' ? a.pickup : a.dest;
        g.fareBeacon.position.set(t.x, 2, t.z);
      }
    }
  }
}
