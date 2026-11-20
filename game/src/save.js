// Solmar Heat — localStorage save/load (Round 17).
// Persists money, health, mission progress, M6/race/doubloon state and the
// taxi streak. Saves are best-effort: a corrupt or missing save just starts
// a fresh game.
const KEY = 'solmar-heat-r17';

export class SaveSys {
  constructor(game) {
    this.game = game;
  }

  save() {
    try {
      const g = this.game;
      const data = {
        money: Math.floor(g.money),
        health: Math.round(g.health),
        missions: g.missions.getSaveData(),
        player: { x: g.playerPos().x, z: g.playerPos().z, heading: g.playerHeading() },
        savedAt: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable — ignore */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) { /* ignore */ }
  }

  apply(data) {
    if (!data) return;
    const g = this.game;
    if (typeof data.money === 'number') g.money = data.money;
    if (typeof data.health === 'number') g.health = data.health;
    if (data.missions) g.missions.applySave(data.missions);
    if (data.player) {
      g.player.x = data.player.x;
      g.player.z = data.player.z;
      g.player.heading = data.player.heading || 0;
    }
  }
}
