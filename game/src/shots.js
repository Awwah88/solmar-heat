// ?shot= staging: genuine gameplay states framed for the four
// screenshots. The police are frozen and toasts suppressed while a shot
// is staged, so the frame stays clean.
//
// cover  — sunset chase on the beach road: player in a car at (60,172),
//          3 stars, Mission 2, three cruisers in frame.
// foot   — Dana on foot at an intersection, Mission 1.
// mission— courier run: player car on clear road x=54 heading south
//          toward the Pier, camera low behind the car.
// menu   — title screen over the orbiting city.
import { CFG } from './config.js';
import { makeCar } from './vehicles.js';

export function stageShot(G) {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  G.shotMode = shot;

  const place = (car, x, z, heading) => {
    car.place(x, z, heading);
    car.speed = 0;
  };

  if (shot === 'menu') {
    G.state = 'menu';
    return 'menu';
  }

  // A red car for the player in every gameplay shot.
  const playerCar = makeCar(0xc0392b);
  G.scene.add(playerCar.group);

  if (shot === 'cover') {
    G.state = 'playing';
    G.money = 450;
    G.health = 100;
    G.missions.missionIndex = 1;
    G.missions.current = { title: CFG.missions[1].title };
    G.missions.packageIdx = 1;
    G.missions.timer = 180;
    G.missions.marker = { x: CFG.landmarks.pier.marker.x, z: CFG.landmarks.pier.marker.z };
    G.police.setWanted(3);
    place(playerCar, 60, 172, 0);
    G.player.car = playerCar;
    G.player.pos = { x: 60, z: 172 };
    G.player.heading = 0;
    // Three cruisers, all in frame: two flanking ahead, one behind the
    // player — NOT at (60,196), where the Pier deck hides it, and NOT
    // at (60,168), where it stands exactly between the camera and the
    // red player car and hides that instead. (66,167) is off-axis.
    const spots = [[42, 182], [78, 182], [66, 167]];
    for (const [x, z] of spots) {
      const cop = makeCar(0x1a1a22, { police: true });
      cop.place(x, z, Math.PI);
      G.scene.add(cop.group);
      G.police.policeCars.push(cop);
    }
    G.shotCamera = { pos: [60, 14, 148], look: [60, 1, 186] };
    return 'cover';
  }

  if (shot === 'foot') {
    G.state = 'playing';
    G.money = 0;
    G.health = 100;
    G.missions.missionIndex = 0;
    G.missions.current = { title: CFG.missions[0].title };
    G.missions.marker = { x: CFG.landmarks.garage.marker.x, z: CFG.landmarks.garage.marker.z };
    G.player.car = null;
    G.player.pos = { x: 18, z: 18 };
    G.player.heading = Math.PI / 4;
    G.scene.remove(playerCar.group);
    G.shotCamera = { pos: [10, 4.5, 8], look: [18, 1.5, 18] };
    return 'foot';
  }

  if (shot === 'mission') {
    G.state = 'playing';
    G.money = 450;
    G.health = 100;
    G.missions.missionIndex = 1;
    G.missions.current = { title: CFG.missions[1].title };
    G.missions.packageIdx = 1;
    G.missions.timer = 180;
    G.missions.marker = { x: CFG.landmarks.pier.marker.x, z: CFG.landmarks.pier.marker.z };
    G.police.setWanted(2);
    place(playerCar, 54, 162, 0);
    G.player.car = playerCar;
    G.player.pos = { x: 54, z: 162 };
    G.player.heading = 0;
    // One cruiser behind the camera so it does not block the frame.
    const cop = makeCar(0x1a1a22, { police: true });
    cop.place(54, 136, 0);
    G.scene.add(cop.group);
    G.police.policeCars.push(cop);
    G.shotCamera = { pos: [54, 7.5, 147], look: [60, 1, 190] };
    return 'mission';
  }
  return null;
}
