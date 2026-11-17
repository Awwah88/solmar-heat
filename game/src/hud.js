// Solmar Heat — hud.js
// Everything drawn over the 3D view: money, health, wanted stars, the
// mission panel and timer, toasts, speed, the minimap, and the menus
// (start, pause, end). The HUD owns the DOM; the Game tells it what to
// show through small setter methods. The minimap is drawn in layers —
// base map, markers, traffic and police, then the player arrow — so
// each layer is easy to follow on its own.

import { CONTROLS, GAME_SUBTITLE, GAME_TITLE, STORY } from './config.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud');
    this.marker = null;
    this.markerLabel = '';
    this.build();
  }

  // Build the whole overlay once: the in-play widgets plus the three
  // menus (start, pause, end), then wire every button to the Game.
  build() {
    this.root.innerHTML = `
      <div id="topbar">
        <div id="money">$0</div>
        <div id="healthWrap"><div id="healthBar"></div><span id="healthText">100</span></div>
        <div id="wanted"></div>
      </div>
      <div id="missionPanel"><div id="missionTitle"></div><div id="missionBrief"></div><div id="missionTimer"></div></div>
      <div id="toast"></div>
      <div id="speedo"></div>
      <div id="hint">WASD move &nbsp;·&nbsp; E enter car &nbsp;·&nbsp; F punch &nbsp;·&nbsp; T taxi &nbsp;·&nbsp; P pause</div>
      <canvas id="minimap" width="200" height="200"></canvas>
      <div id="crosshair">+</div>
      <div id="damageFlash"></div>
      <div id="menu" class="overlay">
        <h1>${GAME_TITLE}</h1>
        <p class="sub">${GAME_SUBTITLE}</p>
        <p class="story"><b>${STORY.hero}</b> — ${STORY.heroLine}</p>
        <p class="story">${STORY.intro}</p>
        <div id="menuButtons">
          <button id="btnStart">▶ START STORY</button>
          <button id="btnContinue">↻ CONTINUE SAVE</button>
          <button id="btnHow">HOW TO PLAY</button>
        </div>
        <div id="controlsList" style="display:none"></div>
        <p class="fine">An original game. Solmar Bay, its people and its cars are invented — nothing is taken from any commercial game. Best played in desktop Chrome, keyboard + mouse, sound on.</p>
      </div>
      <div id="pauseMenu" class="overlay" style="display:none">
        <h1>PAUSED</h1>
        <p class="story">The city waits for you.</p>
        <button id="btnResume">RESUME</button>
        <button id="btnSave">SAVE GAME</button>
        <button id="btnRestart">RESTART FROM SAVE</button>
        <button id="btnQuit">QUIT TO MENU</button>
      </div>
      <div id="endMenu" class="overlay" style="display:none">
        <h1 id="endTitle"></h1>
        <p class="story" id="endText"></p>
        <button id="btnEndContinue">CONTINUE FREE ROAM</button>
        <button id="btnEndRestart">RESTART STORY</button>
      </div>`;
    this.moneyEl = document.getElementById('money');
    this.healthBar = document.getElementById('healthBar');
    this.healthText = document.getElementById('healthText');
    this.wantedEl = document.getElementById('wanted');
    this.missionTitle = document.getElementById('missionTitle');
    this.missionBrief = document.getElementById('missionBrief');
    this.missionTimer = document.getElementById('missionTimer');
    this.toastEl = document.getElementById('toast');
    this.speedo = document.getElementById('speedo');
    this.minimap = document.getElementById('minimap');
    this.mm = this.minimap.getContext('2d');
    this.menu = document.getElementById('menu');
    this.pauseMenu = document.getElementById('pauseMenu');
    this.endMenu = document.getElementById('endMenu');
    this.toastTimer = null;
    this.wireButtons();
  }

  wireButtons() {
    document.getElementById('btnStart').addEventListener('click', () => this.game.startNewGame());
    document.getElementById('btnContinue').addEventListener('click', () => this.game.continueGame());
    document.getElementById('btnResume').addEventListener('click', () => this.game.resumeGame());
    document.getElementById('btnSave').addEventListener('click', () => {
      this.game.saveGame();
      this.toast('Game saved.');
    });
    document.getElementById('btnRestart').addEventListener('click', () => this.game.restartFromSave());
    document.getElementById('btnQuit').addEventListener('click', () => this.game.quitToMenu());
    document.getElementById('btnEndContinue').addEventListener('click', () => this.game.resumeGame());
    document.getElementById('btnEndRestart').addEventListener('click', () => this.game.startNewGame());
    document.getElementById('btnHow').addEventListener('click', () => {
      const list = document.getElementById('controlsList');
      list.style.display = list.style.display === 'none' ? 'block' : 'none';
      list.innerHTML = CONTROLS.map(([k, v]) => `<div><b>${k}</b> — ${v}</div>`).join('');
    });
  }

  showMenu(show) {
    this.menu.style.display = show ? 'flex' : 'none';
  }

  showPause(show) {
    this.pauseMenu.style.display = show ? 'flex' : 'none';
  }

  showEnd(title, text) {
    document.getElementById('endTitle').textContent = title;
    document.getElementById('endText').textContent = text;
    this.endMenu.style.display = 'flex';
  }

  hideEnd() {
    this.endMenu.style.display = 'none';
  }

  setMoney(amount) {
    this.moneyEl.textContent = `$${Math.floor(amount)}`;
  }

  setHealth(health) {
    this.healthBar.style.width = `${Math.max(0, health)}%`;
    this.healthBar.style.background = health > 50 ? '#37b268' : health > 25 ? '#f2c230' : '#d23b3b';
    this.healthText.textContent = `${Math.ceil(health)}`;
  }

  setWanted(stars) {
    this.wantedEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    this.wantedEl.style.color = stars > 0 ? '#ffd23b' : '#ffffff88';
  }

  setObjective(title, brief) {
    this.missionTitle.textContent = title;
    this.missionBrief.textContent = brief;
  }

  setTimer(seconds) {
    this.missionTimer.textContent = seconds > 0 ? `⏱ ${seconds}s` : '';
  }

  setSpeed(speed, inCar) {
    this.speedo.textContent = inCar ? `${Math.round(Math.abs(speed) * 3.2)} km/h` : '';
  }

  setMarker(spot, label) {
    this.marker = spot;
    this.markerLabel = label || '';
  }

  toast(text, ms = 3600) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.style.opacity = '0';
    }, ms);
  }

  flashDamage() {
    const el = document.getElementById('damageFlash');
    el.style.opacity = '0.35';
    setTimeout(() => {
      el.style.opacity = '0';
    }, 140);
  }

  // --- Minimap -------------------------------------------------------
  // The map covers x,z in [-200, 200] on a 200px canvas. Each layer
  // draws on top of the last: the base, the objective marker, the
  // spray shop, traffic, police and cash, then the player arrow.

  drawMinimap(game) {
    const ctx = this.mm;
    const W = 200;
    const scale = W / 400;
    const toX = (x) => (x + 200) * scale;
    const toZ = (z) => (z + 200) * scale;
    this.drawMapBase(ctx, W, scale, toX, toZ);
    this.drawMapMarkers(ctx, game, toX, toZ);
    this.drawMapCars(ctx, game, toX, toZ);
    this.drawMapPlayer(ctx, game, toX, toZ);
  }

  drawMapBase(ctx, W, scale, toX, toZ) {
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#10151f';
    ctx.fillRect(0, 0, W, W);
    // The sea along the south edge.
    ctx.fillStyle = '#2e9fc4';
    ctx.fillRect(0, toZ(172), W, W - toZ(172));
    // Roads, as a grid of dark strips.
    ctx.fillStyle = '#3a3f47';
    for (let c = -160; c <= 160; c += 40) {
      ctx.fillRect(toX(c) - 2.5, 0, 5, W);
      ctx.fillRect(0, toZ(c) - 2.5, W, 5);
    }
    // Blocks sit between the roads, so their centres are offset 20
    // from the road lines.
    ctx.fillStyle = '#b8b2a4';
    for (let bx = -140; bx <= 140; bx += 40) {
      for (let bz = -140; bz <= 140; bz += 40) {
        ctx.fillRect(toX(bx - 15), toZ(bz - 15), 30 * scale, 30 * scale);
      }
    }
  }

  drawMapMarkers(ctx, game, toX, toZ) {
    const dot = (x, z, color, r = 3) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(toX(x), toZ(z), r, 0, Math.PI * 2);
      ctx.fill();
    };
    if (this.marker) {
      const pulse = 4 + Math.sin(Date.now() * 0.006) * 2;
      dot(this.marker.x, this.marker.z, '#ffd23b', pulse);
      ctx.fillStyle = '#ffd23b';
      ctx.font = 'bold 10px Arial';
      ctx.fillText(this.markerLabel, Math.min(toX(this.marker.x) + 6, 200 - 72), toZ(this.marker.z) - 4);
    }
    const spray = game.city.markers.spray;
    dot(spray.x, spray.z, '#37b268', 3);
    game.cashPickups.forEach((pk) => {
      if (pk.taken) return;
      dot(pk.x, pk.z, '#37d67a', 2);
    });
  }

  drawMapCars(ctx, game, toX, toZ) {
    const dot = (x, z, color, r = 3) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(toX(x), toZ(z), r, 0, Math.PI * 2);
      ctx.fill();
    };
    game.traffic.cars.forEach((car) => dot(car.pos.x, car.pos.z, '#9aa3ad', 2));
    game.police.policeCars.forEach((car) => {
      dot(car.pos.x, car.pos.z, Math.floor(Date.now() / 300) % 2 === 0 ? '#ff2a2a' : '#2a6bff', 3.5);
    });
  }

  drawMapPlayer(ctx, game, toX, toZ) {
    // Player arrow, rotated to face the camera direction.
    const p = game.player.pos;
    ctx.save();
    ctx.translate(toX(p.x), toZ(p.z));
    ctx.rotate(-game.cameraYaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
