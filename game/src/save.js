// Solmar Heat — saving: a small JSON snapshot in localStorage, written on
// every mission completion and every twenty seconds of play. Loading is
// opt-in from the menu's Continue button.

const SAVE_KEY = 'solmar-heat-save-v1';

/** Write the current progress. Never throws — storage may be unavailable. */
export function saveGame(state) {
  try {
    const data = {
      version: 1,
      money: state.money,
      missionIndex: state.missionIndex,
      pistolOwned: state.pistolOwned,
      shellsTaken: state.shellsTaken,
      health: state.health,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Read the saved progress, or null when there is none or it is corrupt. */
export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return {
      money: typeof data.money === 'number' ? data.money : 0,
      missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
      pistolOwned: !!data.pistolOwned,
      shellsTaken: typeof data.shellsTaken === 'number' ? data.shellsTaken : 0,
      health: typeof data.health === 'number' ? data.health : 100,
    };
  } catch {
    return null;
  }
}

/** True when a save exists to continue from. */
export function hasSave() {
  return loadGame() !== null;
}

/** Wipe the save (used when the player starts a brand-new game). */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage may be unavailable; nothing to do.
  }
}
