// Wanted level 0-5 and the police response. Police cars spawn on nearby
// roads when the heat rises, chase the player and ram; on foot, a cop who
// stays on top of the player for a while makes the bust. Wanted decays
// when no cruiser is close, and the Spray Shop clears it for cash.
import { ROAD_CENTRES, clamp, dist2d, forwardOf, wrapAngle } from "./config.js";
import { Car } from "./vehicles.js";

export class Police {
  constructor(scene, onBusted, onRam) {
    this.scene = scene;
    this.onBusted = onBusted;
    this.onRam = onRam;
    this.wanted = 0;
    this.policeCars = [];
    this._bustTimer = 0;
    this._decayTimer = 0;
    this._spawnCooldown = 0;
  }

  setWanted(n, playerPos) {
    this.wanted = clamp(Math.round(n), 0, 5);
    this._syncCars(playerPos);
  }

  addWanted(n, playerPos) {
    this.setWanted(this.wanted + n, playerPos);
  }

  clearWanted() {
    this.wanted = 0;
    for (const c of this.policeCars) c.remove();
    this.policeCars = [];
    this._bustTimer = 0;
  }

  _syncCars(playerPos) {
    const want = Math.min(this.wanted, 5);
    while (this.policeCars.length < want) {
      const pos = this._spawnPoint(playerPos);
      const car = new Car(this.scene, 0x11151c, pos.x, pos.z, Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z), true);
      car.cruise = 13 + this.wanted * 1.2;
      car.speed = car.cruise;
      car.sync();
      this.policeCars.push(car);
    }
    while (this.policeCars.length > want) {
      const car = this.policeCars.pop();
      car.remove();
    }
  }

  _spawnPoint(playerPos) {
    const near = (v) => ROAD_CENTRES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const cx = near(playerPos.x);
    const cz = near(playerPos.z);
    const dir = Math.random() < 0.5 ? 1 : -1;
    if (Math.random() < 0.5) {
      return { x: clamp(cx + dir * 36, -162, 162), z: cz + (Math.random() - 0.5) * 10 };
    }
    return { x: cx + (Math.random() - 0.5) * 10, z: clamp(cz + dir * 36, -162, 162) };
  }

  update(dt, playerPos, playerHeading, playerInCar, playerSpeed) {
    this._spawnCooldown -= dt;
    if (this.wanted > 0 && this._spawnCooldown <= 0) {
      this._syncCars(playerPos);
      this._spawnCooldown = 1.5;
    }
    let nearest = 999;
    for (const car of this.policeCars) {
      const d = dist2d(car.x, car.z, playerPos.x, playerPos.z);
      nearest = Math.min(nearest, d);
      const desired = Math.atan2(playerPos.x - car.x, playerPos.z - car.z);
      const err = wrapAngle(desired - car.heading);
      car.heading += clamp(err, -2.6 * dt, 2.6 * dt);
      const targetSpeed = d > 60 ? car.cruise + 5 : car.cruise;
      const f = forwardOf(car.heading);
      car.group.position.x += f.x * targetSpeed * dt;
      car.group.position.z += f.z * targetSpeed * dt;
      car.group.position.x = clamp(car.group.position.x, -178, 178);
      car.group.position.z = clamp(car.group.position.z, -178, 178);
      car.speed = targetSpeed;
      car.sync();
      if (d < 3.4) {
        // Ram: shove the player and hurt them.
        const push = forwardOf(Math.atan2(playerPos.x - car.x, playerPos.z - car.z));
        if (this.onRam) this.onRam(push.x, push.z, playerInCar ? 7 : 12);
        car.heading += 0.6;
        const back = forwardOf(car.heading + Math.PI);
        car.group.position.x += back.x * 4 * dt;
        car.group.position.z += back.z * 4 * dt;
      }
    }
    // Busted: a cruiser sits on the on-foot player.
    if (!playerInCar && this.wanted > 0 && nearest < 2.6) {
      this._bustTimer += dt;
      if (this._bustTimer > 1.5) {
        this._bustTimer = 0;
        if (this.onBusted) this.onBusted();
      }
    } else {
      this._bustTimer = Math.max(0, this._bustTimer - dt * 2);
    }
    // Wanted decays when no cruiser is anywhere near.
    if (this.wanted > 0 && nearest > 32) {
      this._decayTimer += dt;
      if (this._decayTimer > 25) {
        this._decayTimer = 0;
        this.setWanted(this.wanted - 1, playerPos);
      }
    } else {
      this._decayTimer = 0;
    }
  }
}
