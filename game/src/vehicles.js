// Solmar Heat — vehicles.js
// Cars: how they look, how the player drives one, and how the city's
// traffic drives itself along the road grid. A car is a low-poly box
// build — body, cabin, wheels, lights — with an arcade driving model.
//
// Traffic cars cruise one road line at a time. At an intersection they
// sometimes turn onto the crossing road; at the city edge they U-turn.
// They brake for the car ahead on their lane and never leave the roads.

import * as THREE from 'three';
import { clamp, distance2D, mulberry32 } from './config.js';

const CAR_COLORS = [0xd23b3b, 0x2a6fd6, 0xf2c230, 0x37b268, 0xe8e8e8, 0x7a4fd0, 0xff8c42, 0x3aa7a3];

// Build a low-poly car from boxes: body, cabin, wheels, headlights,
// tail lights, and — for police cars — a white stripe and a light bar.
export function makeCarMesh(color, isPolice = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.55, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1d2733, roughness: 0.15, metalness: 0.7 }),
  );
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  if (isPolice) addPoliceTrim(group);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.42, z);
    wheel.castShadow = true;
    group.add(wheel);
  });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a8, emissiveIntensity: 0.8 });
  [-0.7, 0.7].forEach((x) => {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    light.position.set(x, 0.62, 2.22);
    group.add(light);
  });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xaa1010, emissiveIntensity: 0.7 });
  [-0.7, 0.7].forEach((x) => {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    tail.position.set(x, 0.62, -2.22);
    group.add(tail);
  });
  return group;
}

function addPoliceTrim(group) {
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.12, 0.2, 4.42),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
  );
  stripe.position.y = 0.62;
  group.add(stripe);
  const barR = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.18, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2020, emissiveIntensity: 1.4 }),
  );
  barR.position.set(0, 1.48, -0.25);
  group.add(barR);
  const barB = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.18, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x2a6bff, emissive: 0x2040ff, emissiveIntensity: 1.4 }),
  );
  barB.position.set(0, 1.48, 0.15);
  group.add(barB);
}

export class Car {
  constructor(scene, color, x, z, angle, isPolice = false) {
    this.mesh = makeCarMesh(color, isPolice);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = angle;
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.angle = angle;
    this.speed = 0;
    this.steer = 0;
    this.color = color;
    this.isPolice = isPolice;
    this.health = 100;
    this.parked = false;
    this.driver = null; // 'player' | 'traffic' | 'police' | null
    this.hitCooldown = 0;
  }

  forward() {
    return { x: Math.sin(this.angle), z: Math.cos(this.angle) };
  }

  // Arcade driving: throttle, brake/reverse, steering that bites less
  // at speed, handbrake drift. Returns distance moved this frame.
  drive(input, dt) {
    const throttle = input.moveY();
    const steerInput = input.moveX();
    const handbrake = input.isDown('Space');
    const maxSpeed = 34;
    const maxReverse = 12;
    if (throttle > 0) this.speed += 22 * dt;
    else if (throttle < 0) this.speed -= this.speed > 0.5 ? 30 * dt : 12 * dt;
    else this.speed -= this.speed * 0.9 * dt;
    if (handbrake) this.speed -= this.speed * 2.2 * dt;
    this.speed = clamp(this.speed, -maxReverse, maxSpeed);
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    const steerTarget = steerInput * (handbrake ? 1.5 : 1);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    const steerAmount = this.steer * clamp(Math.abs(this.speed) / 8, 0, 1) * 1.9;
    // Increasing angle turns the car left in this angle convention, so
    // steering right (D) decreases the angle. The sign flips in reverse,
    // as in a real car.
    this.angle -= steerAmount * dt * (this.speed >= 0 ? 1 : -1);
    const f = this.forward();
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    this.mesh.rotation.y = this.angle;
    // Keep the car inside the city.
    this.pos.x = clamp(this.pos.x, -185, 185);
    this.pos.z = clamp(this.pos.z, -185, 200);
    return Math.abs(this.speed) * dt;
  }
}

export class TrafficSystem {
  constructor(scene) {
    this.cars = [];
    const rand = mulberry32(777);
    const coords = [];
    for (let c = -160; c <= 160; c += 40) coords.push(c);
    for (let i = 0; i < 14; i += 1) {
      const horizontal = rand() > 0.5;
      const line = coords[Math.floor(rand() * coords.length)];
      const along = -160 + rand() * 320;
      const color = CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)];
      const car = new Car(scene, color, horizontal ? along : line, horizontal ? line : along, horizontal ? Math.PI / 2 : 0);
      car.driver = 'traffic';
      car.speed = 8 + rand() * 6;
      car.horizontal = horizontal;
      car.dir = rand() > 0.5 ? 1 : -1;
      car.lane = (rand() > 0.5 ? 1 : -1) * 2.6;
      car.cruise = car.speed;
      this.cars.push(car);
    }
  }

  // The nearest other car ahead of `car` on its lane, if any is close.
  findCarAhead(car, others) {
    let ahead = null;
    let aheadDist = 999;
    others.forEach((other) => {
      if (other === car || other.parked) return;
      const d = distance2D(car.pos.x, car.pos.z, other.pos.x, other.pos.z);
      if (d >= aheadDist) return;
      const f = car.forward();
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      if (dx * f.x + dz * f.z > 0 && d < 14) {
        ahead = other;
        aheadDist = d;
      }
    });
    return { ahead, aheadDist };
  }

  // At an intersection, sometimes turn onto the crossing road, snapping
  // back onto a road line with the lane offset; at the city edge, U-turn.
  maybeTurn(car, dt) {
    const onIntersection =
      Math.abs(((car.pos.x % 40) + 40) % 40) < 1.2 || Math.abs(((car.pos.z % 40) + 40) % 40) < 1.2;
    if (onIntersection && Math.random() < dt * 0.25) {
      car.horizontal = !car.horizontal;
      car.angle = car.horizontal ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : car.dir > 0 ? 0 : Math.PI;
      car.pos.x = Math.round(car.pos.x / 40) * 40 + (car.horizontal ? 0 : car.lane);
      car.pos.z = Math.round(car.pos.z / 40) * 40 + (car.horizontal ? car.lane : 0);
    }
    if (car.pos.x > 178 || car.pos.x < -178 || car.pos.z > 198 || car.pos.z < -178) {
      car.dir *= -1;
      car.angle += Math.PI;
    }
  }

  update(dt, playerCar, policeCars) {
    const all = [...this.cars, playerCar, ...policeCars].filter(Boolean);
    this.cars.forEach((car) => {
      const { ahead, aheadDist } = this.findCarAhead(car, all);
      const targetSpeed = ahead && aheadDist < 10 ? 0 : car.cruise;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
      const f = car.forward();
      car.pos.x += f.x * car.speed * dt;
      car.pos.z += f.z * car.speed * dt;
      car.mesh.rotation.y = car.angle;
      this.maybeTurn(car, dt);
    });
  }
}
