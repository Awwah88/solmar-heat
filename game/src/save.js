// localStorage save for Solmar Heat: money, health, missions done, player
// spot and play time. Autosaves during play; loads from the menu.

const KEY = 'solmar-heat-save-v1';

export class SaveSystem {
  constructor() {
    this.key = KEY;
  }

  save(data) {
    try {
      const payload = {
        v: 1,
        savedAt: Date.now(),
        money: Math.floor(data.money),
        health: Math.round(data.health),
        score: data.score || 0,
        missionsDone: data.missionsDone || [],
        player: { x: data.player.x, z: data.player.z, heading: data.player.heading },
        hasPistol: !!data.hasPistol,
        playSeconds: Math.floor(data.playSeconds || 0),
      };
      localStorage.setItem(this.key, JSON.stringify(payload));
      return true;
    } catch (e) {
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== 1) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  hasSave() {
    return this.load() !== null;
  }

  clear() {
    try {
      localStorage.removeItem(this.key);
    } catch (e) {
      /* storage unavailable */
    }
  }
}
