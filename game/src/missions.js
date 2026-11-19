// Story missions plus the taxi side job. Completion always goes through
// setDone(), which keeps the reward counter in sync — never flip .done
// directly, or the update loop pays the same mission twice.
import { MISSIONS, LANDMARKS, TAXI, GRID, makeRng, pick } from './config.js';

function markerOf(id) {
  const lm = LANDMARKS.find((l) => l.id === id);
  return lm ? { x: lm.marker[0], z: lm.marker[1], name: lm.name } : null;
}

export class Missions {
  constructor(hooks) {
    this.hooks = hooks;
    this.list = MISSIONS.map((m) => ({
      id: m.id,
      title: m.title,
      brief: m.brief,
      reward: m.reward,
      bonus: m.bonus || null,
      bonusCash: m.bonusCash || 0,
      done: false,
    }));
    this.rewardsEarned = 0;
    this.activeId = 'm1';
    this.stage = 0;
    this.packageIndex = 0;
    this.timer = 0;
    this.m4Bonus = false;
    this.taxi = null;
    this.taxiCooldown = 8;
    this.rng = makeRng(99);
  }

  get current() {
    return this.list.find((m) => !m.done) || null;
  }

  get doneCount() {
    return this.list.filter((m) => m.done).length;
  }

  get allDone() {
    return this.list.every((m) => m.done);
  }

  // The only way to mark missions done. Recomputes the reward counter so a
  // mission can never pay twice, even across a save/load.
  setDone(ids) {
    for (const id of ids) {
      const m = this.list.find((x) => x.id === id);
      if (m) m.done = true;
    }
    this.rewardsEarned = this.list
      .filter((m) => m.done)
      .reduce((sum, m) => sum + m.reward + (m.id === 'm4' && this.m4Bonus ? m.bonusCash : 0), 0);
    const next = this.current;
    this.activeId = next ? next.id : null;
    this.stage = 0;
    this.packageIndex = 0;
    if (next && next.id === 'm2') this.timer = 240;
  }

  startMission(id) {
    this.activeId = id;
    this.stage = 0;
    this.packageIndex = 0;
    if (id === 'm2') this.timer = 240;
    if (id === 'm3' && this.hooks.setWanted) this.hooks.setWanted(3);
  }

  complete(id, bonus) {
    const m = this.list.find((x) => x.id === id);
    if (!m || m.done) return;
    if (id === 'm4' && bonus) this.m4Bonus = true;
    this.setDone([id]);
    const payout = m.reward + (id === 'm4' && this.m4Bonus ? m.bonusCash : 0);
    if (this.hooks.award) this.hooks.award(payout);
    if (this.hooks.toast) this.hooks.toast(`Mission complete: ${m.title}  +$${payout}`);
    if (this.hooks.jingle) this.hooks.jingle();
    if (id === 'm2' && this.hooks.grantPistol) this.hooks.grantPistol();
    if (this.allDone && this.hooks.onWin) this.hooks.onWin();
  }

  // Called when the player gets into a car.
  checkEnterCar(car) {
    const cur = this.current;
    if (!cur) return;
    if (cur.id === 'm1' && car.isRed) this.complete('m1');
    if (cur.id === 'm4' && this.stage === 0 && car.isGold) {
      this.stage = 1;
      if (this.hooks.toast) this.hooks.toast('Gold Marlin GT secured. Get it to the Old Lighthouse — stay under 4 stars!');
    }
  }

  // Where the HUD arrow and the minimap should point right now.
  objective() {
    const cur = this.current;
    if (!cur) return { text: 'Debt paid. Solmar is yours.', target: null };
    if (cur.id === 'm1') {
      return { text: 'Steal the red sedan at Marina Garage', target: markerOf('garage') };
    }
    if (cur.id === 'm2') {
      const def = MISSIONS.find((m) => m.id === 'm2');
      const pkg = def.packages[Math.min(this.packageIndex, def.packages.length - 1)];
      const left = Math.max(0, Math.ceil(this.timer));
      return {
        text: `Deliver package ${this.packageIndex + 1}/3 — ${left}s left`,
        target: { x: pkg[0], z: pkg[1], name: 'Package' },
      };
    }
    if (cur.id === 'm3') {
      if (this.stage === 0) return { text: 'Lose the cops — get to 0 stars', target: null };
      return { text: 'Clean! Slip to the Safehouse', target: markerOf('safehouse') };
    }
    if (cur.id === 'm4') {
      if (this.stage === 0) return { text: 'Steal the gold Marlin GT at Hotel Solmar', target: markerOf('hotel') };
      if (this.stage === 1) return { text: 'Deliver the GT to the Old Lighthouse (under 4 stars)', target: markerOf('lighthouse') };
      return { text: 'Vanish to the Safehouse', target: markerOf('safehouse') };
    }
    return { text: cur.brief, target: null };
  }

  update(dt, ctx) {
    const cur = this.current;
    if (!cur) return;
    const near = (t, r) => {
      if (!t) return false;
      const dx = ctx.player.x - t.x;
      const dz = ctx.player.z - t.z;
      return dx * dx + dz * dz < r * r;
    };
    if (cur.id === 'm2') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 240;
        this.packageIndex = 0;
        if (this.hooks.toast) this.hooks.toast('Client is furious — run the route again!');
        return;
      }
      const def = MISSIONS.find((m) => m.id === 'm2');
      const pkg = def.packages[this.packageIndex];
      if (near({ x: pkg[0], z: pkg[1] }, 7)) {
        this.packageIndex++;
        if (this.hooks.toast) this.hooks.toast(`Package ${this.packageIndex}/3 delivered`);
        if (this.hooks.blip) this.hooks.blip();
        if (this.packageIndex >= def.packages.length) this.complete('m2');
      }
      return;
    }
    if (cur.id === 'm3') {
      if (this.stage === 0 && ctx.police.wanted === 0) {
        this.stage = 1;
        if (this.hooks.toast) this.hooks.toast('Clean! Get to the Safehouse before they spot you again.');
      } else if (this.stage === 1 && near(markerOf('safehouse'), 9)) {
        this.complete('m3');
      }
      return;
    }
    if (cur.id === 'm4') {
      if (this.stage === 1 && near(markerOf('lighthouse'), 9)) {
        if (ctx.police.wanted < 4) {
          if (ctx.police.wanted <= 1) this.m4Bonus = true;
          this.stage = 2;
          if (this.hooks.toast) this.hooks.toast('Drop made. Now vanish to the Safehouse!');
        } else if (this.hooks.toast) {
          this.hooks.toast('Too hot! Lose a star before the drop.');
        }
      } else if (this.stage === 2 && near(markerOf('safehouse'), 9)) {
        this.complete('m4', this.m4Bonus);
      }
    }
  }

  // Taxi side job: a passenger waits on a road; drive them across town.
  updateTaxi(dt, ctx) {
    if (this.doneCount < 1) return;
    if (!this.taxi) {
      this.taxiCooldown -= dt;
      if (this.taxiCooldown <= 0) this._spawnTaxi();
      return;
    }
    const t = this.taxi;
    const near = (p, r) => {
      const dx = ctx.player.x - p.x;
      const dz = ctx.player.z - p.z;
      return dx * dx + dz * dz < r * r;
    };
    if (t.stage === 'pickup' && near(t.passenger, 6) && ctx.player.car) {
      t.stage = 'dropoff';
      if (this.hooks.toast) this.hooks.toast(`Passenger aboard — take them to (${t.dest.x}, ${t.dest.z})`);
    } else if (t.stage === 'dropoff' && near(t.dest, 9)) {
      if (this.hooks.award) this.hooks.award(t.fare);
      if (this.hooks.toast) this.hooks.toast(`Taxi fare +$${t.fare}`);
      this.taxi = null;
      this.taxiCooldown = 20;
    }
  }

  _spawnTaxi() {
    const roadPoint = () => {
      const road = pick(this.rng, GRID.roads);
      const along = -150 + this.rng() * 300;
      return this.rng() < 0.5 ? { x: road, z: along } : { x: along, z: road };
    };
    const passenger = roadPoint();
    let dest = roadPoint();
    while (Math.hypot(dest.x - passenger.x, dest.z - passenger.z) < 90) dest = roadPoint();
    this.taxi = {
      stage: 'pickup',
      passenger,
      dest,
      fare: TAXI.fareMin + Math.floor(this.rng() * (TAXI.fareMax - TAXI.fareMin)),
    };
    if (this.hooks.toast) this.hooks.toast('Taxi passenger waiting — look for the yellow marker.');
  }
}
