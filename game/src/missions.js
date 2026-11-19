// Story missions and the taxi side job for Solmar Heat.
// Mission progress is only ever changed through setDone(), which keeps the
// earned-rewards counter in sync (never assign .done directly).

import { LANDMARKS, MISSIONS, PACKAGES, TUNING } from './config.js';

function marker(id) {
  const lm = LANDMARKS.find((l) => l.id === id);
  return lm ? lm.marker : [0, 0];
}

export class Missions {
  constructor(hooks) {
    this.hooks = hooks; // {addMoney, setWanted, grantPistol, toast, sound, onWin}
    this.list = MISSIONS.map((m) => ({ ...m, done: false }));
    this.current = this.list[0];
    this.stage = 0;
    this.timer = 0;
    this.delivered = new Set();
    this.earned = 0;
    this.taxi = { active: false, stage: 0, pickup: null, dropoff: null, reward: 0, timer: 0, ped: null };
  }

  // The only way to change .done: pass the full list of completed mission ids.
  setDone(doneIds) {
    for (const m of this.list) m.done = doneIds.includes(m.id);
    this.earned = this.list.filter((m) => m.done).reduce((s, m) => s + m.reward, 0);
    this.current = this.list.find((m) => !m.done) || null;
  }

  get doneIds() {
    return this.list.filter((m) => m.done).map((m) => m.id);
  }

  get doneCount() {
    return this.list.filter((m) => m.done).length;
  }

  startMission(m) {
    this.stage = 0;
    if (m.id === 2) {
      this.timer = m.time;
      this.delivered = new Set();
    }
    if (m.id === 3) {
      this.hooks.setWanted(3);
      this.hooks.toast('The heat is on — 3 stars. Lose them, then reach the Safehouse.');
    }
    if (m.id === 4) {
      this.hooks.toast('Steal the gold Marlin GT at Hotel Solmar.');
    }
  }

  completeCurrent() {
    const m = this.current;
    if (!m) return;
    this.hooks.addMoney(m.reward);
    this.hooks.sound('missionDone');
    this.hooks.toast(`${m.title} complete — +$${m.reward}`);
    this.setDone([...this.doneIds, m.id]);
    if (m.id === 2) this.hooks.grantPistol();
    if (this.current) this.startMission(this.current);
    else this.hooks.onWin();
  }

  objective() {
    const m = this.current;
    if (!m) return 'Debt paid — you are a Solmar Legend.';
    if (m.id === 1) return 'Steal the red sedan by the Marina Garage';
    if (m.id === 2) {
      const left = Math.max(0, Math.ceil(this.timer));
      const mm = Math.floor(left / 60);
      const ss = String(left % 60).padStart(2, '0');
      return `Deliver packages — ${this.delivered.size}/3  (${mm}:${ss})`;
    }
    if (m.id === 3) return 'Lose the heat, then reach the Safehouse';
    if (m.id === 4) {
      if (this.stage === 0) return 'Steal the gold Marlin GT at Hotel Solmar';
      if (this.stage === 1) return 'Deliver the Marlin GT to the Old Lighthouse — stay under 4 stars';
      return 'Escape to the Safehouse';
    }
    return m.brief;
  }

  startTaxi(ped, from, to, reward) {
    this.taxi = { active: true, stage: 0, pickup: from, dropoff: to, reward, timer: 150, ped };
    this.hooks.toast(`Taxi fare — pick up the passenger, then drop them at ${to.name}.`);
  }

  cancelTaxi(reason) {
    if (!this.taxi.active) return;
    this.taxi.active = false;
    if (this.taxi.ped) this.taxi.ped.state = 'walk';
    this.hooks.toast(reason || 'Taxi fare cancelled.');
  }

  update(dt, w) {
    // w: {x, z, inCar, car, wanted, redSedan, goldGt}
    const m = this.current;
    if (m) {
      if (m.id === 1) {
        if (w.inCar && w.car === w.redSedan) this.completeCurrent();
      } else if (m.id === 2) {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = m.time;
          this.delivered = new Set();
          this.hooks.toast('Time up — the packages reset. Try again.');
        } else {
          PACKAGES.forEach(([px, pz], i) => {
            if (this.delivered.has(i)) return;
            const d = Math.hypot(w.x - px, w.z - pz);
            if (d < 5) {
              this.delivered.add(i);
              this.hooks.toast(`Package ${this.delivered.size}/3 delivered`);
              this.hooks.sound('pickup');
              if (this.delivered.size === 3) this.completeCurrent();
            }
          });
        }
      } else if (m.id === 3) {
        const [sx, sz] = marker('safehouse');
        if (w.wanted === 0 && Math.hypot(w.x - sx, w.z - sz) < 8) this.completeCurrent();
      } else if (m.id === 4) {
        if (this.stage === 0) {
          if (w.inCar && w.car === w.goldGt) {
            this.stage = 1;
            this.hooks.toast('Got the Marlin GT — take it to the Old Lighthouse, under 4 stars.');
          }
        } else if (this.stage === 1) {
          const [lx, lz] = marker('lighthouse');
          if (w.inCar && w.car === w.goldGt && Math.hypot(w.x - lx, w.z - lz) < 9) {
            if (w.wanted < 4) {
              this.stage = 2;
              this.hooks.toast('Drop made. Now escape to the Safehouse.');
            } else {
              this.hooks.toast('Too hot — get under 4 stars before the drop.');
            }
          }
        } else if (this.stage === 2) {
          const [sx, sz] = marker('safehouse');
          if (Math.hypot(w.x - sx, w.z - sz) < 8) this.completeCurrent();
        }
      }
    }
    // Taxi fare.
    const t = this.taxi;
    if (t.active) {
      t.timer -= dt;
      if (t.timer <= 0) {
        this.cancelTaxi('Taxi fare expired.');
      } else if (t.stage === 0) {
        if (w.inCar && Math.hypot(w.x - t.pickup[0], w.z - t.pickup[1]) < 5) {
          t.stage = 1;
          if (t.ped) t.ped.group.visible = false;
          this.hooks.toast(`Passenger aboard — drop them at ${t.dropoff.name}.`);
        }
      } else if (t.stage === 1) {
        if (Math.hypot(w.x - t.dropoff.marker[0], w.z - t.dropoff.marker[1]) < 8) {
          this.hooks.addMoney(t.reward);
          this.hooks.sound('pickup');
          this.hooks.toast(`Fare complete — +$${t.reward}`);
          this.taxi.active = false;
        }
      }
    }
  }
}
