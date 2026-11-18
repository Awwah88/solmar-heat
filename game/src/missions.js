// Solmar Heat — missions and side work: Dana's four-mission story against the
// Marlin Club, plus a taxi job, a vigilante bonus and shells on the beach.
// The beacon pillar and the HUD objective always point at the next step.

import * as THREE from 'three';
import { CONFIG, dist2d } from './config.js';
import { makeCar } from './vehicles.js';

/** Build the mission system. `game` is the shared game object. */
export function createMissions(game) {
  const scene = game.scene;
  const L = CONFIG.landmarks;
  const E = CONFIG.economy;

  // One reusable beacon pillar + ground ring for the active objective.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 40, 12, 1, true), beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  // Shells: small golden spirals scattered off the driving line.
  const shellMeshes = [];
  const shellMat = new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0x664400 });
  for (const s of CONFIG.shells) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.22, 8, 12), shellMat);
    mesh.position.set(s.x, 0.5, s.z);
    mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
    shellMeshes.push({ mesh, x: s.x, z: s.z, taken: false });
  }

  const missions = [
    {
      id: 1, title: 'Hot Wheels',
      briefing: 'Dana owes the Marlin Club $400. Steal a car and bring it to the Marina Garage.',
      steps: [
        { text: 'Steal a car (walk up to one and press E)', target: null, check: () => !!game.player.car },
        { text: 'Drive the car to the Marina Garage', target: { x: L.marina.x, z: L.marina.z }, radius: 10 },
      ],
      reward: E.mission1,
    },
    {
      id: 2, title: 'Sunset Courier',
      briefing: 'Three packages, four minutes. Deliver them all — and keep the pistol.',
      steps: [
        { text: 'Deliver package 1/3 to Hotel Solmar', target: { x: 144, z: -144 }, radius: 9, pay: E.packageBonus },
        { text: 'Deliver package 2/3 to The Pier', target: { x: 60, z: 190 }, radius: 9, pay: E.packageBonus },
        { text: 'Deliver package 3/3 to the Safehouse', target: { x: 54, z: -54 }, radius: 9, pay: E.packageBonus },
      ],
      reward: E.mission2 - 3 * E.packageBonus,
      timed: CONFIG.missions.courierTime,
    },
    {
      id: 3, title: 'The Heat',
      briefing: 'The whole force is after you. Lose the heat, then slip home.',
      steps: [
        { text: 'Lose the heat — get your wanted level to zero', target: null, check: () => game.police.wanted === 0 },
        { text: 'Reach the Safehouse', target: { x: L.safehouse.x, z: L.safehouse.z }, radius: 9 },
      ],
      reward: E.mission3,
      onStart: () => { game.police.wanted = 3; },
    },
    {
      id: 4, title: "Marlin's Debt",
      briefing: "The boss's gold Marlin GT sits outside Hotel Solmar. Take it to the Old Lighthouse — with the whole city on your tail.",
      steps: [
        { text: 'Steal the gold Marlin GT at Hotel Solmar', target: { x: 126, z: -144 }, radius: 12, check: () => game.player.car === goldCar },
        { text: 'Deliver the Marlin GT to the Old Lighthouse', target: { x: 150, z: 176 }, radius: 9 },
        { text: 'Escape to the Safehouse', target: { x: L.safehouse.x, z: L.safehouse.z }, radius: 9 },
      ],
      reward: E.mission4,
      onStart: () => { spawnGoldCar(); },
    },
  ];

  let missionIndex = 0;
  let stepIndex = 0;
  let timer = 0;
  let goldCar = null;
  let finished = false;

  // Taxi side job.
  let taxi = { state: 'idle', passenger: null, dest: null, at: 0 };
  // Vigilante side job: ram the black getaway car three times.
  let vigilante = { car: null, hits: 0, lastHitAt: 0, respawnAt: 0 };
  let shellsTaken = 0;

  function spawnGoldCar() {
    if (goldCar) return;
    goldCar = makeCar(scene, CONFIG.colors.gold, 126, -144, Math.PI, { gold: true });
    goldCar.group.children.forEach((c) => { if (c.material && c.material.emissive !== undefined) c.material.emissive = new THREE.Color(0x442200); });
  }

  function currentMission() {
    return missions[missionIndex] || null;
  }

  function currentStep() {
    const m = currentMission();
    return m ? m.steps[stepIndex] || null : null;
  }

  function setObjective(text) {
    game.hud.setObjective(text);
  }

  function startMission(i) {
    missionIndex = i;
    stepIndex = 0;
    const m = currentMission();
    if (!m) return;
    timer = m.timed || 0;
    if (m.onStart) m.onStart();
    game.hud.toast(`Mission ${m.id}: ${m.title}`, m.briefing);
    setObjective(m.steps[0].text);
  }

  function completeMission() {
    const m = currentMission();
    game.addMoney(m.reward);
    game.audio.jingle();
    game.hud.toast(`Mission complete: ${m.title}`, `+$${m.reward}`);
    game.save();
    if (m.id === 2) {
      game.combat.givePistol();
      game.hud.toast('New weapon', 'Pistol unlocked — click to shoot');
      spawnVigilante();
    }
    missionIndex++;
    stepIndex = 0;
    if (missionIndex >= missions.length) {
      finished = true;
      game.win();
      return;
    }
    startMission(missionIndex);
  }

  function spawnVigilante() {
    if (vigilante.car) return;
    const roads = CONFIG.world.roads;
    const road = roads[Math.floor(Math.random() * roads.length)];
    vigilante.car = makeCar(scene, 0x111111, road, -54, 0, {});
    vigilante.hits = 0;
  }

  function startTaxi() {
    const ped = game.pedestrians.nearest(game.playerPos().x, game.playerPos().z, 30, game.time);
    if (!ped) return false;
    const dests = [L.marina, L.hotel, L.pier, L.spray];
    const dest = dests[Math.floor(Math.random() * dests.length)];
    taxi = { state: 'waiting', passenger: ped, dest, at: 0 };
    game.hud.toast('Taxi fare', `Pick up the passenger, then drive to ${dest.name}`);
    return true;
  }

  return {
    get current() {
      return currentMission();
    },
    get missionIndex() {
      return missionIndex;
    },
    get goldCar() {
      return goldCar;
    },
    get finished() {
      return finished;
    },
    get shellsTaken() {
      return shellsTaken;
    },
    get marker() {
      const step = currentStep();
      if (step && step.target) return step.target;
      if (taxi.state === 'riding' && taxi.dest) return taxi.dest;
      if (taxi.state === 'waiting' && taxi.passenger) {
        const p = taxi.passenger.group.position;
        return { x: p.x, z: p.z };
      }
      if (vigilante.car && vigilante.hits < 3) {
        const p = vigilante.car.group.position;
        return { x: p.x, z: p.z, red: true };
      }
      return null;
    },

    start() {
      startMission(0);
    },

    /** Jump straight to a mission (used to stage the mission screenshot). */
    jumpTo(i) {
      missionIndex = Math.max(0, Math.min(i, missions.length - 1));
      stepIndex = 0;
      finished = false;
      const m = currentMission();
      if (!m) return;
      timer = m.timed || 0;
      if (m.onStart) m.onStart();
      if (missionIndex >= 2) game.combat.givePistol();
      setObjective(m.steps[0].text);
    },

    reset() {
      missionIndex = 0;
      stepIndex = 0;
      finished = false;
      if (goldCar) {
        scene.remove(goldCar.group);
        goldCar = null;
      }
      if (vigilante.car) {
        scene.remove(vigilante.car.group);
        vigilante.car = null;
      }
      taxi = { state: 'idle', passenger: null, dest: null, at: 0 };
      for (const s of shellMeshes) {
        s.taken = false;
        s.mesh.visible = true;
      }
      shellsTaken = 0;
      beacon.visible = false;
      ring.visible = false;
      startMission(0);
    },

    /** Called when the player presses E near a passenger. */
    tryTaxiInteract() {
      if (taxi.state === 'idle') return startTaxi();
      if (taxi.state === 'waiting') {
        const p = game.playerPos();
        const pp = taxi.passenger.group.position;
        if (dist2d(p.x, p.z, pp.x, pp.z) < 3.5) {
          taxi.state = 'riding';
          game.hud.toast('Passenger aboard', `Drive to ${taxi.dest.name} — $${E.taxiFare}`);
          return true;
        }
      }
      return false;
    },

    update(dt, time) {
      const m = currentMission();
      const p = game.playerPos();
      if (m && !finished) {
        if (m.timed) {
          timer -= dt;
          if (timer <= 0) {
            game.hud.toast('Too slow', `${m.title} failed — try again`);
            startMission(missionIndex);
            return;
          }
        }
        const step = currentStep();
        if (step) {
          let done = false;
          if (step.check) done = step.check();
          else if (step.target && dist2d(p.x, p.z, step.target.x, step.target.z) < (step.radius || 9)) done = true;
          if (done) {
            if (step.pay) {
              game.addMoney(step.pay);
              game.hud.toast(`Package delivered`, `+$${step.pay}`);
            }
            if (m.id === 4 && stepIndex === 0 && game.player.car === goldCar) {
              game.police.wanted = 4;
              game.hud.toast('The whole city is coming', 'Wanted level 4 — run!');
            }
            stepIndex++;
            if (stepIndex >= m.steps.length) {
              completeMission();
              return;
            }
            setObjective(currentStep().text);
          }
          // Beacon + objective display.
          const s = currentStep();
          if (s && s.target) {
            beacon.visible = true;
            beacon.position.set(s.target.x, 20, s.target.z);
            beacon.rotation.y = time * 0.5;
            ring.visible = true;
            ring.position.set(s.target.x, 0.1, s.target.z);
            ring.scale.setScalar(1 + Math.sin(time * 4) * 0.12);
          } else {
            beacon.visible = false;
            ring.visible = false;
          }
          if (m.timed) {
            game.hud.setObjective(`${s ? s.text : ''}  —  ${Math.ceil(timer)}s`);
          } else if (s) {
            setObjective(s.text);
          }
        }
      }

      // Taxi: deliver the passenger.
      if (taxi.state === 'riding' && taxi.dest) {
        if (game.player.car && dist2d(p.x, p.z, taxi.dest.x, taxi.dest.z) < 9) {
          game.addMoney(E.taxiFare);
          game.hud.toast('Fare complete', `+$${E.taxiFare}`);
          taxi = { state: 'idle', passenger: null, dest: null, at: time + 15 };
        }
      } else if (taxi.state === 'idle' && time > taxi.at && !game.player.car) {
        // Offer a new fare every so often while on foot.
        if (Math.random() < dt * 0.05) startTaxi();
      }

      // Vigilante: ram the black getaway car three times.
      if (vigilante.car && game.player.car) {
        const vp = vigilante.car.group.position;
        const d = dist2d(p.x, p.z, vp.x, vp.z);
        if (d < 3.6 && Math.abs(game.player.car.speed) > 8 && time - vigilante.lastHitAt > 2) {
          vigilante.lastHitAt = time;
          vigilante.hits++;
          game.audio.crash();
          game.hud.toast(`Vigilante ${vigilante.hits}/3`, 'Keep ramming the getaway car!');
          if (vigilante.hits >= 3) {
            game.addMoney(E.vigilanteBonus);
            game.hud.toast('Vigilante bonus', `+$${E.vigilanteBonus}`);
            scene.remove(vigilante.car.group);
            vigilante.car = null;
            vigilante.respawnAt = time + 45;
          }
        }
      } else if (!vigilante.car && vigilante.respawnAt > 0 && time > vigilante.respawnAt && game.combat.pistolOwned) {
        vigilante.respawnAt = 0;
        spawnVigilante();
      }

      // Shells: walk or drive over one to collect it.
      for (const s of shellMeshes) {
        if (s.taken) continue;
        s.mesh.rotation.z += dt;
        if (dist2d(p.x, p.z, s.x, s.z) < 2.4) {
          s.taken = true;
          s.mesh.visible = false;
          shellsTaken++;
          game.addMoney(E.shellValue);
          game.audio.blip();
          game.hud.toast('Shell found', `+$${E.shellValue}  (${shellsTaken}/10)`);
        }
      }
    },
  };
}
