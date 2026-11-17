// Solmar Heat — hud.js
// Everything on screen that is not the 3D world: money, health, wanted
// stars, mission objective, speed, radio, collectibles, the live minimap
// (a 2D canvas drawn every frame), toasts, hints, and the menu screens
// (title, pause, busted, wasted, win). All DOM, no WebGL.

import { CONFIG, LANDMARKS, STORY } from './config.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = null;
    this.moneyEl = null;
    this.healthEl = null;
    this.healthFill = null;
    this.starsEl = null;
    this.objectiveEl = null;
    this.missionEl = null;
    this.speedEl = null;
    this.radioEl = null;
    this.shellsEl = null;
    this.clockEl = null;
    this.timerEl = null;
    this.toastEl = null;
    this.hintEl = null;
    this.menuEl = null;
    this.minimap = null;
    this.minimapCtx = null;
    this._toastTimer = null;
    this._hintTimer = null;
    this._lastObjective = '';
  }

  build() {
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
      <div id="topbar">
        <div id="money">$0</div>
        <div id="health"><div id="healthFill"></div></div>
        <div id="stars"></div>
      </div>
      <div id="objectiveBox">
        <div id="missionTitle"></div>
        <div id="objective"></div>
        <div id="timer"></div>
      </div>
      <div id="statsBox">
        <div id="speed">0 mph</div>
        <div id="radio">Solmar FM</div>
        <div id="shells">Shells 0/10</div>
        <div id="clock">08:00</div>
      </div>
      <canvas id="minimap" width="180" height="180"></canvas>
      <div id="toast"></div>
      <div id="hint"></div>
      <div id="crosshair">+</div>
      <div id="menu"></div>
      <div id="damage"></div>
    `;
    document.body.appendChild(root);
    this.root = root;
    this.moneyEl = document.getElementById('money');
    this.healthEl = document.getElementById('health');
    this.healthFill = document.getElementById('healthFill');
    this.starsEl = document.getElementById('stars');
    this.objectiveEl = document.getElementById('objective');
    this.missionEl = document.getElementById('missionTitle');
    this.speedEl = document.getElementById('speed');
    this.radioEl = document.getElementById('radio');
    this.shellsEl = document.getElementById('shells');
    this.clockEl = document.getElementById('clock');
    this.timerEl = document.getElementById('timer');
    this.toastEl = document.getElementById('toast');
    this.hintEl = document.getElementById('hint');
    this.menuEl = document.getElementById('menu');
    this.minimap = document.getElementById('minimap');
    this.minimapCtx = this.minimap.getContext('2d');
    this._style();
  }

  _style() {
    const css = `
      #hud { position: fixed; inset: 0; pointer-events: none; font-family: 'Segoe UI', Arial, sans-serif; color: #fff; z-index: 10; }
      #topbar { position: absolute; top: 14px; right: 16px; display: flex; gap: 12px; align-items: center; }
      #money { font-size: 28px; font-weight: 800; color: #7dff9a; text-shadow: 2px 2px 0 #000; }
      #health { width: 130px; height: 16px; background: #000a; border: 2px solid #fff; border-radius: 8px; overflow: hidden; }
      #healthFill { height: 100%; width: 100%; background: linear-gradient(90deg, #e83b2e, #ff7a3c); }
      #stars { font-size: 26px; letter-spacing: 2px; text-shadow: 2px 2px 0 #000; min-width: 110px; }
      #objectiveBox { position: absolute; top: 14px; left: 16px; max-width: 380px; background: #0009; border-left: 5px solid #e8c832; padding: 10px 14px; border-radius: 6px; }
      #missionTitle { font-size: 18px; font-weight: 800; color: #e8c832; }
      #objective { font-size: 15px; line-height: 1.35; margin-top: 4px; }
      #timer { font-size: 20px; font-weight: 800; color: #ff9a3c; margin-top: 4px; }
      #statsBox { position: absolute; bottom: 16px; left: 16px; background: #0009; padding: 8px 12px; border-radius: 6px; font-size: 15px; line-height: 1.5; }
      #minimap { position: absolute; bottom: 16px; right: 16px; border: 3px solid #fff; border-radius: 50%; background: #0d1b26; box-shadow: 0 0 0 3px #0008; }
      #toast { position: absolute; top: 110px; left: 50%; transform: translateX(-50%); background: #e8c832; color: #111; font-weight: 800; font-size: 18px; padding: 10px 22px; border-radius: 8px; opacity: 0; transition: opacity .3s; text-align: center; max-width: 70vw; }
      #hint { position: absolute; bottom: 210px; left: 50%; transform: translateX(-50%); background: #000b; font-size: 16px; padding: 8px 16px; border-radius: 6px; opacity: 0; transition: opacity .3s; }
      #crosshair { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 26px; color: #fff; text-shadow: 1px 1px 0 #000; display: none; }
      #menu { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at center, #0006 0%, #000c 100%); pointer-events: auto; }
      #menu .panel { background: #101820ee; border: 2px solid #e8c832; border-radius: 14px; padding: 22px 30px; max-width: 560px; max-height: 94vh; overflow-y: auto; text-align: center; box-shadow: 0 20px 60px #000; }
      #menu h1 { margin: 0 0 4px; font-size: 40px; letter-spacing: 2px; color: #ff7a3c; text-shadow: 3px 3px 0 #7a1e00; }
      #menu h2 { margin: 0 0 10px; font-size: 17px; color: #e8c832; font-weight: 600; }
      #menu p { font-size: 14px; line-height: 1.45; color: #dfe8ee; margin: 8px 0; }
      #menu .keys { text-align: left; font-size: 13px; line-height: 1.6; background: #0006; padding: 8px 14px; border-radius: 8px; margin: 10px 0; }
      #menu button { pointer-events: auto; cursor: pointer; background: #e8c832; color: #111; border: none; font-size: 17px; font-weight: 800; padding: 11px 24px; margin: 5px; border-radius: 9px; }
      #menu button:hover { background: #ffd94a; }
      #menu button.secondary { background: #2e4a5e; color: #fff; }
      #menu .debt { font-size: 17px; color: #ff9a8a; font-weight: 700; }
      #damage { position: absolute; inset: 0; box-shadow: inset 0 0 90px 30px rgba(220, 30, 20, 0.55); opacity: 0; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // --- Live readouts ----------------------------------------------------------

  update() {
    const g = this.game;
    this.moneyEl.textContent = `$${Math.floor(g.money)}`;
    this.healthFill.style.width = `${Math.max(0, g.combat.health)}%`;
    const wanted = g.police.wanted;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < wanted ? '★' : '☆';
    this.starsEl.textContent = stars;
    this.starsEl.style.color = wanted >= 3 ? '#ff5a4a' : '#ffd94a';
    if (g.missions.current) {
      this.missionEl.textContent = `${g.missions.current.title}  ·  $${g.missions.current.reward}`;
      this.objectiveEl.textContent = g.missions.objective;
    } else {
      this.missionEl.textContent = 'Solmar Legend';
      this.objectiveEl.textContent = g.missions.objective;
    }
    this.timerEl.textContent =
      g.missions.index === 1 && g.missions.active ? `⏱ ${Math.max(0, Math.ceil(g.missions.timer))}s` : '';
    const speed = g.player.car ? Math.abs(g.player.car.speed) : 0;
    this.speedEl.textContent = g.player.car ? `${Math.round(speed * 2.2)} mph` : 'On foot';
    this.radioEl.textContent = `♪ ${g.audio.stationName()}`;
    this.shellsEl.textContent = `Shells ${g.shellsCollected}/10  ·  Taxi ${g.taxiFares}`;
    // Clock: dayTime 0 = midnight, 0.5 = noon, 0.75 = sunset.
    const hours = Math.floor(g.dayTime * 24);
    const mins = Math.floor(((g.dayTime * 24) % 1) * 60);
    this.clockEl.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}${g.isNight ? ' 🌙' : ' ☀️'}`;
    document.getElementById('crosshair').style.display =
      g.state === 'playing' && !g.player.car && g.combat.hasPistol ? 'block' : 'none';
    document.getElementById('damage').style.opacity = g.combat.flashTimer > 0 ? '1' : '0';
    this._drawMinimap();
  }

  _drawMinimap() {
    const ctx = this.minimapCtx;
    const S = 180;
    const C = S / 2;
    const scale = S / 420;
    const toMap = (x, z) => [C + x * scale, C + z * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(C, C, C - 2, 0, Math.PI * 2);
    ctx.clip();
    // Sea and sand at the bottom.
    ctx.fillStyle = '#1d5f86';
    ctx.fillRect(0, C + 184 * scale, S, S);
    ctx.fillStyle = '#e0c98f';
    ctx.fillRect(0, C + 176 * scale, S, 8);
    // City blocks.
    ctx.fillStyle = '#3a4a3a';
    for (let bx = -140; bx <= 140; bx += 40) {
      for (let bz = -140; bz <= 140; bz += 40) {
        const [x, y] = toMap(bx - 14, bz - 14);
        ctx.fillRect(x, y, 28 * scale, 28 * scale);
      }
    }
    // Roads.
    ctx.strokeStyle = '#8a929c';
    ctx.lineWidth = 5;
    for (let c = -160; c <= 160; c += 40) {
      const [x1] = toMap(c, -160);
      const [, y1] = toMap(-160, c);
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y1);
      ctx.lineTo(S, y1);
      ctx.stroke();
    }
    // Landmark dots.
    for (const key of Object.keys(LANDMARKS)) {
      const b = LANDMARKS[key].building;
      const [x, y] = toMap(b.x, b.z);
      ctx.fillStyle = '#e8c832';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission marker: a pulsing yellow diamond.
    const marker = this.game.missions.marker || this.game.missions.taxiMarker;
    if (marker) {
      const [x, y] = toMap(marker.x, marker.z);
      const pulse = 5 + Math.sin(performance.now() / 250) * 2;
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.moveTo(x, y - pulse);
      ctx.lineTo(x + pulse, y);
      ctx.lineTo(x, y + pulse);
      ctx.lineTo(x - pulse, y);
      ctx.closePath();
      ctx.fill();
    }
    // Police: red dots.
    ctx.fillStyle = '#ff4a3c';
    for (const car of this.game.police.policeCars) {
      const [x, y] = toMap(car.pos.x, car.pos.z);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player: a white arrow that rotates with the heading.
    const g = this.game;
    const [px, py] = toMap(g.player.pos.x, g.player.pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(g.player.heading), Math.cos(g.player.heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // North marker.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('N', C - 4, 12);
  }

  // --- Messages ---------------------------------------------------------------

  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toastEl.style.opacity = '0';
    }, 3200);
  }

  hint(text) {
    this.hintEl.textContent = text;
    this.hintEl.style.opacity = '1';
    if (this._hintTimer) clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => {
      this.hintEl.style.opacity = '0';
    }, 2600);
  }

  // --- Menus ------------------------------------------------------------------

  showMenu(kind, data) {
    const menu = this.menuEl;
    if (kind === 'title') {
      const hasSave = this.game.save.hasSave();
      menu.innerHTML = `<div class="panel">
        <h1>SOLMAR HEAT</h1>
        <h2>${STORY.tagline}</h2>
        <p>${STORY.intro}</p>
        <p class="debt">Debt to the ${STORY.creditor}: $${STORY.debt} — pay it back by sunset.</p>
        <div class="keys">
          <b>W A S D</b> — walk / drive &nbsp;·&nbsp; <b>Shift</b> — run<br>
          <b>E</b> — enter / steal car, punch &nbsp;·&nbsp; <b>F / Click</b> — shoot (after Mission 2)<br>
          <b>Space</b> — handbrake &nbsp;·&nbsp; <b>R</b> — change radio &nbsp;·&nbsp; <b>H</b> — horn<br>
          <b>T</b> — taxi job (in the yellow cab) &nbsp;·&nbsp; <b>P / Esc</b> — pause
        </div>
        <button id="btnStart">▶ Start Story</button>
        <button id="btnFree" class="secondary">Free Roam</button>
        ${hasSave ? '<button id="btnContinue" class="secondary">Continue</button>' : ''}
      </div>`;
      menu.style.display = 'flex';
      document.getElementById('btnStart').onclick = () => this.game.startStory();
      document.getElementById('btnFree').onclick = () => this.game.startFreeRoam();
      const cont = document.getElementById('btnContinue');
      if (cont) cont.onclick = () => this.game.continueSave();
    } else if (kind === 'pause') {
      menu.innerHTML = `<div class="panel">
        <h1>PAUSED</h1>
        <p>Solmar Bay waits for no one — except right now.</p>
        <p>Money: $${Math.floor(this.game.money)} &nbsp;·&nbsp; Missions done: ${this.game.missions.done.filter(Boolean).length}/3</p>
        <button id="btnResume">Resume</button>
        <button id="btnRestart" class="secondary">Restart Story</button>
        <button id="btnQuit" class="secondary">Main Menu</button>
      </div>`;
      menu.style.display = 'flex';
      document.getElementById('btnResume').onclick = () => this.game.resumeGame();
      document.getElementById('btnRestart').onclick = () => this.game.startStory();
      document.getElementById('btnQuit').onclick = () => this.game.toMenu();
    } else if (kind === 'win') {
      menu.innerHTML = `<div class="panel">
        <h1>SOLMAR LEGEND</h1>
        <h2>All three missions complete — the ${STORY.creditor} is paid.</h2>
        <p>Final cash: <b>$${Math.floor(this.game.money)}</b> &nbsp;·&nbsp; Score: ${Math.floor(this.game.score)}</p>
        <p>Dash walks away clean as the sun goes down over Solmar Bay. The city is yours now — free roam is open.</p>
        <button id="btnRoam">Keep Playing — Free Roam</button>
        <button id="btnAgain" class="secondary">Play Again</button>
      </div>`;
      menu.style.display = 'flex';
      document.getElementById('btnRoam').onclick = () => this.game.resumeGame();
      document.getElementById('btnAgain').onclick = () => this.game.startStory();
    } else if (kind === 'busted') {
      menu.innerHTML = `<div class="panel">
        <h1>BUSTED</h1>
        <p>The Solmar Bay police finally caught up with Dash. Fine: $${CONFIG.BUSTED_FINE} — and the heat is off, for now.</p>
        <button id="btnResume">Get Out — Resume</button>
      </div>`;
      menu.style.display = 'flex';
      document.getElementById('btnResume').onclick = () => this.game.resumeGame();
    } else if (kind === 'wasted') {
      menu.innerHTML = `<div class="panel">
        <h1>WASTED</h1>
        <p>Dash wakes up at the Safehouse, patched up and poorer. The city is still out there.</p>
        <button id="btnResume">Get Up — Resume</button>
      </div>`;
      menu.style.display = 'flex';
      document.getElementById('btnResume').onclick = () => this.game.resumeGame();
    }
  }

  hideMenu() {
    this.menuEl.style.display = 'none';
    this.menuEl.innerHTML = '';
  }
}
