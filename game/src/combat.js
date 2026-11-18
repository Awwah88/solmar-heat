// Combat: fists and the pistol (unlocked by finishing Mission 2).
// A shot is a short ray in front of the player with a muzzle flash;
// a punch is a close-range shove. Both raise the heat if the law sees it.
import * as THREE from 'three';

export function createCombat(scene, audio) {
  let hasPistol = false;
  let flashUntil = 0;
  let lastShotAt = null;
  let cooldown = 0;

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 })
  );
  flash.visible = false;
  scene.add(flash);
  const flashLight = new THREE.PointLight(0xffd27a, 0, 12);
  scene.add(flashLight);

  return {
    get hasPistol() { return hasPistol; },
    unlockPistol() { hasPistol = true; },
    reset() { hasPistol = false; flash.visible = false; flashLight.intensity = 0; },
    get lastShotAt() { return lastShotAt; },
    // Fire the pistol. Returns the hit kind ('ped' | 'cop' | null).
    shoot(now, origin, heading, peds, policeCars) {
      if (!hasPistol || now < cooldown) return null;
      cooldown = now + 0.35;
      lastShotAt = { x: origin.x, z: origin.z };
      audio.shot();
      const fx = Math.sin(heading), fz = Math.cos(heading);
      flash.position.set(origin.x + fx * 1.4, 1.5, origin.z + fz * 1.4);
      flash.lookAt(origin.x + fx * 4, 1.5, origin.z + fz * 4);
      flash.visible = true;
      flash.material.opacity = 0.95;
      flashLight.position.copy(flash.position);
      flashLight.intensity = 14;
      flashUntil = now + 0.07;
      // Pedestrians in the line of fire.
      for (const w of peds) {
        if (w.down) continue;
        const dx = w.x - origin.x, dz = w.z - origin.z;
        const along = dx * fx + dz * fz;
        if (along < 0 || along > 28) continue;
        const side = Math.abs(dx * fz - dz * fx);
        if (side < 1.6) {
          w.down = true;
          w.mesh.rotation.x = -Math.PI / 2;
          w.mesh.position.y = 0.4;
          return 'ped';
        }
      }
      for (const c of policeCars) {
        const p = c.group.position;
        const dx = p.x - origin.x, dz = p.z - origin.z;
        const along = dx * fx + dz * fz;
        if (along < 0 || along > 34) continue;
        const side = Math.abs(dx * fz - dz * fx);
        if (side < 2.4) {
          c.hp -= 1;
          c.speed = Math.max(0, c.speed - 9);
          if (c.hp <= 0) c.ramPauseUntil = now + 4;
          return 'cop';
        }
      }
      return null;
    },
    // Punch: knock a nearby pedestrian down.
    punch(now, origin, heading, peds) {
      audio.punch();
      const fx = Math.sin(heading), fz = Math.cos(heading);
      for (const w of peds) {
        if (w.down) continue;
        const dx = w.x - origin.x, dz = w.z - origin.z;
        if (dx * dx + dz * dz < 2.6 * 2.6 && dx * fx + dz * fz > 0) {
          w.down = true;
          w.mesh.rotation.x = -Math.PI / 2;
          w.mesh.position.y = 0.4;
          return 'ped';
        }
      }
      return null;
    },
    update(now) {
      if (flash.visible && now > flashUntil) {
        flash.visible = false;
        flashLight.intensity = 0;
      }
    },
  };
}
