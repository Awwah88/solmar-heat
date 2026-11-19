// ?shot= staging for Solmar Heat screenshots: real gameplay states, staged
// from the running game. Player position is always set BEFORE wanted, so
// police spawn near the player. The menu shot never leaves the menu state.

export function stageShot(game, name) {
  const g = game;
  if (name === 'menu') {
    // Leave the game on the start screen with the orbit camera; do not
    // call showPlaying() here.
    return;
  }
  if (name === 'cover') {
    // Police chase down a palm-lined road: in the red sedan, M2 active,
    // 3 stars, cruisers closing in.
    g.teleportPlayer(108, -126, Math.PI / 2);
    g.enterCar(g.parked.redSedan);
    g.missions.setDone([1]);
    g.missions.startMission(g.missions.current);
    g.setWanted(3);
    g.showPlaying();
    return;
  }
  if (name === 'foot') {
    // On foot at a downtown intersection, M1 active, traffic passing.
    g.teleportPlayer(54, -90, Math.PI);
    g.missions.setDone([]);
    g.missions.startMission(g.missions.current);
    g.setWanted(0);
    g.showPlaying();
    return;
  }
  if (name === 'mission') {
    // Courier run: in the car, M2 with one package already delivered,
    // 2 stars, heading for the next drop.
    g.teleportPlayer(90, 18, Math.PI / 2);
    g.enterCar(g.parked.redSedan);
    g.missions.setDone([1]);
    g.missions.startMission(g.missions.current);
    g.missions.delivered.add(0);
    g.setWanted(2);
    g.showPlaying();
    return;
  }
  // Unknown shot name: just play.
  g.showPlaying();
}
