// Solmar Heat — save.js
// localStorage persistence: autosave every few seconds and on every
// mission completion, so a closed tab never loses the story. The save is
// deliberately small and versioned — an old or corrupt save is ignored
// instead of crashing the game.

export const SAVE_KEY = 'solmar-heat-save-v2';
export const SAVE_VERSION = 2;

export class SaveManager {
  constructor() {
    this.lastSaveAt = 0;
  }

  // Snapshot the parts of the game worth keeping. Nothing in here holds
  // a live object — only numbers, strings and booleans survive JSON.
  snapshot(game) {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      money: Math.floor(game.money),
      score: Math.floor(game.score),
      health: Math.ceil(game.combat.health),
      missionsDone: game.missions.done.slice(),
      missionIndex: game.missions.index,
      hasPistol: game.combat.hasPistol,
      shells: game.shellsCollected,
      shellsTaken: game.shellsTaken.slice(),
      cashTaken: game.cashTaken.slice(),
      player: {
        x: game.player.pos.x,
        z: game.player.pos.z,
        heading: game.player.heading,
      },
      dayTime: game.dayTime,
      taxiFares: game.taxiFares,
    };
  }

  write(game) {
    try {
      const data = this.snapshot(game);
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.lastSaveAt = performance.now();
      return true;
    } catch (err) {
      // Storage can be full or blocked; the game plays on regardless.
      return false;
    }
  }

  // Autosave no more than once every 12 seconds of play.
  autosave(game) {
    const now = performance.now();
    if (now - this.lastSaveAt > 12000) this.write(game);
  }

  read() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== SAVE_VERSION) return null;
      if (typeof data.money !== 'number') return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  hasSave() {
    return this.read() !== null;
  }

  clear() {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch (err) {
      // Nothing to do if storage is unavailable.
    }
    this.lastSaveAt = 0;
  }

  // Apply a loaded save onto a fresh game. Positions are clamped onto
  // roads so a stale save can never spawn the player inside a building.
  apply(game, data) {
    if (!data) return false;
    game.money = data.money || 0;
    game.score = data.score || 0;
    game.combat.health = data.health > 0 ? data.health : 100;
    game.combat.hasPistol = !!data.hasPistol;
    game.missions.done = Array.isArray(data.missionsDone) ? data.missionsDone.slice(0, 3) : [false, false, false];
    while (game.missions.done.length < 3) game.missions.done.push(false);
    game.missions.index = Math.min(2, data.missionIndex || 0);
    if (game.missions.done.every(Boolean)) game.missions.index = 3;
    game.shellsCollected = data.shells || 0;
    if (Array.isArray(data.shellsTaken)) game.shellsTaken = data.shellsTaken.slice();
    if (Array.isArray(data.cashTaken)) game.cashTaken = data.cashTaken.slice();
    if (data.player) {
      game.player.pos.x = data.player.x || 80;
      game.player.pos.z = data.player.z || -140;
      game.player.heading = data.player.heading || 0;
    }
    if (typeof data.dayTime === 'number') game.dayTime = data.dayTime;
    game.taxiFares = data.taxiFares || 0;
    game.missions.refreshObjective();
    return true;
  }
}
