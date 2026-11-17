// Solmar Heat — the HUD, the minimap and every menu.
// The HUD is plain DOM over the WebGL canvas: money, health, wanted
// stars, the mission objective, speed, and a live 2D minimap. The menus
// are the start screen, pause, win, busted and wasted.

import { LANDMARKS } from './config.js';

function el(tag, id, cls, parent) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

export class Hud {
  constructor(game) {
    this.game = game;
    this.toastTimer = null;
    this.minimapTimer = 0;
    this.objectiveTitle = '';
    this.objectiveText = '';
    this._build();
  }

  _build() {
    const root = el('div', 'hud', '', document.body);
    const top = el('div', '', 'hud-top', root);
    const moneyBox = el('div', '', 'hud-money', top);
    el('span', 'moneyLabel', '', moneyBox).textContent = '$';
    el('span', 'moneyValue', '', moneyBox).textContent = '25';
    const healthBox = el('div', '', 'hud-health', top);
    el('span', '', '', healthBox).textContent = '♥';
    const bar = el('div', '', 'health-bar', healthBox);
    el('div', 'healthFill', '', bar);
    const wanted = el('div', 'wanted', 'hud-wanted', top);
    wanted.textContent = '☆☆☆☆☆';
    const obj = el('div', 'objective', 'hud-objective', root);
    el('div', 'objectiveTitle', '', obj);
    el('div', 'objectiveText', '', obj);
    const speed = el('div', 'speed', 'hud-speed', root);
    speed.textContent = '';
    const mapWrap = el('div', '', 'hud-map', root);
    this.mapCanvas = el('canvas', 'minimap', '', mapWrap);
    this.mapCanvas.width = 200;
    this.mapCanvas.height = 200;
    const hint = el('div', '', 'hud-hint', root);
    hint.textContent = 'WASD drive / walk · E enter car · F punch / shoot · M mute · Esc pause';
    this.toastEl = el('div', 'toast', 'hud-toast', root);

    // Start screen.
    const menu = el('div', 'menu', 'screen', document.body);
    el('div', '', 'game-title', menu).textContent = 'SOLMAR HEAT';
    el('div', '', 'game-sub', menu).textContent = 'A 3D open-world crime story in Solmar Bay';
    el('div', '', 'game-story', menu).textContent =
      'Dana "Dash" Reyes owes the Marlin Club $400. Steal a car, run the courier, lose the heat — and become a Solmar Legend.';
    const btnStart = el('button', 'btnStart', 'big-btn', menu);
    btnStart.textContent = '▶  START STORY';
    const btnContinue = el('button', 'btnContinue', 'big-btn ghost', menu);
    btnContinue.textContent = 'CONTINUE';
    btnContinue.style.display = 'none';
    this.btnContinue = btnContinue;
    el('div', '', 'game-controls', menu).textContent =
      'WASD move / drive · Shift run · E get in / out of a car · F punch, pistol after Mission 2 · Space handbrake · Esc pause';
    el('div', '', 'game-credit', menu).textContent =
      'Built by an AI agent for make.fun\'s "Make GTA 6" bounty, $1,666 in USDC';

    // Pause screen.
    const pause = el('div', 'pauseScreen', 'screen hidden', document.body);
    el('div', '', 'screen-title', pause).textContent = 'PAUSED';
    const btnResume = el('button', 'btnResume', 'big-btn', pause);
    btnResume.textContent = 'RESUME';
    const btnRestartP = el('button', 'btnRestartPause', 'big-btn ghost', pause);
    btnRestartP.textContent = 'RESTART STORY';

    // Win screen.
    const win = el('div', 'winScreen', 'screen hidden', document.body);
    el('div', '', 'screen-title gold', win).textContent = '★ SOLMAR LEGEND ★';
    el('div', 'winText', '', win).textContent = '';
    const btnRoam = el('button', 'btnFreeRoam', 'big-btn', win);
    btnRoam.textContent = 'KEEP PLAYING — FREE ROAM';
    const btnRestartW = el('button', 'btnRestartWin', 'big-btn ghost', win);
    btnRestartW.textContent = 'PLAY AGAIN';

    // Busted screen.
    const busted = el('div', 'bustedScreen', 'screen hidden', document.body);
    el('div', '', 'screen-title blue', busted).textContent = 'BUSTED';
    el('div', '', 'screen-sub', busted).textContent = 'The Solmar Bay police caught up with you.';
    const btnRetryB = el('button', 'btnRetryBusted', 'big-btn', busted);
    btnRetryB.textContent = 'GET BACK OUT THERE';

    // Wasted screen.
    const wasted = el('div', 'wastedScreen', 'screen hidden', document.body);
    el('div', '', 'screen-title red', wasted).textContent = 'WASTED';
    el('div', '', 'screen-sub', wasted).textContent = 'Solmar Bay is not done with you yet.';
    const btnRetryW = el('button', 'btnRetryWasted', 'big-btn', wasted);
    btnRetryW.textContent = 'GET BACK OUT THERE';

    this.screens = { menu, pause, win, busted, wasted };
    this.winText = document.getElementById('winText');

    btnStart.addEventListener('click', () => this.game.startStory());
    btnContinue.addEventListener('click', () => this.game.continueStory());
    btnResume.addEventListener('click', () => this.game.resumeFromPause());
    btnRestartP.addEventListener('click', () => this.game.startStory());
    btnRestartW.addEventListener('click', () => this.game.startStory());
    btnRoam.addEventListener('click', () => this.game.freeRoam());
    btnRetryB.addEventListener('click', () => this.game.resumeGame());
    btnRetryW.addEventListener('click', () => this.game.resumeGame());
  }

  showScreen(name) {
    for (const [key, node] of Object.entries(this.screens)) {
      node.classList.toggle('hidden', key !== name);
    }
    document.getElementById('hud').style.display = name === null ? 'block' : 'none';
    if (name === 'menu') {
      this.btnContinue.style.display = this.game.save.hasSave() ? 'block' : 'none';
    }
  }

  hideScreens() {
    this.showScreen(null);
  }

  refresh() {
    const g = this.game;
    document.getElementById('moneyValue').textContent = String(Math.floor(g.money));
    const fill = document.getElementById('healthFill');
    fill.style.width = `${Math.max(0, Math.min(100, g.combat.health))}%`;
    fill.style.background = g.combat.health > 50 ? '#37c978' : g.combat.health > 25 ? '#f2a541' : '#e74c3c';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < g.police.wanted ? '★' : '☆';
    const wanted = document.getElementById('wanted');
    wanted.textContent = stars;
    wanted.style.color = g.police.wanted > 0 ? '#ffd23f' : '#cfd6dd';
    const speed = document.getElementById('speed');
    speed.textContent = g.player.car ? `${Math.round(Math.abs(g.player.car.speed) * 3.6)} km/h` : '';
  }

  setObjective(title, text) {
    this.objectiveTitle = title;
    this.objectiveText = text;
    document.getElementById('objectiveTitle').textContent = title;
    document.getElementById('objectiveText').textContent = text;
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 3200);
  }

  showWin(money) {
    this.winText.textContent = `All three missions done. You took home $${Math.floor(money)} — the Marlin Club is paid, and the bay knows your name.`;
    this.showScreen('win');
  }

  update(dt) {
    this.minimapTimer += dt;
    if (this.minimapTimer < 0.1) return;
    this.minimapTimer = 0;
    this._drawMinimap();
  }

  _drawMinimap() {
    const g = this.game;
    const ctx = this.mapCanvas.getContext('2d');
    if (!ctx) return;
    const S = 0.45;
    const OX = 180;
    const toX = (x) => (x + OX) * S;
    const toZ = (z) => (z + OX) * S;
    ctx.fillStyle = '#141a20';
    ctx.fillRect(0, 0, 200, 200);
    // Sea and sand at the bottom.
    ctx.fillStyle = '#1e6f9e';
    ctx.fillRect(0, toZ(222), 200, 200 - toZ(222));
    ctx.fillStyle = '#e2cf9e';
    ctx.fillRect(0, toZ(160), 200, toZ(222) - toZ(160));
    // Roads.
    ctx.strokeStyle = '#4a4f55';
    ctx.lineWidth = 5;
    for (let v = -160; v <= 160; v += 40) {
      ctx.beginPath();
      ctx.moveTo(toX(-170), toZ(v));
      ctx.lineTo(toX(170), toZ(v));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toX(v), toZ(-170));
      ctx.lineTo(toX(v), toZ(170));
      ctx.stroke();
    }
    // Landmarks.
    for (const lm of LANDMARKS) {
      ctx.fillStyle = `#${lm.color.toString(16).padStart(6, '0')}`;
      ctx.beginPath();
      ctx.arc(toX(lm.at[0]), toZ(lm.at[1]), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission marker.
    if (g.missions.marker && g.missions.marker.visible) {
      const mx = toX(g.missions.marker.position.x);
      const mz = toZ(g.missions.marker.position.z);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, mz, 6 + Math.sin(g.elapsed * 4) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Traffic.
    ctx.fillStyle = '#9aa0a6';
    for (const car of g.vehicles.traffic.cars) {
      ctx.fillRect(toX(car.pos.x) - 1.5, toZ(car.pos.z) - 1.5, 3, 3);
    }
    // Police.
    ctx.fillStyle = '#ff2d2d';
    for (const car of g.police.policeCars) {
      ctx.beginPath();
      ctx.arc(toX(car.pos.x), toZ(car.pos.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const px = toX(g.player.pos.x);
    const pz = toZ(g.player.pos.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.PI - g.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North marker.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('N', 4, 12);
  }
}
