// Solmar Heat — saving to localStorage.
// The game never auto-loads: a save only comes back when the player picks
// CONTINUE on the start screen, so a fresh playthrough always starts clean.

const SAVE_KEY = 'solmar-heat-save-v1';

export class SaveSystem {
  constructor(game) {
    this.game = game;
    this.lastSaveAt = 0;
  }

  // What the save holds: money, health, mission progress and where the
  // player stands, plus the taxi jobs finished. Nothing secret.
  snapshot() {
    const g = this.game;
    return {
      version: 1,
      savedAt: Date.now(),
      money: Math.floor(g.money),
      health: Math.ceil(g.combat.health),
      wanted: g.police.wanted,
      hasPistol: g.combat.hasPistol,
      missionsDone: g.missions.done.slice(),
      missionIndex: g.missions.index,
      packageIndex: g.missions.packageIndex,
      taxiJobs: g.missions.taxiJobs,
      player: {
        x: g.player.pos.x,
        z: g.player.pos.z,
        heading: g.player.heading,
        inCar: !!g.player.car,
      },
    };
  }

  save() {
    try {
      const data = this.snapshot();
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.lastSaveAt = performance.now();
      return true;
    } catch {
      return false;
    }
  }

  load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== 1) return null;
      return data;
    } catch {
      return null;
    }
  }

  hasSave() {
    return this.load() !== null;
  }

  clear() {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // Storage unavailable; nothing to clear.
    }
  }

  // Apply a loaded save to the running game.
  apply(data) {
    const g = this.game;
    g.money = data.money;
    g.combat.health = data.health;
    g.combat.hasPistol = !!data.hasPistol;
    g.missions.done = data.missionsDone.slice(0, 3);
    while (g.missions.done.length < 3) g.missions.done.push(false);
    g.missions.index = Math.min(2, data.missionIndex || 0);
    g.missions.packageIndex = data.packageIndex || 0;
    g.missions.taxiJobs = data.taxiJobs || 0;
    if (g.missions.index === 1) g.missions.timer = 240;
    g.police.setWanted(data.wanted || 0);
    g.player.pos.set(data.player.x, 0, data.player.z);
    g.player.heading = data.player.heading || 0;
    g.missions.refreshObjective();
    g.hud.refresh();
  }

  // Called every frame; autosaves quietly while the player is playing.
  update(now) {
    if (this.game.state !== 'playing') return;
    if (now - this.lastSaveAt > 15000) this.save();
  }
}
