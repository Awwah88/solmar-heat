// Solmar Heat — the law: wanted stars, police cruisers that chase and ram,
// Busted when they corner the player, and the heat cooling off.
// FIX (learned the hard way): after a cruiser rams the player it backs off
// for 1.5s instead of grinding the player to a halt.

import * as THREE from 'three';
import { CONFIG, clamp, wrapAngle, dist2d } from './config.js';
import { makeCar } from './vehicles.js';

/** Create the police system. `game` is the shared game object. */
export function createPolice(scene, game) {
  const policeCars = [];
  let wanted = 0;
  let bustedTimer = 0;
  let decayTimer = 0;
  let frozen = false;

  function spawnCruiser() {
    const p = game.playerPos();
    const angle = Math.random() * Math.PI * 2;
    const x = clamp(p.x + Math.cos(angle) * 55, -180, 180);
    const z = clamp(p.z + Math.sin(angle) * 55, -180, 180);
    const car = makeCar(scene, CONFIG.colors.police, x, z, Math.atan2(p.x - x, p.z - z), { police: true });
    car.ramAt = 0;
    car.backoffUntil = 0;
    policeCars.push(car);
    return car;
  }

  function removeCruiser(car) {
    scene.remove(car.group);
    const i = policeCars.indexOf(car);
    if (i >= 0) policeCars.splice(i, 1);
  }

  return {
    policeCars,
    get wanted() {
      return wanted;
    },
    set wanted(n) {
      wanted = clamp(Math.round(n), 0, 5);
    },
    get frozen() {
      return frozen;
    },
    set frozen(v) {
      frozen = v;
    },

    addWanted(n) {
      wanted = clamp(wanted + n, 0, 5);
    },

    clearWanted() {
      wanted = 0;
    },

    update(dt, time) {
      if (frozen) return;
      const player = game.player;
      const playerCar = player.car;
      const pPos = game.playerPos();
      const pSpeed = playerCar ? Math.abs(playerCar.speed) : 0;

      // Keep the cruiser count in step with the wanted level.
      const want = wanted === 0 ? 0 : Math.min(wanted, CONFIG.police.maxCruisers);
      while (policeCars.length < want) spawnCruiser();
      while (policeCars.length > want) removeCruiser(policeCars[policeCars.length - 1]);

      let nearest = 999;
      for (const car of policeCars) {
        const pos = car.group.position;
        const d = dist2d(pos.x, pos.z, pPos.x, pPos.z);
        if (d < nearest) nearest = d;

        if (time < car.backoffUntil) {
          // FIX: back off after a ram — reverse away instead of grinding.
          car.speed = -9;
          pos.x += Math.sin(car.heading) * car.speed * dt;
          pos.z += Math.cos(car.heading) * car.speed * dt;
          continue;
        }

        // Chase: steer toward the player, a little faster than the player.
        const targetHeading = Math.atan2(pPos.x - pos.x, pPos.z - pos.z);
        const dh = wrapAngle(targetHeading - car.heading);
        car.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
        car.group.rotation.y = car.heading;
        const chase = Math.min(CONFIG.police.chaseSpeed, 26 + wanted * 4 + d * 0.06);
        car.speed += (chase - car.speed) * Math.min(1, 1.4 * dt);
        pos.x += Math.sin(car.heading) * car.speed * dt;
        pos.z += Math.cos(car.heading) * car.speed * dt;
        const b = CONFIG.world.bounds;
        pos.x = clamp(pos.x, -b, b);
        pos.z = clamp(pos.z, -b, b);

        // Ram: close and fast means damage, then back off.
        if (d < 3.2 && time - car.ramAt > CONFIG.police.ramCooldown) {
          car.ramAt = time;
          car.backoffUntil = time + CONFIG.police.ramBackoff;
          game.damagePlayer(CONFIG.police.ramDamage, 'ram');
          game.audio.crash();
          // Shove the player's car a little so the hit reads on screen.
          if (playerCar) {
            playerCar.speed *= 0.55;
          }
        }
      }

      // Busted: slow or stopped with a cruiser right on top of the player.
      if (wanted > 0 && nearest < CONFIG.police.bustedRange && pSpeed < 1.2) {
        bustedTimer += dt;
        if (bustedTimer > CONFIG.police.bustedHold) {
          bustedTimer = 0;
          game.busted();
        }
      } else {
        bustedTimer = 0;
      }

      // The heat cools off when no cruiser is anywhere near.
      if (wanted > 0 && nearest > CONFIG.police.decayRange) {
        decayTimer += dt;
        if (decayTimer > CONFIG.police.decaySeconds) {
          decayTimer = 0;
          wanted = Math.max(0, wanted - 1);
        }
      } else {
        decayTimer = 0;
      }
    },

    /** Draw the cruiser light bars flashing (called from the render loop). */
    flash(time) {
      for (const car of policeCars) {
        const bar = car.group.children.find((c) => c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y > 1.5);
        if (bar) bar.material.color.setHex(Math.floor(time * 4) % 2 === 0 ? 0xff2233 : 0x2244ff);
      }
    },

    reset() {
      while (policeCars.length > 0) removeCruiser(policeCars[0]);
      wanted = 0;
      bustedTimer = 0;
      decayTimer = 0;
    },
  };
}
