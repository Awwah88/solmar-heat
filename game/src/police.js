// Solmar Heat — the wanted system and the police. Wanted runs 0–5 stars:
// stealing a car or hurting someone raises it, the Spray Shop clears it
// for $75, and it decays one star at a time once no police car has been
// near the player for a while. Police cars spawn on nearby roads, chase,
// and ram — their rams chip the player's health. M5's finale (new in R16)
// pins the chase at 4 stars while the limo runs to the Boardwalk.
import * as THREE from 'three';
import { ROADS, TUNING } from './config.js';
import { Car } from './vehicles.js';

export class Police {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.wanted = 0;
    this.policeCars = [];
    this.quietTimer = 0;
    this.spawnTimer = 0;
  }
  setWanted(n) {
    this.wanted = Math.max(0, Math.min(5, n));
    this.quietTimer = 0;
  }
  addWanted(n) { this.setWanted(this.wanted + n); }
  clear() { this.setWanted(0); }
  _spawnOne() {
    const p = this.game.playerPos();
    const road = ROADS[Math.floor(Math.random() * ROADS.length)];
    const vertical = Math.random() < 0.5;
    const x = vertical ? road : p.x + (Math.random() < 0.5 ? -30 : 30);
    const z = vertical ? p.z + (Math.random() < 0.5 ? -30 : 30) : road;
    const car = new Car(0x1a1a2e, 'sedan', Math.max(-170, Math.min(170, x)), Math.max(-170, Math.min(170, z)), 0);
    car.isPolice = true;
    // Police livery: white doors + light bar.
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1.5 }));
    bar.position.set(0, 1.7, 0);
    car.group.add(bar);
    car.speed = 12;
    this.policeCars.push(car);
    this.scene.add(car.group);
  }
  _removeFar() {
    const p = this.game.playerPos();
    for (let i = this.policeCars.length - 1; i >= 0; i--) {
      const c = this.policeCars[i];
      if (Math.hypot(c.x - p.x, c.z - p.z) > 260) {
        this.scene.remove(c.group);
        this.policeCars.splice(i, 1);
      }
    }
  }
  update(dt) {
    const p = this.game.playerPos();
    const want = Math.min(this.wanted, 5);
    this.spawnTimer -= dt;
    if (this.policeCars.length < want && this.spawnTimer <= 0) {
      this._spawnOne();
      this.spawnTimer = 1.2;
    }
    while (this.policeCars.length > want) {
      const c = this.policeCars.pop();
      this.scene.remove(c.group);
    }
    let nearest = 999;
    for (const car of this.policeCars) {
      const dx = p.x - car.x;
      const dz = p.z - car.z;
      const d = Math.hypot(dx, dz);
      nearest = Math.min(nearest, d);
      const desired = Math.atan2(dx, dz);
      let err = desired - car.heading;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, err * 2 * dt));
      const target = d > 6 ? TUNING.policeTopSpeed : TUNING.policeTopSpeed * 0.55;
      car.speed += Math.sign(target - car.speed) * 14 * dt;
      car.group.position.x += Math.sin(car.heading) * car.speed * dt;
      car.group.position.z += Math.cos(car.heading) * car.speed * dt;
      car.group.rotation.y = car.heading;
      // Ram: contact with the player hurts, and shoves a player car.
      if (d < 3.4) {
        this.game.damagePlayer(TUNING.policeRamDamage * dt * 4, 'police');
        const pc = this.game.player.car;
        if (pc) {
          pc.group.position.x += Math.sin(car.heading) * 2.4 * dt;
          pc.group.position.z += Math.cos(car.heading) * 2.4 * dt;
        }
      }
    }
    this._removeFar();
    // Wanted decays once the heat is off: no police car near for a while.
    if (this.wanted > 0) {
      if (nearest > 30) {
        this.quietTimer += dt;
        if (this.quietTimer > TUNING.wantedDecayDelay) {
          this.setWanted(this.wanted - 1);
          this.quietTimer = 0;
        }
      } else {
        this.quietTimer = 0;
      }
    }
    this.game.audio.setSiren(this.wanted > 0 && this.policeCars.length > 0);
  }
}
