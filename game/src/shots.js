// Solmar Heat — shots.js
// One clear job: stage the four screenshot scenes (?shot=menu|cover|foot|
// mission) using the real game systems — real driving, real police, real HUD
// — so every screenshot is a genuine render of the game being played.
// Driving routes follow road lines (waypoints on the grid), so the
// autopilot never cuts through a building, and police are placed where the
// camera can actually see them.
export function stageShot(name, game) {
  if (name === 'menu') {
    // Menu over a slow orbit of the city; the game has not started.
    game.state = 'menu';
    game.menuOrbit = true;
    game.hud.showMenu(true);
    return 'menu';
  }
  // All play shots start a fresh story run.
  game.startNewGame(true);
  if (name === 'foot') {
    // On foot on the north road, walking toward the city with traffic.
    game.player.pos.set(40, 0, 150);
    game.player.angle = Math.PI;
    game.cameraYaw = 0;
    game.autopilot = { waypoints: [{ x: 40, z: 100 }], until: performance.now() + 6000, onFoot: true };
    return 'foot';
  }
  if (name === 'mission') {
    // Mission 2 in progress: driving the courier route east, then south to
    // the Pier along road lines.
    game.missions.done[0] = true;
    game.missions.index = 1;
    game.missions.setObjective();
    game.enterCar(game.redCar);
    game.player.car.pos.set(-60, 0, 160);
    game.player.car.angle = Math.PI / 2;
    game.player.car.speed = 12;
    game.autopilot = { waypoints: [{ x: 60, z: 160 }, { x: 60, z: 200 }], until: performance.now() + 8000 };
    return 'mission';
  }
  // Default: cover — a police chase. Player in the red sports car, 3 stars,
  // courier mission live on the HUD, one police car closing in head-on and
  // one crossing at the next intersection.
  game.missions.done[0] = true;
  game.missions.index = 1;
  game.missions.setObjective();
  game.enterCar(game.redCar);
  game.player.car.pos.set(-60, 0, 160);
  game.player.car.angle = Math.PI / 2;
  game.player.car.speed = 12;
  game.police.addWanted(3, 'cover');
  game.police.spawnPoliceCar(30, 160, -Math.PI / 2);
  game.police.spawnPoliceCar(60, 120, Math.PI);
  game.autopilot = { waypoints: [{ x: 60, z: 160 }, { x: 60, z: 200 }], until: performance.now() + 8000 };
  return 'cover';
}
