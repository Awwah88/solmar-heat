// Solmar Heat — HUD, minimap, and screens.
// All on-screen UI lives here: money/health/wanted/mission/objective,
// the timer, the flashing message line, the minimap, and the four
// screens (menu, playing, busted, wasted, win).

import { LANDMARKS, clamp } from './config.js';

const MAP_SIZE = 180; // px
const MAP_SCALE = MAP_SIZE / 400; // world units -> px (world spans ~-200..200)

export class HUD {
  constructor() {
    this.moneyEl = document.getElementById('money');
    this.healthFill = document.getElementById('health-fill');
    this.wantedEl = document.getElementById('wanted');
    this.missionEl = document.getElementById('mission');
    this.objectiveEl = document.getElementById('objective');
    this.timerEl = document.getElementById('timer');
    this.flashEl = document.getElementById('flash');
    this.minimap = document.getElementById('minimap');
    this.mapCtx = this.minimap ? this.minimap.getContext('2d') : null;
    this.menuEl = document.getElementById('menu');
    this.winEl = document.getElementById('win-screen');
    this.bustedEl = document.getElementById('busted-screen');
    this.wastedEl = document.getElementById('wasted-screen');
    this.winMoneyEl = document.getElementById('win-money');
    this._flashAt = 0;
    this._flashTimer = 0;
  }

  setMoney(n) {
    if (this.moneyEl) this.moneyEl.textContent = `$${Math.round(n)}`;
  }

  setHealth(n) {
    if (!this.healthFill) return;
    const h = clamp(Math.round(n), 0, 100);
    this.healthFill.style.width = `${h}%`;
    this.healthFill.style.background = h > 50 ? '#4caf50' : h > 25 ? '#ff9800' : '#f44336';
  }

  setWanted(n) {
    if (!this.wantedEl) return;
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < n ? '★' : '☆';
    this.wantedEl.textContent = stars;
    this.wantedEl.style.color = n > 0 ? '#ff5722' : '#888';
  }

  setMission(title) {
    if (this.missionEl) this.missionEl.textContent = title;
  }

  setObjective(text) {
    if (this.objectiveEl) this.objectiveEl.textContent = text;
  }

  setTimer(seconds) {
    if (!this.timerEl) return;
    if (seconds == null) {
      this.timerEl.textContent = '';
      return;
    }
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    this.timerEl.textContent = `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  flash(text) {
    if (!this.flashEl) return;
    this.flashEl.textContent = text;
    this.flashEl.style.opacity = '1';
    this._flashTimer = 2.5;
  }

  _tickFlash(dt) {
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0 && this.flashEl) this.flashEl.style.opacity = '0';
    }
  }

  _toMap(x, z) {
    return [(x + 200) * MAP_SCALE, (z + 200) * MAP_SCALE];
  }

  updateMinimap(s) {
    const ctx = this.mapCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = 'rgba(8, 14, 24, 0.85)';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Sea on the south edge.
    ctx.fillStyle = 'rgba(30, 90, 140, 0.7)';
    ctx.fillRect(0, (185 + 200) * MAP_SCALE, MAP_SIZE, MAP_SIZE);
    // Roads.
    ctx.strokeStyle = 'rgba(120, 130, 145, 0.8)';
    ctx.lineWidth = 2;
    for (const v of [-162, -126, -90, -54, -18, 18, 54, 90, 126, 162]) {
      const [ax] = this._toMap(v, 0);
      const [, az] = this._toMap(0, v);
      ctx.beginPath(); ctx.moveTo(0, az); ctx.lineTo(MAP_SIZE, az); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, MAP_SIZE); ctx.stroke();
    }
    // Landmarks.
    for (const lm of Object.values(LANDMARKS)) {
      const [x, y] = this._toMap(lm.x, lm.z);
      ctx.fillStyle = '#9aa5b1';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Mission marker (pulsing yellow) and taxi marker (cyan).
    if (s.marker) {
      const [x, y] = this._toMap(s.marker.x, s.marker.z);
      const r = 5 + Math.sin(s.now * 5) * 1.5;
      ctx.fillStyle = '#ffd54a';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    if (s.taxiMarker) {
      const [x, y] = this._toMap(s.taxiMarker.x, s.taxiMarker.z);
      ctx.fillStyle = '#4dd0e1';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Police cars (red), gold car (gold).
    for (const c of s.policeCars || []) {
      const [x, y] = this._toMap(c.x, c.z);
      ctx.fillStyle = '#ff5252';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    if (s.goldCar) {
      const [x, y] = this._toMap(s.goldCar.x, s.goldCar.z);
      ctx.fillStyle = '#ffd54a';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const [px, py] = this._toMap(s.playerX, s.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(s.playerHeading), Math.cos(s.playerHeading)) + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  showMenu() {
    this._show(this.menuEl);
  }

  showPlaying() {
    this._show(null);
  }

  showBusted() {
    this._show(this.bustedEl);
  }

  showWasted() {
    this._show(this.wastedEl);
  }

  showWin(money) {
    if (this.winMoneyEl) this.winMoneyEl.textContent = `$${Math.round(money)}`;
    this._show(this.winEl);
  }

  _show(el) {
    for (const scr of [this.menuEl, this.winEl, this.bustedEl, this.wastedEl]) {
      if (scr) scr.style.display = 'none';
    }
    if (el) el.style.display = 'flex';
  }

  tick(dt, mapSnapshot) {
    this._tickFlash(dt);
    if (mapSnapshot) this.updateMinimap(mapSnapshot);
  }
}
