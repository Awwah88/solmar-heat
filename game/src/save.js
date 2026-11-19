// localStorage save / load / autosave. Nothing leaves the browser.
const KEY = 'solmar-heat-v1';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      health: state.health,
      done: state.done,
      pistol: state.pistol,
      x: state.x,
      z: state.z,
      heading: state.heading,
      wanted: state.wanted,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || !Array.isArray(data.done)) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (err) { /* silent */ }
}

export function hasSave() {
  return loadGame() !== null;
}
