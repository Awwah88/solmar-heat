// Solmar Heat — save.js
// The save lives in localStorage as one small JSON blob. Everything here
// is defensive: a missing, corrupt or wrong-version save just reads as
// "no save", never as a crash. Only the story state is saved — money,
// missions, health, position and the pistol — never the traffic or the
// police, which respawn fresh on load.

const SAVE_KEY = 'solmar-heat-save-v1';

// Snapshot the parts of the game state a save needs to restore.
function snapshot(state) {
  return {
    version: 1,
    savedAt: Date.now(),
    money: Math.floor(state.money),
    missionsDone: state.missions.done.slice(),
    missionIndex: state.missions.index,
    health: Math.ceil(state.combat.health),
    playerX: state.player.pos.x,
    playerZ: state.player.pos.z,
    playerAngle: state.player.angle,
    armed: state.combat.armed,
    ammo: state.combat.ammo,
  };
}

export function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot(state)));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}
