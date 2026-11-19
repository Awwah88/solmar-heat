// Solmar Heat — screenshot staging.
// The shoot script loads the game once per shot with ?shot=<name>.
// Each scene is staged from a fresh run: position the player first,
// then set the wanted level (police spawn near the player), and only
// then show the playing screen. The menu shot never calls
// showPlaying() — it stays on the menu.

import { Car } from './vehicles.js';

export class ShotStager {
  constructor(world) {
    this.world = world;
  }

  _carAt(x, z, heading, color) {
    const w = this.world;
    const car = new Car(w.scene, { x, z, heading, color });
    w.parkedCars.push(car);
    w._enterCarDirect(car);
    w.player.heading = heading;
    return car;
  }

  stage(name) {
    const w = this.world;
    w.reset();
    if (name === 'cover') {
      // Wanted 3, mission 2, in a car, three cops closing in.
      this._carAt(18, 54, Math.PI / 2, 0xd23c2a);
      w.missions.setDone(['m1']);
      w.money = 150;
      w.missions.startMission(1);
      w.invulnerable = true;
      w.police.setWanted(3);
      w.police.spawnAt(44, 54);
      w.police.spawnAt(40, 48);
      w.police.spawnAt(42, 60);
      w.hud.showPlaying();
    } else if (name === 'foot') {
      // On foot on the road grid, mission 1, no heat.
      w.player.x = 18;
      w.player.z = 54;
      w.player.heading = Math.PI / 2;
      w.hud.showPlaying();
    } else if (name === 'mission') {
      // In a car on the courier run, mission 2, no heat.
      this._carAt(18, 54, Math.PI / 2, 0x2a6fd2);
      w.missions.setDone(['m1']);
      w.money = 150;
      w.missions.startMission(1);
      w.invulnerable = true;
      w.hud.showPlaying();
    } else if (name === 'menu') {
      // Menu shot only: stay on the menu screen.
      w.state = 'menu';
      w.hud.showMenu();
    }
  }
}
