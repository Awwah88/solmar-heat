// ?shot= staging for screenshots. Every scene is a real moment of the
// running game: the player is placed, the mission is set, and only then
// is the wanted level raised (police spawn near the player).
// The menu shot never starts the game — it stays on the title screen.
export function applyShot(game, params) {
  const shot = params.get('shot');
  if (!shot) return null;
  if (shot === 'menu') {
    // Title screen over the orbiting city. Do not start the game.
    return 'menu';
  }
  if (shot === 'foot') {
    game.startNewGame();
    // On foot on a busy street, Mission 1 live, traffic rolling past.
    game.teleport(18, 54, Math.PI);
    return 'foot';
  }
  if (shot === 'mission') {
    game.startNewGame();
    game.missions.setDone(['m1']);
    game.missions.startMission('m2');
    game.setMoney(150);
    // In a car on the east road, first package ahead.
    game.teleport(90, 126, Math.PI / 2);
    game.putPlayerInCarAt(90, 126, Math.PI / 2, 0x3b82f6);
    return 'mission';
  }
  if (shot === 'cover') {
    game.startNewGame();
    game.missions.setDone(['m1']);
    game.missions.startMission('m2');
    game.setMoney(150);
    // In a car on the palm-lined east road, heading for the Pier.
    game.teleport(162, 60, 0);
    game.putPlayerInCarAt(162, 60, 0, 0xd23b2e);
    // Position first, THEN the wanted level: police spawn around the player.
    game.police.setWanted(3, { x: 162, z: 60 });
    return 'cover';
  }
  return null;
}
