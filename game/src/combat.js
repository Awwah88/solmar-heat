// Solmar Heat — combat.js
// One clear job: fighting — health, punching, shooting, and getting hurt.
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
    this.tracers = [];
    const geo = new THREE.BoxGeometry(0.12, 0.12, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    this.tracerGeo = geo;
    this.tracerMat = mat;
  }

  takeDamage(amount) {
    this.health = clamp(this.health - amount, 0, 100);
    this.game.hud.flashDamage();
    if (this.health <= 0) this.game.wasted();
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, 100);
  }

  update(dt, input, playerPos, playerAngle, camera) {
    this.punchCooldown -= dt;
    this.shotCooldown -= dt;
    if (input.wasPressed('KeyF') && this.punchCooldown <= 0) {
      this.punchCooldown = 0.45;
      this.game.audio.blip(180, 0.12, 'square', 0.2);
      // A punch hurts the nearest pedestrian or police car in front.
      this.game.hitNearby(2.6, 18);
    }
    if (input.clicked && this.armed && this.ammo > 0 && this.shotCooldown <= 0) {
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
    this.tracers = this.tracers.filter((t) => {
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        return false;
      }
      return true;
    });
  }
}
