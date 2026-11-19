// Solmar Heat — localStorage save / autosave. Persists money, health,
// completed missions (including new-in-R16 Mission 5), doubloon
// collectibles, the taxi fare streak, pistol ownership and the player's
// last position, so a reload resumes the run instead of restarting it.
import { SAVE_KEY } from './config.js';

export class SaveManager {
  constructor(game) {
    this.game = game;
    this.lastSave = 0;
  }
  save() {
    try {
      const g = this.game;
      const p = g.playerPos();
      const data = {
        version: 16,
        money: Math.floor(g.money),
        health: Math.round(g.health),
        doneIds: [...g.missions.doneIds],
        currentId: g.missions.current ? g.missions.current.id : null,
        stage: g.missions.stage,
        doubloons: [...g.missions.doubloons.collected],
        fareStreak: g.missions.taxi.streak,
        faresDone: g.missions.taxi.done,
        hasPistol: g.combat.hasPistol,
        x: p.x,
        z: p.z,
        savedAt: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.lastSave = 0;
      return true;
    } catch (e) { return false; }
  }
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== 16) return null;
      return data;
    } catch (e) { return null; }
  }
  apply(data) {
    const g = this.game;
    g.money = data.money || 0;
    g.health = data.health || 100;
    g.combat.hasPistol = !!data.hasPistol;
    g.missions.setDone(data.doneIds || []);
    if (data.currentId && !g.missions.doneIds.includes(data.currentId)) {
      g.missions.startMission(data.currentId, data.stage || 0);
    }
    g.missions.doubloons.collected = new Set(data.doubloons || []);
    g.missions.taxi.streak = data.fareStreak || 0;
    g.missions.taxi.done = data.faresDone || 0;
    g.missions.refreshDoubloonMeshes();
    if (typeof data.x === 'number') g.teleport(data.x, data.z);
  }
  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }
  autosave(dt) {
    this.lastSave += dt * 1000;
    if (this.lastSave > 15000) {
      this.lastSave = 0;
      this.save();
    }
  }
}
