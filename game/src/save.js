// localStorage save / load. The save holds money, mission progress,
// position and shells; it is written on mission completion and every
// 20 seconds of play.
const KEY = 'solmar-heat-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return s;
  } catch (e) { return null; }
}

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: Math.floor(state.money || 0),
      missionIndex: state.missionIndex || 0,
      health: Math.ceil(state.health || 100),
      x: state.x || 0,
      z: state.z || 0,
      shellsTaken: state.shellsTaken || 0,
      hasPistol: !!state.hasPistol,
      savedAt: Date.now(),
    }));
  } catch (e) { /* storage may be unavailable; the game goes on */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
