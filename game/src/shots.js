// Solmar Heat — staged scenes for screenshots.
// ?shot=cover|foot|mission|menu (with &seed=1) drops the running game into
// a real gameplay state for the shot: no fake renders, the same world the
// player drives in, posed so each system reads at a glance. In shot mode
// the police cannot hurt the player and the mission clock is frozen, so a
// slow headless render still catches the scene intact.

export function readShotParams() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || 0) || 0;
  return { shot, seed };
}

export function applyShot(game, shot) {
  if (!shot) return false;
  game.shotMode = shot;
  const g = game;
  if (shot === 'menu') {
    g.state = 'menu';
    g.hud.showScreen('menu');
    return true;
  }
  // Every other shot starts the story for real, then poses it.
  g.startStory(true);
  if (shot === 'cover') {
    // A three-star chase mid-courier: in a car, wanted 3, police closing.
    g.missions.index = 1;
    g.missions.done = [false, false, false];
    g.missions.packageIndex = 1;
    g.missions.timer = 180;
    g.money = 450;
    g.enterCar(g.redCar);
    g.redCar.pos.set(80, 0, 40);
    g.redCar.setHeading(Math.PI);
    g.redCar.speed = 12;
    g.player.pos.set(80, 0, 40);
    g.player.heading = Math.PI;
    g.police.setWanted(3);
    g.missions.refreshObjective();
  } else if (shot === 'foot') {
    // On foot at a city intersection, first mission, no heat.
    g.missions.index = 0;
    g.missions.done = [false, false, false];
    g.player.pos.set(40, 0, -40);
    g.player.heading = Math.PI / 4;
    g.police.setWanted(0);
    g.missions.refreshObjective();
  } else if (shot === 'mission') {
    // Courier run to the Pier, two stars, police in pursuit.
    g.missions.index = 1;
    g.missions.done = [false, false, false];
    g.missions.packageIndex = 0;
    g.missions.timer = 210;
    g.money = 200;
    g.enterCar(g.redCar);
    g.redCar.pos.set(60, 0, 168);
    g.redCar.setHeading(0);
    g.redCar.speed = 14;
    g.player.pos.set(60, 0, 168);
    g.player.heading = 0;
    g.police.setWanted(2);
    g.missions.refreshObjective();
  } else {
    return false;
  }
  g.hud.refresh();
  return true;
}
