// Solmar Heat — police.js
// The wanted system and the Solmar Bay police. Wanted stars 0-5 rise when
// the player steals, shoots or runs someone over, and fall when the Spray
// Shop washes the car or the player stays out of trouble. Police cars
// spawn at the edge of the player's view, chase, and ram — and if they
// catch the player on foot, it's busted.

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, angleDiff, clamp, distance2D } from './config.js';
import { Car } from './vehicles.js';

function buildPoliceMesh() {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: 0x1c2126 });
  const white = new THREE.MeshLambertMaterial({ color: 0xe8e4d8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), paint);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.0), white);
  cabin.position.set(0, 1.3, -0.2);
  group.add(cabin);
  // Light bar: red and blue blocks that flash by swapping emissive.
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.5), white);
  barBase.position.set(0, 1.7, -0.2);
  group.add(barBase);
  const red = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.25, 0.45),
    new THREE.MeshLambertMaterial({ color: 0xd23b2e, emissive: 0xd23b2e }),
  );
  red.position.set(-0.4, 1.82, -0.2);
  group.add(red);
  const blue = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.25, 0.45),
    new THREE.MeshLambertMaterial({ color: 0x2e5ad2, emissive: 0x2e5ad2 }),
  );
  blue.position.set(0.4, 1.82, -0.2);
  group.add(blue);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const dark = new THREE.MeshLambertMaterial({ color: 0x111417 });
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  return { group, red, blue };
}

export class Police {
  constructor(scene, city, game) {
    this.scene = scene;
    this.city = city;
    this.game = game;
    this.wanted = 0;
    this.policeCars = [];
    this.spawnTimer = 0;
    this.cooldownTimer = 0; // grace period after a spray or a bust
    this.bustedTimer = 0; // how long police have been touching the player on foot
    this.flashPhase = 0;
  }

  addWanted(n) {
    if (this.cooldownTimer > 0) return;
    this.wanted = clamp(this.wanted + n, 0, CONFIG.MAX_WANTED);
  }

  setWanted(n) {
    this.wanted = clamp(n, 0, CONFIG.MAX_WANTED);
  }

  clearWanted() {
    this.wanted = 0;
    this.bustedTimer = 0;
    for (const car of this.policeCars) this.scene.remove(car.mesh);
    this.policeCars = [];
    this.cooldownTimer = 5;
  }

  // Keep the number of police cars on the street equal to the wanted level.
  _syncCars(playerPos) {
    const want = Math.min(this.wanted, CONFIG.MAX_POLICE);
    while (this.policeCars.length < want) {
      const angle = Math.random() * Math.PI * 2;
      const x = playerPos.x + Math.cos(angle) * 70;
      const z = playerPos.z + Math.sin(angle) * 70;
      const car = new Car(this.scene, x, clamp(z, -180, 200), 0x1c2126, 'police', {});
      const built = buildPoliceMesh();
      this.scene.remove(car.mesh);
      car.mesh = built.group;
      // The car's pos IS its mesh position — rebind it to the new mesh,
      // or the visible car would never move.
      car.pos = car.mesh.position;
      car.mesh.position.set(x, 0, clamp(z, -180, 200));
      this.scene.add(car.mesh);
      car.lightRed = built.red;
      car.lightBlue = built.blue;
      car.ramCooldown = 0;
      this.policeCars.push(car);
    }
    while (this.policeCars.length > want) {
      const car = this.policeCars.pop();
      this.scene.remove(car.mesh);
    }
  }

  update(dt, playerPos, playerCar, playerSpeed, onFoot) {
    this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    this.flashPhase += dt * 6;
    this._syncCars(playerPos);
    if (this.wanted === 0) return;

    // Flashing light bars.
    const redOn = Math.sin(this.flashPhase) > 0;
    for (const car of this.policeCars) {
      if (car.lightRed) car.lightRed.material.emissive.setHex(redOn ? 0xd23b2e : 0x330000);
      if (car.lightBlue) car.lightBlue.material.emissive.setHex(redOn ? 0x000033 : 0x2e5ad2);
      car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
    }

    // Chase: steer toward the player, a little faster than traffic but
    // not faster than a good getaway car.
    for (const car of this.policeCars) {
      const d = distance2D(car.pos.x, car.pos.z, playerPos.x, playerPos.z);
      const want = Math.atan2(playerPos.x - car.pos.x, playerPos.z - car.pos.z);
      const diff = angleDiff(car.heading, want);
      const steer = clamp(diff * 1.8, -1, 1);
      const top = playerCar ? 30 : 12;
      if (Math.abs(car.speed) < top) car.speed += 20 * dt;
      if (d < 10) car.speed = Math.min(car.speed, 16);
      const turn = steer * CONFIG.CAR_TURN * dt * clamp(Math.abs(car.speed) / 8, 0.25, 1);
      car.heading += turn;
      const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
      car.pos.x = clamp(nx, -185, 185);
      car.pos.z = clamp(nz, -185, 250);
      if (this.city.resolveCircle(car.pos, CONFIG.CAR_RADIUS)) car.speed *= 0.4;
      car.mesh.rotation.y = car.heading;

      // Ram: contact with the player's car damages the player and
      // shoves both cars; contact on foot builds toward a bust.
      if (d < 3.6 && car.ramCooldown <= 0) {
        car.ramCooldown = 1.2;
        if (playerCar) {
          this.game.combat.damage(12, 'ram');
          this.game.audio.crash();
          // Shove the player's car away from the ram.
          const away = Math.atan2(playerCar.pos.x - car.pos.x, playerCar.pos.z - car.pos.z);
          playerCar.pos.x += Math.sin(away) * 2.5;
          playerCar.pos.z += Math.cos(away) * 2.5;
          playerCar.speed *= 0.6;
        } else {
          this.bustedTimer += 0.4;
        }
      }
    }

    // On foot with the heat on and police all over you: busted.
    if (onFoot) {
      let touching = false;
      for (const car of this.policeCars) {
        if (distance2D(car.pos.x, car.pos.z, playerPos.x, playerPos.z) < 4) touching = true;
      }
      if (touching && this.wanted >= 2) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 1.6) {
          this.bustedTimer = 0;
          this.game.busted();
        }
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
      }
    } else {
      this.bustedTimer = 0;
    }

    // Slow decay: stay clean for a while and the heat cools by one star.
    if (this.wanted > 0) {
      this.spawnTimer += dt;
      if (this.spawnTimer > 45) {
        this.spawnTimer = 0;
        this.wanted = Math.max(0, this.wanted - 1);
      }
    }
  }
}
