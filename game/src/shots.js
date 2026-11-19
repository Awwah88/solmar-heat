// Solmar Heat — screenshot staging for ?shot=. Each shot is a real render
// of the running game, staged in-session: the player is placed first,
// then the wanted level is set (police spawn near the player), then the
// mission is forced. The menu shot never calls showPlaying().
// cover: police chase in a car, mission 2, wanted 3, near the Casino.
// foot: on foot at a city intersection, mission 1.
// mission: courier run in the red sedan, package beacon ahead.
// menu: title screen over the orbiting city camera.
import { LANDMARKS } from './config.js';

export function applyShot(game) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return false;
  game.audio.ensure();
  if (shot === 'menu') {
    game.showMenu();
    return true;
  }
  game.startNewGame();
  if (shot === 'cover') {
    game.teleport(118, -54);
    game.player.heading = Math.PI / 2;
    game.missions.forceStage(2, 0);
    game.missions.delivered = new Set([0]);
    game.player.car = game.parked.redSedan;
    game.parked.redSedan.group.position.set(118, 0, -54);
    game.parked.redSedan.heading = Math.PI / 2;
    game.parked.redSedan.group.rotation.y = Math.PI / 2;
    game.player.mesh.visible = false;
    game.police.setWanted(3);
    game.money = 320;
  } else if (shot === 'foot') {
    game.teleport(54, 90);
    game.player.heading = Math.PI;
    game.missions.forceStage(1, 0);
    game.money = 40;
  } else if (shot === 'mission') {
    game.teleport(54, 90);
    game.player.heading = 0;
    game.missions.forceStage(2, 0);
    game.player.car = game.parked.redSedan;
    game.parked.redSedan.group.position.set(54, 0, 90);
    game.parked.redSedan.heading = 0;
    game.parked.redSedan.group.rotation.y = 0;
    game.player.mesh.visible = false;
    game.money = 175;
  } else if (shot === 'casino') {
    game.teleport(126, -54);
    game.player.heading = Math.PI / 2;
    game.missions.forceStage(5, 0);
    game.missions.setDone([1, 2, 3, 4]);
    game.money = 1150;
  }
  game.hud.showPlaying();
  return true;
}
