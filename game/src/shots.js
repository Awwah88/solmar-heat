// Solmar Heat — ?shot= staging for screenshots (Round 17).
// Each shot is a genuine render of the running game. Player position is
// set BEFORE setWanted() (police spawn near the player), and the menu shot
// never calls showPlaying().
import { LANDMARKS, PARKED } from './config.js';

export class Shots {
  constructor(game) {
    this.game = game;
  }

  apply(name) {
    const g = this.game;
    const putPlayer = (x, z, heading, inCarKind) => {
      g.player.x = x;
      g.player.z = z;
      g.player.heading = heading;
      if (inCarKind) {
        const car = g.parked.all.find((c) => c.kind === inCarKind) || g.traffic.cars[0];
        g.enterCar(car, true);
      }
      g.updateCamera(0);
    };
    if (name === 'cover') {
      // Dusk chase: in the armored van by the Bank, 4 stars, M6 live.
      putPlayer(54, 100, Math.PI, 'van');
      g.missions.startMission(6);
      g.missions.stage = 1;
      g.police.setWanted(4);
      g.missions.vaultProgress = 5;
      g.state = 'playing';
      g.hud.showPlaying();
    } else if (name === 'foot') {
      // On foot at the Marina, red sedan ahead, M1 objective.
      putPlayer(140, -126, Math.PI / 2, null);
      g.missions.startMission(1);
      g.police.setWanted(0);
      g.state = 'playing';
      g.hud.showPlaying();
    } else if (name === 'mission') {
      // M6 vault crack: van parked at the Bank dock, police closing in.
      g.parked.van.place(54, 138, 0);
      putPlayer(54, 138, 0, 'van');
      g.missions.startMission(6);
      g.missions.stage = 1;
      g.missions.vaultProgress = 6.5;
      g.police.setWanted(4);
      g.state = 'playing';
      g.hud.showPlaying();
    } else if (name === 'menu') {
      // Title screen over a slow city orbit — no playing state.
      g.state = 'menu';
      g.hud.showMenu();
      g.menuOrbit = true;
    }
  }
}
