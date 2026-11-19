// Sidewalk walkers. They stroll the pavements, flee from speeding cars and
// gunfire, and go down (then get back up) when punched.
import * as THREE from 'three';
import { GRID, TUNING, makeRng, pick, clamp } from './config.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1];

export class Pedestrians {
  constructor(scene, city, seed) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed || 23);
    this.list = [];
    const bodyGeo = new THREE.CylinderGeometry(0.32, 0.38, 1.15, 8);
    const headGeo = new THREE.SphereGeometry(0.27, 10, 8);
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
    for (let i = 0; i < TUNING.pedCount; i++) {
      const group = new THREE.Group();
      const shirt = new THREE.MeshLambertMaterial({ color: pick(this.rng, SHIRTS) });
      const body = new THREE.Mesh(bodyGeo, shirt);
      body.position.y = 0.95;
      body.castShadow = true;
      group.add(body);
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.y = 1.75;
      group.add(head);
      const road = pick(this.rng, GRID.roads);
      const along = -162 + this.rng() * 324;
      const side = this.rng() < 0.5 ? -8 : 8;
      if (this.rng() < 0.5) group.position.set(along, 0, road + side);
      else group.position.set(road + side, 0, along);
      scene.add(group);
      this.list.push({
        group,
        heading: this.rng() * Math.PI * 2,
        speed: 1.1 + this.rng() * 0.9,
        state: 'walk',
        timer: 2 + this.rng() * 6,
        downTimer: 0,
      });
    }
  }

  update(dt, player, danger) {
    for (const ped of this.list) {
      const p = ped.group.position;
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.state = 'walk';
          ped.group.rotation.x = 0;
          p.y = 0;
        }
        continue;
      }
      let speed = ped.speed;
      let flee = false;
      // Flee from a fast car nearby or from a gunshot.
      if (player && player.car && Math.abs(player.car.speed) > 7) {
        const dx = p.x - player.x;
        const dz = p.z - player.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 11) flee = true;
      }
      if (danger) {
        const dx = p.x - danger.x;
        const dz = p.z - danger.z;
        if (dx * dx + dz * dz < 30 * 30) flee = true;
      }
      if (flee) {
        ped.state = 'flee';
        ped.timer = 2.5;
        const dx = p.x - (player ? player.x : danger.x);
        const dz = p.z - (player ? player.z : danger.z);
        ped.heading = Math.atan2(dx, dz);
        speed = 4.2;
      } else if (ped.state === 'flee') {
        ped.timer -= dt;
        speed = 4.2;
        if (ped.timer <= 0) ped.state = 'walk';
      } else {
        ped.timer -= dt;
        if (ped.timer <= 0) {
          ped.timer = 3 + this.rng() * 7;
          // Turn at random onto a crossing pavement.
          ped.heading += pick(this.rng, [-Math.PI / 2, Math.PI / 2, Math.PI]);
        }
      }
      p.x += Math.sin(ped.heading) * speed * dt;
      p.z += Math.cos(ped.heading) * speed * dt;
      const fixed = this.city.resolveCircle(p.x, p.z, 0.7);
      p.x = fixed.x;
      p.z = fixed.z;
      p.x = clamp(p.x, -178, 178);
      p.z = clamp(p.z, -178, 178);
      ped.group.rotation.y = ped.heading;
      // Little walking bob.
      ped.group.children[0].position.y = 0.95 + Math.abs(Math.sin(performance.now() / 140 + ped.heading * 7)) * 0.06;
    }
  }

  knockDown(ped) {
    ped.state = 'down';
    ped.downTimer = 3;
    ped.group.rotation.x = Math.PI / 2;
    ped.group.position.y = 0.35;
  }

  nearest(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const ped of this.list) {
      if (ped.state === 'down') continue;
      const dx = ped.group.position.x - x;
      const dz = ped.group.position.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) { bestD = d; best = ped; }
    }
    return best ? { ped: best, dist: bestD } : null;
  }
}
