// Solmar Heat — HUD, minimap and menus (Round 17).
// All DOM lives in index.html; this module only reads/writes it. The
// minimap is a 2D canvas: roads, blocks, sea, landmarks, traffic, police,
// the player arrow and the pulsing objective marker.
import { ROADS, MISSIONS, LANDMARKS } from './config.js';

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = (id) => document.getElementById(id);
    this._toastTimer = null;
    this._lastObjective = '';
  }

  setObjective(text) {
    if (text === this._lastObjective) return;
    this._lastObjective = text;
    const el = this.el('objective');
    if (el) el.textContent = text;
  }

  toast(msg) {
    const el = this.el('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  showMenu() {
    this.el('menu').style.display = 'flex';
    this.el('hud').style.display = 'none';
    this.el('end').style.display = 'none';
  }

  showPlaying() {
    this.el('menu').style.display = 'none';
    this.el('hud').style.display = 'block';
    this.el('end').style.display = 'none';
  }

  showEnd(win, money) {
    this.el('hud').style.display = 'none';
    const end = this.el('end');
    end.style.display = 'flex';
    this.el('end-title').textContent = win ? 'SOLMAR LEGEND' : 'BUSTED';
    this.el('end-stats').textContent = win
      ? `All 6 missions done — Dana Reyes is free of the Marlin Club. Final cash: $${Math.floor(money)}.`
      : 'The Marlin Club always collects.';
  }

  showDown(text) {
    const el = this.el('down');
    if (!el) return;
    el.style.display = 'block';
    this.el('down-text').textContent = text;
  }

  hideDown() {
    const el = this.el('down');
    if (el) el.style.display = 'none';
  }

  update() {
    const g = this.game;
    const money = this.el('money');
    if (money) money.textContent = `$${Math.floor(g.money)}`;
    const hp = Math.max(0, Math.ceil(g.health));
    const fill = this.el('health-fill');
    if (fill) {
      fill.style.width = `${hp}%`;
      fill.style.background = hp > 50 ? '#37d67a' : hp > 25 ? '#e0a52e' : '#d83a3a';
    }
    const hpText = this.el('health-text');
    if (hpText) hpText.textContent = `${hp}`;
    const wanted = this.el('wanted');
    if (wanted) {
      wanted.textContent = '★'.repeat(g.police.wanted) + '☆'.repeat(5 - g.police.wanted);
      wanted.style.color = g.police.wanted >= 4 ? '#ff4d4d' : '#ffd34d';
    }
    const dots = this.el('mission-dots');
    if (dots) {
      dots.textContent = MISSIONS.map((m) => (g.missions.doneIds.includes(m.id) ? `M${m.id}✓` : `M${m.id}`)).join('  ');
    }
    this.setObjective(g.missions.objective());
    // Doubloons + taxi streak.
    const dbl = this.el('doubloon-count');
    if (dbl) dbl.textContent = `◉ ${12 - g.missions._doubloonsLeft.size}/12`;
    const fare = this.el('fare-streak');
    if (fare) fare.textContent = `🚕 streak ${g.missions.taxi.streak || 0}`;
    // Race box.
    const raceBox = this.el('race-box');
    if (raceBox) {
      if (g.missions.race.active) {
        raceBox.style.display = 'block';
        const r = g.missions.race;
        this.el('race-timer').textContent = `${r.time.toFixed(1)}s`;
        this.el('race-info').textContent = `Checkpoint ${Math.min(r.checkpoint + 1, 4)}/4`;
      } else {
        raceBox.style.display = 'none';
      }
    }
    // Pistol indicator.
    const gun = this.el('gun-indicator');
    if (gun) gun.textContent = g.combat.hasPistol ? '🔫 Pistol ready (F)' : '👊 Fists (F)';
    this._drawMinimap();
  }

  _drawMinimap() {
    const canvas = this.el('minimap');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const S = canvas.width;
    const toMap = (v) => ((v + 190) / 380) * S;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#10141c';
    ctx.fillRect(0, 0, S, S);
    // Sea (east edge).
    ctx.fillStyle = '#1a4a6e';
    ctx.fillRect(toMap(162), 0, S - toMap(162), S);
    // Roads.
    ctx.strokeStyle = '#3a3f47';
    ctx.lineWidth = 2;
    for (const r of ROADS) {
      ctx.beginPath();
      ctx.moveTo(toMap(r), 0);
      ctx.lineTo(toMap(r), S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, toMap(r));
      ctx.lineTo(S, toMap(r));
      ctx.stroke();
    }
    // Landmarks.
    for (const [key, l] of Object.entries(LANDMARKS)) {
      ctx.fillStyle = key === 'bank' || key === 'airport' ? '#19e3ff' : '#ffd34d';
      ctx.beginPath();
      ctx.arc(toMap(l.marker.x), toMap(l.marker.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Traffic (grey), police (red).
    const g = this.game;
    ctx.fillStyle = '#9aa0aa';
    for (const c of g.traffic.cars) {
      ctx.fillRect(toMap(c.x) - 1.5, toMap(c.z) - 1.5, 3, 3);
    }
    ctx.fillStyle = '#ff4d4d';
    for (const pc of g.police.policeCars) {
      ctx.beginPath();
      ctx.arc(toMap(pc.x), toMap(pc.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Objective marker (pulsing gold).
    const target = g.missions._objectiveTarget ? g.missions._objectiveTarget() : null;
    if (target) {
      const pulse = 3 + Math.sin(Date.now() * 0.006) * 1.5;
      ctx.fillStyle = '#ffc233';
      ctx.beginPath();
      ctx.arc(toMap(target.x), toMap(target.z), pulse + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const p = g.playerPos();
    const h = g.playerHeading();
    ctx.save();
    ctx.translate(toMap(p.x), toMap(p.z));
    ctx.rotate(-h + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
