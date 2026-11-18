// Solmar Heat — combat: fists on foot, and the pistol Dana earns in Mission 2.
// Shooting is a short-range cone check with a muzzle flash; punching knocks
// a nearby pedestrian down. No ammo tracking — the streets are generous.

import * as THREE from 'three';
import { CONFIG, dist2d, wrapAngle } from './config.js';

/** Create the combat system. `game` is the shared game object. */
export function createCombat(scene, game) {
  let pistolOwned = false;
  let lastShotAt = 0;
  let lastPunchAt = 0;

  // Muzzle flash: a small bright sprite that lives for one blink.
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0 });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), flashMat);
  flash.visible = false;
  scene.add(flash);
  let flashUntil = 0;

  return {
    get pistolOwned() {
      return pistolOwned;
    },
    givePistol() {
      pistolOwned = true;
    },

    /** Punch the nearest pedestrian within arm's reach. */
    punch(time) {
      if (time - lastPunchAt < 0.45) return false;
      lastPunchAt = time;
      const p = game.playerPos();
      const hit = game.pedestrians.knockDown(p.x, p.z, 2.0, time);
      game.audio.punch();
      return hit;
    },

    /** Fire the pistol toward the aim direction. */
    shoot(time) {
      if (!pistolOwned) return false;
      if (time - lastShotAt < 0.28) return false;
      lastShotAt = time;
      const p = game.playerPos();
      const aim = game.playerHeading();
      const range = 26;
      // Muzzle flash at the shooter's hand.
      flash.position.set(p.x + Math.sin(aim) * 1.2, 1.3, p.z + Math.cos(aim) * 1.2);
      flash.visible = true;
      flashMat.opacity = 1;
      flashUntil = time + 0.07;
      game.audio.shot();

      // Hit the nearest pedestrian or traffic driver inside the cone.
      let best = null;
      let bestD = range;
      for (const ped of game.pedestrians.peds) {
        if (time < ped.downUntil) continue;
        const pos = ped.group.position;
        const d = dist2d(pos.x, pos.z, p.x, p.z);
        if (d > bestD) continue;
        const ang = Math.abs(wrapAngle(Math.atan2(pos.x - p.x, pos.z - p.z) - aim));
        if (ang < 0.35) {
          bestD = d;
          best = { kind: 'ped', target: ped };
        }
      }
      for (const car of game.traffic.cars) {
        const pos = car.group.position;
        const d = dist2d(pos.x, pos.z, p.x, p.z);
        if (d > bestD) continue;
        const ang = Math.abs(wrapAngle(Math.atan2(pos.x - p.x, pos.z - p.z) - aim));
        if (ang < 0.3) {
          bestD = d;
          best = { kind: 'car', target: car };
        }
      }
      if (best) {
        if (best.kind === 'ped') {
          best.target.downUntil = time + 4;
        } else {
          // A shot driver bails: the car stops and the driver flees.
          best.target.cruiseSpeed = 0;
          setTimeout(() => { best.target.cruiseSpeed = CONFIG.traffic.speed; }, 4000);
        }
        game.police.addWanted(1);
        return true;
      }
      return false;
    },

    update(dt, time, camera) {
      if (flash.visible) {
        flash.lookAt(camera.position);
        if (time > flashUntil) {
          flash.visible = false;
          flashMat.opacity = 0;
        }
      }
      void dt;
    },
  };
}
