// Solmar Heat — save.js
// One clear job: saving and loading the game in localStorage.
const SAVE_KEY = 'solmar-heat-save-v1';

export function saveGame(state) {
  try {
    const data = {
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
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
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
