// Wanted level and the police chase. Cruisers spawn on the roads near
// the player, pursue with road-aware steering, and ram — but after a
// ram they back off for 1.5 seconds (fix #2) so the player can recover.
import * as THREE from 'three';
import { CFG, makeRng, clamp, wrapAngle } from './config.js';
import { makeCar } from './vehicles.js';
import { collideCircle } from './city.js';

export function createPolice(scene, colliders) {
  const rng = makeRng(99);
  const policeCars = [];
  let wanted = 0;
  let bustedTimer = 0;

  function spawnCruiser(playerPos) {
    const car = makeCar(0x1a1a22, { police: true });
    // Spawn on a road 30-50 units from the player.
    const road = CFG.roads[Math.floor(rng() * CFG.roads.length)];
    const vertical = rng() < 0.5;
    let x, z;
    for (let tries = 0; tries < 12; tries++) {
      const along = playerPos[vertical ? 'z' : 'x'] + (rng() < 0.5 ? -1 : 1) * (30 + rng() * 20);
      x = vertical ? road : clamp(along, -162, 162);
      z = vertical ? clamp(along, -162, 162) : road;
      if (Math.hypot(x - playerPos.x, z - playerPos.z) > 26) break;
    }
    car.place(x, z, rng() * Math.PI * 2);
    car.speed = 0;
    car.ramPauseUntil = 0;
    car.ramCooldown = 0;
    car.hp = 3;
    scene.add(car.group);
    policeCars.push(car);
    return car;
  }

  function removeCruiser(car) {
    scene.remove(car.group);
    const i = policeCars.indexOf(car);
    if (i >= 0) policeCars.splice(i, 1);
  }

  return {
    get wanted() { return wanted; },
    policeCars,
    setWanted(n) {
      wanted = clamp(Math.round(n), 0, 5);
    },
    addWanted(n) { this.setWanted(wanted + n); },
    clear() {
      for (const c of [...policeCars]) removeCruiser(c);
      wanted = 0;
      bustedTimer = 0;
    },
    // Returns 'busted' when the player is caught, else null.
    update(dt, now, player, onRam) {
      const target = policeCars.length ? policeCars : null;
      const want = wanted === 0 ? 0 : Math.min(wanted, 3);
      while (policeCars.length < want) spawnCruiser(player.pos);
      while (policeCars.length > want) removeCruiser(policeCars[policeCars.length - 1]);
      if (wanted === 0) { bustedTimer = 0; return null; }

      const px = player.pos.x, pz = player.pos.z;
      const playerSlow = player.car ? Math.abs(player.car.speed) < 1 : true;
      let busted = false;
      for (const c of policeCars) {
        const p = c.group.position;
        const dx = px - p.x, dz = pz - p.z;
        const d = Math.hypot(dx, dz);
        // Ram-pause (fix #2): after ramming, reverse away for 1.5s.
        if (now < c.ramPauseUntil) {
          c.speed = Math.max(c.speed - 20 * dt, -7);
          p.x += Math.sin(c.heading) * c.speed * dt;
          p.z += Math.cos(c.heading) * c.speed * dt;
        } else {
          const desired = Math.atan2(dx, dz);
          const dh = wrapAngle(desired - c.heading);
          const turn = clamp(dh, -1.6 * dt, 1.6 * dt);
          c.setHeading(c.heading + turn);
          c.speed = Math.min(c.speed + 11 * dt, d > 26 ? 27 : 22);
          p.x += Math.sin(c.heading) * c.speed * dt;
          p.z += Math.cos(c.heading) * c.speed * dt;
        }
        // Keep cruisers out of buildings.
        const fixed = collideCircle(p.x, p.z, CFG.carRadius, colliders);
        p.x = fixed.x; p.z = fixed.z;
        // Ram the player.
        if (d < 4.4 && now >= c.ramCooldown && now >= c.ramPauseUntil) {
          c.ramCooldown = now + 2.2;
          c.ramPauseUntil = now + 1.5;
          c.speed = -4;
          if (onRam) onRam(8);
        }
        // Flash the light bar.
        if (c.group.userData.lightBar) {
          const t = Math.floor(now * 3) % 2;
          c.group.userData.lightBar.children[0].material.color.setHex(t ? 0xff2222 : 0x441111);
          c.group.userData.lightBar.children[1].material.color.setHex(t ? 0x111144 : 0x2266ff);
        }
        for (const w of c.wheels) w.rotation.z += c.speed * dt * 1.4;
        // Busted: a cruiser sits on the player while they are slow.
        if (d < 4.6 && playerSlow) {
          bustedTimer += dt;
          if (bustedTimer > 2.2) busted = true;
        } else if (d > 7) {
          bustedTimer = Math.max(0, bustedTimer - dt);
        }
      }
      return busted ? 'busted' : null;
    },
  };
}
