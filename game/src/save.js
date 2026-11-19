// Solmar Heat — localStorage save. Autosaves while playing and on
// every mission completion. Loading restores money, health, the
// completed-mission list (through Missions.setDone so the reward
// counter stays in sync) and the player's position.

const KEY = 'solmar-heat-save-v1';

export class SaveManager {
  write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        version: 1, ...data, savedAt: Date.now(),
      }));
      return true;
    } catch (err) {
      return false;
    }
  }

  read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== 1) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch (err) { /* storage unavailable */ }
  }

  hasSave() {
    return this.read() !== null;
  }
}
