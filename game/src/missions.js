// Solmar Heat — missions, taxi fares, doubloons and street races (Round 17).
// M1-M6 story chain, each with its own stage machine. The win screen only
// shows after M6 (the Bank Job) is done. Never assign doneIds directly —
// use setDone(), which keeps the reward total in sync.
import * as THREE from 'three';
import { MISSIONS, PARKED, PACKAGES, DOUBLOONS, RACES, LANDMARKS, TUNING, dist2d } from './config.js';

const VAULT_ZONE = { x: 54, z: 140, r: 7 };
const AIRPORT_ZONE = { x: 150, z: -168, r: 9 };

export class Missions {
  constructor(game) {
    this.game = game;
    this.current = { id: 1, title: MISSIONS[0].title };
    this.stage = 0;
    this.timer = 0;
    this.delivered = new Set();
    this.doneIds = [];
    this.doneCount = 0;
    this.totalEarned = 0;
    this.vaultProgress = 0;
    this._vaultTick = 0;
    this.taxi = { active: false, hasPassenger: false, streak: 0, pickup: null, dest: null, timer: 0 };
    this.race = { active: false, id: -1, checkpoint: 0, time: 0, best: {} };
    this._doubloonsLeft = new Set(DOUBLOONS.map((_, i) => i));
    this._cashLeft = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    this._beacon = null;
    this._pkgMeshes = [];
    this._coinMeshes = [];
    this._cashMeshes = [];
    this._fareMesh = null;
    this._raceMesh = null;
    this._buildMarkers();
    this._spawnFare();
  }

  _ring(color, r) {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.35, 8, 32),
      new THREE.MeshBasicMaterial({ color }),
    );
    m.rotation.x = Math.PI / 2;
    return m;
  }

  _buildMarkers() {
    const scene = this.game.scene;
    // Objective beacon: a tall glowing pillar at the current target.
    const beacon = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 26, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc233, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    pillar.position.y = 13;
    beacon.add(pillar);
    const ring = this._ring(0xffc233, 4);
    ring.position.y = 0.4;
    beacon.add(ring);
    beacon.visible = false;
    scene.add(beacon);
    this._beacon = beacon;
    // Package markers (M2).
    for (const p of PACKAGES) {
      const mesh = new THREE.Group();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.6, 1.6),
        new THREE.MeshStandardMaterial({ color: 0xffc233, roughness: 0.4, metalness: 0.3, emissive: 0x664400 }),
      );
      box.position.y = 1.2;
      mesh.add(box);
      mesh.add(this._ring(0xffc233, 3));
      mesh.position.set(p.x, 0, p.z);
      mesh.visible = false;
      scene.add(mesh);
      this._pkgMeshes.push(mesh);
    }
    // Doubloon coins.
    for (const d of DOUBLOONS) {
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 1.0, 0.25, 16),
        new THREE.MeshStandardMaterial({ color: 0xffd34d, roughness: 0.25, metalness: 0.8, emissive: 0x553300 }),
      );
      coin.rotation.x = Math.PI / 2;
      coin.position.set(d.x, 1.4, d.z);
      scene.add(coin);
      this._coinMeshes.push(coin);
    }
    // Cash pickups.
    const cashSpots = [
      { x: 18, z: -54 }, { x: -90, z: 18 }, { x: 90, z: -90 }, { x: -18, z: 126 },
      { x: 126, z: 54 }, { x: -126, z: -126 }, { x: 54, z: -54 }, { x: -54, z: -126 },
    ];
    this._cashSpots = cashSpots;
    for (const c of cashSpots) {
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 0.2, 16),
        new THREE.MeshBasicMaterial({ color: 0x37d67a }),
      );
      disc.position.set(c.x, 0.6, c.z);
      scene.add(disc);
      this._cashMeshes.push(disc);
    }
  }

  setDone(list) {
    this.doneIds = [...list];
    this.doneCount = list.length;
    this.totalEarned = list.reduce((sum, id) => {
      const m = MISSIONS.find((x) => x.id === id);
      return sum + (m ? m.reward : 0);
    }, 0);
  }

  objective() {
    if (!this.current) return 'All missions done — Solmar is yours.';
    const m = this.current;
    if (m.id === 1) return 'M1 Hot Wheels — steal the red sedan at the Marina Garage.';
    if (m.id === 2) {
      const left = 3 - this.delivered.size;
      return `M2 Sunset Courier — deliver ${left} more package${left === 1 ? '' : 's'} (${Math.ceil(this.timer)}s left).`;
    }
    if (m.id === 3) return this.game.police.wanted > 0
      ? 'M3 The Heat — lose the cops, then reach the Safehouse.'
      : 'M3 The Heat — reach the Safehouse.';
    if (m.id === 4) {
      if (this.stage === 0) return "M4 Marlin's Debt — steal the gold Marlin GT at the Hotel.";
      if (this.stage === 1) return "M4 Marlin's Debt — deliver the GT to the Old Lighthouse (stay under 4 stars).";
      return "M4 Marlin's Debt — escape to the Safehouse.";
    }
    if (m.id === 5) {
      if (this.stage === 0) return "M5 The Marlin's Last Hand — steal the black limo at the Casino.";
      if (this.stage === 1) return 'M5 — outrun the 4-star chase to the Boardwalk.';
      return `M5 — deliver the limo to the Pier (${Math.ceil(this.timer)}s left).`;
    }
    if (m.id === 6) {
      if (this.stage === 0) return 'M6 The Solmar Bank Job — steal the armored van at the Bank.';
      if (this.stage === 1) return `M6 — crack the vault: hold the van at the Bank dock (${Math.ceil(this.vaultProgress)}/8s).`;
      return 'M6 — escape the 5-star chase to the Airport runway!';
    }
    return m.title;
  }

  startMission(id) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) return;
    this.current = { id: def.id, title: def.title };
    this.stage = 0;
    this.timer = 0;
    this.delivered = new Set();
    this.vaultProgress = 0;
    if (id === 2) this.timer = TUNING.m2TimeLimit;
    if (id === 3) this.game.police.setWanted(3);
    this.game.hud.setObjective(this.objective());
  }

  completeMission(id) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def || this.doneIds.includes(id)) return;
    const list = [...this.doneIds, id];
    this.setDone(list);
    this.game.money += def.reward;
    this.game.audio.missionDone();
    this.game.hud.toast(`${def.title} complete! +$${def.reward}`);
    if (id === 2) this.game.combat.hasPistol = true;
    if (list.length >= MISSIONS.length) {
      this.current = null;
      this.game.win();
      return;
    }
    this.startMission(id + 1);
  }

  onEnterCar(car) {
    const g = this.game;
    g.police.addWanted(1);
    if (!this.current) return;
    if (this.current.id === 1 && car.label === 'Red Sedan') {
      this.completeMission(1);
    } else if (this.current.id === 4 && this.stage === 0 && car.label === 'Marlin GT') {
      this.stage = 1;
      g.police.setWanted(2);
      g.hud.toast('Gold Marlin GT secured — take it to the Lighthouse.');
      g.hud.setObjective(this.objective());
    } else if (this.current.id === 5 && this.stage === 0 && car.label === 'Marlin Limo') {
      this.stage = 1;
      g.police.setWanted(4);
      g.hud.toast('Limo secured — 4-star chase! Get to the Boardwalk.');
      g.hud.setObjective(this.objective());
    } else if (this.current.id === 6 && this.stage === 0 && car.label === 'Armored Van') {
      this.stage = 1;
      g.police.setWanted(4);
      g.hud.toast('Armored van secured — park at the Bank dock and crack the vault.');
      g.hud.setObjective(this.objective());
    }
  }

  _spawnFare() {
    const g = this.game;
    const roads = [-126, -90, -54, -18, 18, 54, 90, 126];
    const px = roads[Math.floor(Math.random() * roads.length)];
    const pz = roads[Math.floor(Math.random() * roads.length)];
    const dx = roads[Math.floor(Math.random() * roads.length)];
    const dz = roads[Math.floor(Math.random() * roads.length)];
    this.taxi = { active: true, hasPassenger: false, streak: this.taxi.streak || 0, pickup: { x: px, z: pz }, dest: { x: dx, z: dz }, timer: 0 };
    if (!this._fareMesh) {
      const mesh = new THREE.Group();
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 3, 4),
        new THREE.MeshBasicMaterial({ color: 0x37d67a }),
      );
      cone.position.y = 2.2;
      cone.rotation.y = Math.PI / 4;
      mesh.add(cone);
      mesh.add(this._ring(0x37d67a, 3));
      g.scene.add(mesh);
      this._fareMesh = mesh;
    }
    this._fareMesh.visible = true;
    this._fareMesh.position.set(px, 0, pz);
  }

  _updateTaxi(dt, p) {
    const t = this.taxi;
    if (!t.active) return;
    if (!t.hasPassenger) {
      if (dist2d(p.x, p.z, t.pickup.x, t.pickup.z) < 6) {
        t.hasPassenger = true;
        t.timer = 90;
        this._fareMesh.position.set(t.dest.x, 0, t.dest.z);
        this.game.hud.toast('Passenger aboard — drive to the destination!');
        this.game.audio.pickup();
      }
    } else {
      t.timer -= dt;
      if (dist2d(p.x, p.z, t.dest.x, t.dest.z) < 7) {
        const tip = 5 * t.streak;
        const pay = TUNING.taxiFare + tip;
        this.game.money += pay;
        t.streak += 1;
        this.game.audio.coin();
        this.game.hud.toast(`Fare complete! +$${pay} (streak ${t.streak})`);
        this._spawnFare();
      } else if (t.timer <= 0) {
        t.streak = 0;
        this.game.hud.toast('Fare timed out — streak reset.');
        this._spawnFare();
      }
    }
  }

  startRace(id) {
    const g = this.game;
    const def = RACES[id];
    if (!def || !g.player.car) return false;
    const p = g.playerPos();
    if (dist2d(p.x, p.z, def.start.x, def.start.z) > 12) return false;
    this.race = { active: true, id, checkpoint: 0, time: 0, best: this.race.best || {} };
    g.audio.raceBeep(false);
    g.hud.toast(`${def.name} — GO! Hit the checkpoints.`);
    if (!this._raceMesh) {
      const mesh = new THREE.Group();
      mesh.add(this._ring(0x19e3ff, 5));
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 3, 4),
        new THREE.MeshBasicMaterial({ color: 0x19e3ff }),
      );
      cone.position.y = 2.2;
      cone.rotation.y = Math.PI / 4;
      mesh.add(cone);
      g.scene.add(mesh);
      this._raceMesh = mesh;
    }
    this._raceMesh.visible = true;
    this._raceMesh.position.set(def.checkpoints[0].x, 0, def.checkpoints[0].z);
    return true;
  }

  _updateRace(dt, p) {
    const r = this.race;
    if (!r.active) return;
    r.time += dt;
    const def = RACES[r.id];
    const target = r.checkpoint < def.checkpoints.length
      ? def.checkpoints[r.checkpoint]
      : def.start;
    if (dist2d(p.x, p.z, target.x, target.z) < 8) {
      r.checkpoint += 1;
      this.game.audio.pickup();
      if (r.checkpoint > def.checkpoints.length) {
        // Finished: back at the start after all checkpoints.
        const pay = def.reward + ((r.best[r.id] === undefined || r.time < r.best[r.id]) ? def.bonus : 0);
        const isBest = r.best[r.id] === undefined || r.time < r.best[r.id];
        if (isBest) r.best[r.id] = Math.round(r.time * 10) / 10;
        this.game.money += pay;
        this.game.audio.missionDone();
        this.game.hud.toast(`${def.name} finished in ${r.time.toFixed(1)}s! +$${pay}${isBest ? ' (new best!)' : ''}`);
        this.race = { active: false, id: -1, checkpoint: 0, time: 0, best: r.best };
        if (this._raceMesh) this._raceMesh.visible = false;
        this.game.saveGame();
      } else if (r.checkpoint < def.checkpoints.length) {
        this._raceMesh.position.set(def.checkpoints[r.checkpoint].x, 0, def.checkpoints[r.checkpoint].z);
      } else {
        this._raceMesh.position.set(def.start.x, 0, def.start.z);
        this.game.hud.toast('Final stretch — back to the start!');
      }
    }
  }

  _objectiveTarget() {
    if (!this.current) return null;
    const m = this.current;
    if (m.id === 1) return { ...PARKED.red, color: 0xffc233 };
    if (m.id === 2) {
      const next = [0, 1, 2].find((i) => !this.delivered.has(i));
      return next === undefined ? null : { ...PACKAGES[next], color: 0xffc233 };
    }
    if (m.id === 3) return this.game.police.wanted > 0 ? null : { ...LANDMARKS.safehouse.marker, color: 0x37d67a };
    if (m.id === 4) {
      if (this.stage === 0) return { ...PARKED.gold, color: 0xffc233 };
      if (this.stage === 1) return { ...LANDMARKS.lighthouse.marker, color: 0xffc233 };
      return { ...LANDMARKS.safehouse.marker, color: 0x37d67a };
    }
    if (m.id === 5) {
      if (this.stage === 0) return { ...PARKED.limo, color: 0xff2e88 };
      if (this.stage === 1) return { ...LANDMARKS.boardwalk.marker, color: 0xff2e88 };
      return { ...LANDMARKS.pier.marker, color: 0xff2e88 };
    }
    if (m.id === 6) {
      if (this.stage === 0) return { ...PARKED.van, color: 0xffc233 };
      if (this.stage === 1) return { ...VAULT_ZONE, color: 0xffc233 };
      return { ...AIRPORT_ZONE, color: 0x19e3ff };
    }
    return null;
  }

  update(dt, time) {
    const g = this.game;
    const p = g.playerPos();
    const inCar = !!g.player.car;
    // Mission timers.
    if (this.current && this.current.id === 2) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.delivered = new Set();
        this.timer = TUNING.m2TimeLimit;
        g.money = Math.max(0, g.money - 25);
        g.hud.toast('Courier run failed — packages reset. -$25');
      }
    }
    if (this.current && this.current.id === 5 && this.stage === 2) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.stage = 1;
        g.hud.toast('Delivery timer ran out — get back to the Boardwalk.');
        g.hud.setObjective(this.objective());
      }
    }
    if (this.current && this.current.id === 6 && this.stage === 2) {
      // Escape timer is pressure only — running out never fails the mission.
      this.timer = Math.max(0, this.timer - dt);
    }
    // M2 package pickups.
    if (this.current && this.current.id === 2) {
      PACKAGES.forEach((pkg, i) => {
        if (!this.delivered.has(i) && dist2d(p.x, p.z, pkg.x, pkg.z) < 7) {
          this.delivered.add(i);
          g.audio.pickup();
          g.hud.toast(`Package ${i + 1}/3 delivered.`);
          if (this.delivered.size === 3) this.completeMission(2);
          else g.hud.setObjective(this.objective());
        }
      });
    }
    // M3: safehouse with no wanted stars.
    if (this.current && this.current.id === 3 && g.police.wanted === 0) {
      if (dist2d(p.x, p.z, LANDMARKS.safehouse.marker.x, LANDMARKS.safehouse.marker.z) < 10) {
        this.completeMission(3);
      }
    }
    // M4 stages.
    if (this.current && this.current.id === 4) {
      const inGold = inCar && g.player.car.label === 'Marlin GT';
      if (this.stage === 1 && inGold && dist2d(p.x, p.z, LANDMARKS.lighthouse.marker.x, LANDMARKS.lighthouse.marker.z) < 12) {
        this.stage = 2;
        g.hud.toast('GT dropped at the Lighthouse — now escape to the Safehouse.');
        g.hud.setObjective(this.objective());
      } else if (this.stage === 2 && dist2d(p.x, p.z, LANDMARKS.safehouse.marker.x, LANDMARKS.safehouse.marker.z) < 10) {
        this.completeMission(4);
      }
    }
    // M5 stages.
    if (this.current && this.current.id === 5) {
      const inLimo = inCar && g.player.car.label === 'Marlin Limo';
      if (this.stage === 1 && inLimo && dist2d(p.x, p.z, LANDMARKS.boardwalk.marker.x, LANDMARKS.boardwalk.marker.z) < 10) {
        this.stage = 2;
        this.timer = TUNING.m5TimeLimit;
        g.hud.toast('Boardwalk reached — deliver the limo to the Pier, fast!');
        g.hud.setObjective(this.objective());
      } else if (this.stage === 2 && inLimo && dist2d(p.x, p.z, LANDMARKS.pier.marker.x, LANDMARKS.pier.marker.z) < 10) {
        this.completeMission(5);
      }
    }
    // M6 stages.
    if (this.current && this.current.id === 6) {
      const inVan = inCar && g.player.car.label === 'Armored Van';
      if (this.stage === 1 && inVan && dist2d(p.x, p.z, VAULT_ZONE.x, VAULT_ZONE.z) < VAULT_ZONE.r) {
        this.vaultProgress += dt;
        this._vaultTick += dt;
        if (this._vaultTick > 1) {
          this._vaultTick = 0;
          g.audio.vaultTick();
        }
        if (this.vaultProgress >= TUNING.m6VaultSeconds) {
          this.stage = 2;
          this.timer = TUNING.m6TimeLimit;
          g.police.setWanted(TUNING.m6ChaseStars);
          g.audio.vaultOpen();
          g.hud.toast('VAULT CRACKED! 5 stars — run for the Airport runway!');
          g.hud.setObjective(this.objective());
        }
      } else if (this.stage === 2 && inVan && dist2d(p.x, p.z, AIRPORT_ZONE.x, AIRPORT_ZONE.z) < AIRPORT_ZONE.r) {
        this.completeMission(6);
      }
    }
    // Doubloons + cash.
    this._doubloonsLeft.forEach((i) => {
      const d = DOUBLOONS[i];
      if (dist2d(p.x, p.z, d.x, d.z) < 3.5) {
        this._doubloonsLeft.delete(i);
        this._coinMeshes[i].visible = false;
        g.audio.coin();
        const left = this._doubloonsLeft.size;
        if (left === 0) {
          g.money += TUNING.doubloonBonus;
          g.hud.toast(`All 12 doubloons! +$${TUNING.doubloonBonus}`);
        } else {
          g.hud.toast(`Doubloon found! ${12 - left}/12`);
        }
      }
    });
    this._cashLeft.forEach((i) => {
      const c = this._cashSpots[i];
      if (dist2d(p.x, p.z, c.x, c.z) < 3.5) {
        this._cashLeft.delete(i);
        this._cashMeshes[i].visible = false;
        g.money += TUNING.cashPickup;
        g.audio.coin();
        g.hud.toast(`+$${TUNING.cashPickup} cash.`);
      }
    });
    this._updateTaxi(dt, p);
    this._updateRace(dt, p);
    // Marker visibility + spin.
    this._pkgMeshes.forEach((mesh, i) => {
      mesh.visible = !!(this.current && this.current.id === 2 && !this.delivered.has(i));
      mesh.rotation.y += dt;
    });
    this._coinMeshes.forEach((coin, i) => {
      if (this._doubloonsLeft.has(i)) coin.rotation.y += dt * 2;
    });
    // Beacon follows the current objective.
    const target = this._objectiveTarget();
    if (target) {
      this._beacon.visible = true;
      this._beacon.position.set(target.x, 0, target.z);
      this._beacon.children[0].material.color.setHex(target.color || 0xffc233);
      this._beacon.children[1].material.color.setHex(target.color || 0xffc233);
    } else {
      this._beacon.visible = false;
    }
  }

  getSaveData() {
    return {
      doneIds: this.doneIds,
      currentId: this.current ? this.current.id : null,
      stage: this.stage,
      doubloonsLeft: [...this._doubloonsLeft],
      raceBest: this.race.best || {},
      taxiStreak: this.taxi.streak || 0,
      pistol: this.game.combat.hasPistol,
    };
  }

  applySave(d) {
    if (!d) return;
    if (Array.isArray(d.doneIds)) this.setDone(d.doneIds);
    if (Array.isArray(d.doubloonsLeft)) {
      this._doubloonsLeft = new Set(d.doubloonsLeft);
      DOUBLOONS.forEach((_, i) => {
        if (!this._doubloonsLeft.has(i) && this._coinMeshes[i]) this._coinMeshes[i].visible = false;
      });
    }
    if (d.raceBest) this.race.best = d.raceBest;
    if (typeof d.taxiStreak === 'number') this.taxi.streak = d.taxiStreak;
    if (d.pistol) this.game.combat.hasPistol = true;
    if (d.currentId) {
      const def = MISSIONS.find((m) => m.id === d.currentId);
      if (def && !this.doneIds.includes(def.id)) {
        this.current = { id: def.id, title: def.title };
        this.stage = d.stage || 0;
        if (def.id === 2) this.timer = TUNING.m2TimeLimit;
      }
    }
  }
}
