// Story missions M1–M4 plus the shell counter. The driver contract
// lives here: missionIndex, current {title}, marker {x,z}, goldCar and
// shellsTaken are plain mutable fields read by the playtest harness
// every poll (the staging module also writes them directly).
import { CFG } from './config.js';
import { makeCar } from './vehicles.js';

export function createMissions(G, ctx) {
  const M = {
    missionIndex: 0,
    current: { title: CFG.missions[0].title },
    marker: { x: CFG.landmarks.garage.marker.x, z: CFG.landmarks.garage.marker.z },
    goldCar: null,
    shellsTaken: 0,
    packageIdx: 0,
    m4Stage: 0, // 0 steal gold, 1 deliver, 2 escape
    timer: CFG.courierSeconds,
  };

  function setMission(i) {
    M.missionIndex = i;
    M.current = { title: CFG.missions[i].title };
  }

  function complete(text) {
    ctx.toast(text);
    ctx.audio.jingle();
    ctx.save();
  }

  function nearPlayer(x, z, r) {
    const p = ctx.playerPos();
    const dx = p.x - x, dz = p.z - z;
    return dx * dx + dz * dz < r * r;
  }

  const packageMarkers = [
    CFG.landmarks.hotel.marker,
    CFG.landmarks.pier.marker,
    CFG.landmarks.safehouse.marker,
  ];

  function spawnGold() {
    if (M.goldCar) return;
    const gold = makeCar(CFG.colors.gold, { gold: true });
    gold.place(CFG.goldCar.x, CFG.goldCar.z, Math.PI / 2);
    ctx.scene.add(gold.group);
    M.goldCar = gold;
    ctx.registerGoldCar(gold);
  }

  M.ensureGold = spawnGold;

  M.addShell = function () { M.shellsTaken++; };

  M.reset = function () {
    M.missionIndex = 0;
    M.current = { title: CFG.missions[0].title };
    M.marker = { x: CFG.landmarks.garage.marker.x, z: CFG.landmarks.garage.marker.z };
    M.goldCar = null;
    M.shellsTaken = 0;
    M.packageIdx = 0;
    M.m4Stage = 0;
    M.timer = CFG.courierSeconds;
  };

  // Called when the player steals any car.
  M.onSteal = function (car) {
    if (M.missionIndex === 3 && M.m4Stage === 0 && car === M.goldCar) {
      M.m4Stage = 1;
      M.marker = { x: CFG.landmarks.lighthouse.marker.x, z: CFG.landmarks.lighthouse.marker.z };
      ctx.police.setWanted(3);
      ctx.toast("Marlin's men called the cops — deliver the GT under 4 stars!");
    }
  };

  M.update = function (dt) {
    const L = CFG.landmarks;
    if (M.missionIndex === 0) {
      // M1 Hot Wheels: deliver a stolen car to the Marina Garage.
      if (ctx.playerCar() && nearPlayer(L.garage.marker.x, L.garage.marker.z, L.garage.radius)) {
        ctx.addMoney(CFG.economy.m1);
        setMission(1);
        M.packageIdx = 0;
        M.timer = CFG.courierSeconds;
        M.marker = { x: packageMarkers[0].x, z: packageMarkers[0].z };
        complete(`Mission 1 done — Hot Wheels! +$${CFG.economy.m1}`);
      }
    } else if (M.missionIndex === 1) {
      // M2 Sunset Courier: 3 packages on a 240s timer. The timer is
      // forgiving: it resets instead of failing the run, so a slow
      // headless pass still finishes the story.
      M.timer -= dt;
      if (M.timer <= 0) {
        M.timer = CFG.courierSeconds;
        ctx.toast('Courier timer reset — keep delivering!');
      }
      const mk = packageMarkers[M.packageIdx];
      const rad = M.packageIdx === 0 ? L.hotel.radius : M.packageIdx === 1 ? L.pier.radius : L.safehouse.radius;
      if (nearPlayer(mk.x, mk.z, rad)) {
        const pay = CFG.economy.m2[M.packageIdx];
        ctx.addMoney(pay);
        ctx.audio.cash();
        M.packageIdx++;
        if (M.packageIdx >= 3) {
          setMission(2);
          M.marker = { x: L.spray.marker.x, z: L.spray.marker.z };
          ctx.police.setWanted(3);
          ctx.combat.unlockPistol();
          complete(`Mission 2 done — Sunset Courier! +$${CFG.economy.m2[2]} — pistol unlocked, the heat is on!`);
        } else {
          M.marker = { x: packageMarkers[M.packageIdx].x, z: packageMarkers[M.packageIdx].z };
          ctx.toast(`Package ${M.packageIdx} of 3 delivered! +$${pay}`);
        }
      }
    } else if (M.missionIndex === 2) {
      // M3 The Heat: lose the stars, then reach the Safehouse.
      if (ctx.police.wanted === 0 && nearPlayer(L.safehouse.marker.x, L.safehouse.marker.z, L.safehouse.radius)) {
        ctx.addMoney(CFG.economy.m3);
        setMission(3);
        M.m4Stage = 0;
        // Park the gold Marlin GT by the hotel, on road x=126.
        spawnGold();
        M.marker = { x: CFG.goldCar.x, z: CFG.goldCar.z };
        complete(`Mission 3 done — The Heat! +$${CFG.economy.m3} — steal the gold Marlin GT!`);
      }
    } else if (M.missionIndex === 3) {
      // M4 Marlin's Debt: deliver the GT to the lighthouse, then escape.
      if (M.m4Stage === 1 && ctx.playerCar() === M.goldCar &&
          nearPlayer(L.lighthouse.marker.x, L.lighthouse.marker.z, L.lighthouse.radius)) {
        ctx.addMoney(CFG.economy.m4);
        M.m4Stage = 2;
        M.marker = { x: L.safehouse.marker.x, z: L.safehouse.marker.z };
        complete(`Gold GT delivered! +$${CFG.economy.m4} — now escape to the Safehouse!`);
      } else if (M.m4Stage === 2 && nearPlayer(L.safehouse.marker.x, L.safehouse.marker.z, L.safehouse.radius)) {
        M.missionIndex = 4;
        ctx.win();
      }
    }
  };

  return M;
}
