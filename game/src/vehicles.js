// Solmar Heat — vehicles.js
// Cars: the player's stolen rides, the traffic that fills the roads, and
// the simple arcade physics that drives them. A car is a small box-built
// mesh plus a state object — position, heading, speed, colour, and
// whether it is the player's current ride.

import * as THREE from '../vendor/three.module.min.js';
import { CONFIG, PARKED_CARS, angleDiff, clamp, distance2D } from './config.js';

function buildCarMesh(color, model) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c2126 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc4d8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), paint);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.1), glass);
  cabin.position.set(0, 1.3, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (model === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.5), new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xcc9900 }));
    sign.position.set(0, 1.85, -0.2);
    group.add(sign);
  }
  if (model === 'comet') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.4), dark);
    spoiler.position.set(0, 1.15, -2.1);
    group.add(spoiler);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  // Headlights: two small bright boxes that read at night.
  for (const hx of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.2, 0.1),
      new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffe9a8 }),
    );
    lamp.position.set(hx, 0.7, 2.22);
    group.add(lamp);
  }
  return group;
}

export class Car {
  constructor(scene, x, z, color, model, opts) {
    this.scene = scene;
    this.mesh = buildCarMesh(color, model || 'sedan');
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.heading = (opts && opts.heading) || 0;
    this.speed = 0;
    this.color = color;
    this.model = model || 'sedan';
    this.taxi = !!(opts && opts.taxi);
    this.red = !!(opts && opts.red);
    this.stolen = false;
    this.ai = null; // traffic brain, when this is a traffic car
    this.airY = 0;
    this.airVy = 0;
    this.airborne = false;
    this.airTime = 0;
  }

  setHeading(h) {
    this.heading = h;
    this.mesh.rotation.y = h;
  }

  // Arcade driving: accelerate, brake, reverse, steer more at speed.
  drive(throttle, steer, dt, city) {
    if (throttle > 0) this.speed += CONFIG.CAR_ACCEL * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= CONFIG.CAR_BRAKE * dt;
      else this.speed -= CONFIG.CAR_ACCEL * 0.6 * dt;
    } else {
      this.speed -= this.speed * 1.4 * dt;
    }
    this.speed = clamp(this.speed, -CONFIG.CAR_REVERSE_SPEED, CONFIG.CAR_TOP_SPEED);
    const turn = steer * CONFIG.CAR_TURN * dt * clamp(Math.abs(this.speed) / 8, 0.25, 1);
    this.heading += this.speed >= 0 ? turn : -turn;
    this._move(dt, city);
  }

  _move(dt, city) {
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const before = { x: this.pos.x, z: this.pos.z };
    this.pos.x = nx;
    this.pos.z = nz;
    // Keep the car inside the playable area.
    this.pos.x = clamp(this.pos.x, -185, 185);
    this.pos.z = clamp(this.pos.z, -185, 250);
    if (city.resolveCircle(this.pos, CONFIG.CAR_RADIUS)) {
      // Hit a building: stop dead and keep the scrape cheap.
      this.speed *= 0.25;
    }
    void before;
    // Airborne physics for stunt ramps.
    if (this.airborne) {
      this.airVy -= 22 * dt;
      this.airY += this.airVy * dt;
      this.airTime += dt;
      if (this.airY <= 0) {
        this.airY = 0;
        this.airVy = 0;
        this.airborne = false;
      }
    }
    this.pos.y = this.airY;
    this.mesh.rotation.y = this.heading;
    // Lean into corners and bounce a little over bumps.
    this.mesh.rotation.z = -this._steerVisual * 0.06;
  }

  get _steerVisual() {
    return 0;
  }

  launch() {
    if (this.airborne) return;
    this.airborne = true;
    this.airVy = 9;
    this.airTime = 0;
  }
}

export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    this._seed = 1234;
  }

  _rand() {
    this._seed = (this._seed * 16807) % 2147483647;
    return this._seed / 2147483647;
  }

  spawn() {
    // Parked cars first: the red Comet is cars[0] by construction.
    for (const spec of PARKED_CARS) {
      const car = new Car(this.scene, spec.x, spec.z, spec.color, spec.model, {
        heading: spec.red ? 0 : this._rand() * Math.PI * 2,
        taxi: !!spec.taxi,
        red: !!spec.red,
      });
      this.cars.push(car);
    }
    // Then the moving traffic: one car per road line, both directions.
    const colors = [0x3b6fd2, 0xe8e4d8, 0x2e8a4a, 0xd9a441, 0x8a5fb5, 0xc96a4a, 0x5a6a7a];
    const roads = [-120, -80, -40, 0, 40, 80, 120];
    for (let i = 0; i < CONFIG.TRAFFIC_COUNT; i++) {
      const alongRoad = i % 2 === 0;
      const road = roads[i % roads.length];
      const along = -140 + this._rand() * 280;
      const x = alongRoad ? road : along;
      const z = alongRoad ? along : road;
      const car = new Car(this.scene, x, z, colors[i % colors.length], 'sedan', {
        heading: alongRoad ? (this._rand() > 0.5 ? 0 : Math.PI) : (this._rand() > 0.5 ? Math.PI / 2 : -Math.PI / 2),
      });
      car.ai = {
        road,
        alongRoad,
        dir: this._rand() > 0.5 ? 1 : -1,
        speed: 8 + this._rand() * 6,
        lane: (this._rand() - 0.5) * 3,
      };
      this.cars.push(car);
    }
  }

  get parked() {
    return this.cars.filter((c) => !c.ai);
  }

  get redCar() {
    return this.cars.find((c) => c.red);
  }

  // Traffic drives straight down its road and wraps around at the ends,
  // slowing for the car ahead so the streets never jam into one pile.
  update(dt, playerCar) {
    for (const car of this.cars) {
      if (!car.ai) continue;
      const ai = car.ai;
      let targetSpeed = ai.speed;
      for (const other of this.cars) {
        if (other === car) continue;
        const d = distance2D(car.pos.x, car.pos.z, other.pos.x, other.pos.z);
        if (d < 9) {
          // Only brake for something actually in front of us.
          const aheadX = car.pos.x + Math.sin(car.heading) * 6;
          const aheadZ = car.pos.z + Math.cos(car.heading) * 6;
          if (distance2D(aheadX, aheadZ, other.pos.x, other.pos.z) < 7) targetSpeed = 0;
        }
      }
      if (playerCar && playerCar !== car) {
        const d = distance2D(car.pos.x, car.pos.z, playerCar.pos.x, playerCar.pos.z);
        if (d < 8) targetSpeed = 0;
      }
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
      const step = car.speed * ai.dir * dt;
      if (ai.alongRoad) {
        car.pos.z += step;
        car.setHeading(ai.dir > 0 ? 0 : Math.PI);
        car.pos.x = ai.road + ai.lane;
        if (car.pos.z > 180) car.pos.z = -180;
        if (car.pos.z < -180) car.pos.z = 180;
      } else {
        car.pos.x += step;
        car.setHeading(ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        car.pos.z = ai.road + ai.lane;
        if (car.pos.x > 180) car.pos.x = -180;
        if (car.pos.x < -180) car.pos.x = 180;
      }
      car.pos.y = 0;
    }
  }

  nearestParked(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.parked) {
      const d = distance2D(x, z, car.pos.x, car.pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  // The autopilot's road driving: steer toward a waypoint, slow for turns.
  autopilotDrive(car, target, dt, city) {
    const d = distance2D(car.pos.x, car.pos.z, target.x, target.z);
    const want = Math.atan2(target.x - car.pos.x, target.z - car.pos.z);
    const diff = angleDiff(car.heading, want);
    const steer = clamp(diff * 1.6, -1, 1);
    // Brake before a sharp turn or a waypoint: drive() only accelerates
    // on a positive throttle, so a low throttle alone arrives at the
    // corner at full speed and arcs the car into the building. Brake
    // hard until the car is slow enough to turn tightly (radius ~4 at
    // speed 8), then creep through the turn.
    let throttle = 1;
    if (Math.abs(diff) > 0.9 || d < 25) {
      throttle = car.speed > 8 ? -1 : 0.25;
    }
    if (d < 6) throttle = 0.25;
    car.drive(throttle, steer, dt, city);
    return d;
  }
}
