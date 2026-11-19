// ?shot= staging: puts the running game into the exact scene each
// screenshot needs. Position the player FIRST, then set wanted (police
// spawn around the player). The menu shot never starts the game.
import { GOLD_GT } from "./config.js";

export function stageShot(game, params) {
  const shot = params.get("shot");
  if (!shot) return false;
  if (shot === "menu") {
    // Title screen over the orbiting city. Do not start the game.
    return true;
  }
  if (shot === "cover") {
    game.startNew();
    game.missions.setCurrent(1);
    game.teleport(96, -84, Math.PI * 0.9);
    game.spawnPlayerCar(0xc22a1e, 96, -84, Math.PI * 0.9);
    game.setWanted(3);
    return true;
  }
  if (shot === "foot") {
    game.startNew();
    game.missions.setCurrent(0);
    game.teleport(90, -118, 0.15);
    return true;
  }
  if (shot === "mission") {
    game.startNew();
    game.missions.setCurrent(1);
    game.teleport(126, 62, Math.PI);
    game.spawnPlayerCar(0x3a6ad8, 126, 62, Math.PI);
    game.setWanted(1);
    return true;
  }
  return false;
}

export function goldGtPos() {
  return GOLD_GT;
}
