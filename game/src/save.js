// localStorage save / autosave. The save stores the mission state (done
// list + bonus), health, position and the cash counters; loading restores
// them through Missions.setDone so a mission can never pay twice.
const KEY = "solmar-heat-save-v1";

export class Save {
  has() {
    try {
      return !!window.localStorage.getItem(KEY);
    } catch {
      return false;
    }
  }

  save(game) {
    try {
      const data = {
        v: 1,
        done: game.missions.done,
        bonus: game.missions.bonus,
        health: game.combat.health,
        pistol: game.combat.pistol,
        x: game.player.x,
        z: game.player.z,
        heading: game.player.heading,
        pickupCash: game.pickupCash,
        sprayPaid: game.sprayPaid,
        fines: game.fines,
        taken: game.pickups.map((p) => p.taken),
        savedAt: Date.now(),
      };
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // storage may be unavailable in some contexts; the game plays on
    }
  }

  load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== 1 || !Array.isArray(data.done)) return null;
      return data;
    } catch {
      return null;
    }
  }

  clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }
}
