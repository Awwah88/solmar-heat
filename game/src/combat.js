// Solmar Heat — combat.js
// Fighting: health, punching, shooting, and getting hurt. Combat never
// touches the world directly — it asks the Game to resolve hits and to
// end the run when health reaches zero.
//
// Punching (F) has a short cooldown and knocks down the nearest
// pedestrian in front. Shooting (mouse click) needs the pistol from
// Mission 2 and spends one round per shot; a glowing tracer shows the
// shot line for a fraction of a second.

import * as THREE from 'three';
import { clamp } from './config.js';

export class Combat {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.health = 100;
    this.armed = false;
    this.ammo = 0;
    this.punchCooldown = 0;
    this.shotCooldown = 0;
    // Bullet tracers are short-lived glowing boxes; they leave the
    // scene a fraction of a second after firing.
    this.tracers = [];
    this.tracerGeo = new THREE.BoxGeometry(0.12, 0.12, 6);
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  }

  takeDamage(amount) {
    this.health = clamp(this.health - amount, 0, 100);
    this.game.hud.flashDamage();
    if (this.health <= 0) this.game.wasted();
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, 100);
  }

  // Throw a punch at whatever is right in front of the player.
  tryPunch() {
    this.punchCooldown = 0.45;
    this.game.audio.blip(180, 0.12, 'square', 0.2);
    this.game.hitNearby(2.6, 18);
  }

  // Fire one round along the camera's view direction, leaving a tracer.
  fireShot(playerPos, camera) {
    this.shotCooldown = 0.28;
    this.ammo -= 1;
    this.game.audio.gunshot();
    const start = new THREE.Vector3(playerPos.x, 1.4, playerPos.z);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const tracer = new THREE.Mesh(this.tracerGeo, this.tracerMat);
    tracer.position.copy(start).addScaledVector(dir, 3);
    tracer.lookAt(start.clone().addScaledVector(dir, 9));
    this.scene.add(tracer);
    this.tracers.push({ mesh: tracer, life: 0.09 });
    this.game.shootHit(start, dir);
  }

  // Age the tracers out of the scene.
  ageTracers(dt) {
    this.tracers = this.tracers.filter((t) => {
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        return false;
      }
      return true;
    });
  }

  update(dt, input, playerPos, playerAngle, camera) {
    this.punchCooldown -= dt;
    this.shotCooldown -= dt;
    if (input.wasPressed('KeyF') && this.punchCooldown <= 0) this.tryPunch();
    if (input.clicked && this.armed && this.ammo > 0 && this.shotCooldown <= 0) {
      this.fireShot(playerPos, camera);
    }
    this.ageTracers(dt);
  }
}
