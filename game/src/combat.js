// Health, punching and the pistol. Shooting is a manual ray test against
// pedestrians and police cars — no physics engine, no network, no fuss.
import { clamp } from './config.js';

export class Combat {
  constructor() {
    this.health = 100;
    this.maxHealth = 100;
    this.hasPistol = false;
    this.punchCooldown = 0;
    this.shotCooldown = 0;
  }

  damage(amount) {
    this.health = clamp(this.health - amount, 0, this.maxHealth);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, this.maxHealth);
  }

  update(dt) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
  }

  // Punch whatever is right in front of the player on foot.
  punch(player, pedestrians) {
    if (this.punchCooldown > 0 || player.car) return null;
    this.punchCooldown = 0.45;
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    const hit = pedestrians.nearest(player.x, player.z, 2.8);
    if (!hit) return { kind: 'miss' };
    const dx = hit.ped.group.position.x - player.x;
    const dz = hit.ped.group.position.z - player.z;
    const facing = dx * fx + dz * fz;
    if (facing < 0) return { kind: 'miss' };
    pedestrians.knockDown(hit.ped);
    return { kind: 'ped', ped: hit.ped };
  }

  // Fire the pistol along a direction; returns what the bullet met first.
  shoot(origin, dir, pedestrians, policeCars) {
    if (!this.hasPistol || this.shotCooldown > 0) return null;
    this.shotCooldown = 0.28;
    let best = null;
    let bestT = 70;
    const test = (x, z, radius, ref) => {
      const dx = x - origin.x;
      const dz = z - origin.z;
      const t = dx * dir.x + dz * dir.z;
      if (t < 1 || t > bestT) return;
      const px = origin.x + dir.x * t;
      const pz = origin.z + dir.z * t;
      const miss = Math.hypot(x - px, z - pz);
      if (miss < radius) { bestT = t; best = ref; }
    };
    for (const ped of pedestrians.list) {
      if (ped.state === 'down') continue;
      test(ped.group.position.x, ped.group.position.z, 1.4, { kind: 'ped', ped });
    }
    for (const car of policeCars) {
      test(car.group.position.x, car.group.position.z, 2.6, { kind: 'police', car });
    }
    if (best && best.kind === 'ped') pedestrians.knockDown(best.ped);
    if (best && best.kind === 'police') best.car.speed *= 0.4;
    return best;
  }
}
