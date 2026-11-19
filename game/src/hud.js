// DOM HUD: money, health, wanted stars, objective, speed, toasts, minimap
// and the menu / pause / busted / wasted / win screens.
import { GRID, LANDMARKS, STORY } from './config.js';

export class Hud {
  constructor(callbacks) {
    this.cb = callbacks;
    this.el = {};
    for (const id of ['menu', 'hud', 'pause', 'end', 'money', 'health-fill', 'health-num',
      'stars', 'objective', 'speed', 'pistol', 'toast', 'minimap', 'end-title', 'end-text',
      'end-btn', 'start-btn', 'continue-btn', 'resume-btn', 'quit-btn', 'mission-dots']) {
      this.el[id] = document.getElementById(id);
    }
    this.minimap = this.el.minimap.getContext('2d');
    this.toastTimer = null;
    this.el['start-btn'].addEventListener('click', () => this.cb.onStart(false));
    this.el['continue-btn'].addEventListener('click', () => this.cb.onStart(true));
    this.el['resume-btn'].addEventListener('click', () => this.cb.onResume());
    this.el['quit-btn'].addEventListener('click', () => this.cb.onQuitToMenu());
    this.el['end-btn'].addEventListener('click', () => this.cb.onEndButton());
    this.el['continue-btn'].style.display = this.cb.hasSave() ? 'inline-block' : 'none';
  }

  show(screen) {
    for (const key of ['menu', 'hud', 'pause', 'end']) {
      if (this.el[key]) this.el[key].style.display = key === screen ? 'block' : 'none';
    }
    if (screen === 'hud') this.el.hud.style.display = 'block';
  }

  setMoney(n) {
    this.el.money.textContent = '$' + Math.floor(n);
  }

  setHealth(h) {
    const pct = Math.max(0, Math.min(100, h));
    this.el['health-fill'].style.width = pct + '%';
    this.el['health-num'].textContent = Math.ceil(pct);
    this.el['health-fill'].style.background = pct > 50 ? '#4ade80' : pct > 25 ? '#facc15' : '#ef4444';
  }

  setWanted(n) {
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < n ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.style.color = n > 0 ? '#fbbf24' : '#94a3b8';
  }

  setObjective(text) {
    this.el.objective.textContent = text;
  }

  setSpeed(v, inCar) {
    this.el.speed.textContent = inCar ? Math.round(Math.abs(v) * 3.6) + ' km/h' : '';
  }

  setPistol(has) {
    this.el.pistol.style.display = has ? 'inline-block' : 'none';
  }

  setMissions(done, total) {
    let dots = '';
    for (let i = 0; i < total; i++) dots += i < done ? '●' : '○';
    this.el['mission-dots'].textContent = dots;
  }

  toast(msg, ms) {
    this.el.toast.textContent = msg;
    this.el.toast.style.opacity = '1';
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.style.opacity = '0'; }, ms || 3600);
  }

  showEnd(kind, stats) {
    const titles = {
      busted: 'BUSTED',
      wasted: 'WASTED',
      win: 'SOLMAR LEGEND',
    };
    this.el['end-title'].textContent = titles[kind] || kind.toUpperCase();
    this.el['end-title'].style.color = kind === 'win' ? '#facc15' : '#ef4444';
    this.el['end-text'].innerHTML = stats;
    this.el['end-btn'].textContent = kind === 'win' ? 'Play again' : 'Keep going';
    this.show('end');
  }

  // Top-down map: roads, blocks, sea, landmarks, player, traffic, police,
  // mission target and taxi passenger. World coords -180..180 map to the canvas.
  drawMinimap(game) {
    const ctx = this.minimap;
    const S = 190;
    const scale = S / 380;
    const toX = (x) => (x + 190) * scale;
    const toY = (z) => (z + 190) * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(10, 16, 24, 0.82)';
    ctx.fillRect(0, 0, S, S);
    // Sea on the east edge.
    ctx.fillStyle = '#2a7fa8';
    ctx.fillRect(toX(180), 0, S - toX(180), S);
    // Blocks.
    ctx.fillStyle = '#3f4a5a';
    for (const bx of GRID.blocks) {
      for (const bz of GRID.blocks) {
        ctx.fillRect(toX(bx - 16), toY(bz - 16), 32 * scale, 32 * scale);
      }
    }
    // Roads.
    ctx.strokeStyle = '#7d8590';
    ctx.lineWidth = 2;
    for (const r of GRID.roads) {
      ctx.beginPath(); ctx.moveTo(toX(r), 0); ctx.lineTo(toX(r), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toY(r)); ctx.lineTo(S, toY(r)); ctx.stroke();
    }
    // Landmarks.
    for (const lm of LANDMARKS) {
      ctx.fillStyle = '#' + lm.color.toString(16).padStart(6, '0');
      ctx.beginPath();
      ctx.arc(toX(lm.marker[0]), toY(lm.marker[1]), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission target pulse.
    const obj = game.missions.objective();
    if (obj.target) {
      const pulse = 5 + Math.sin(performance.now() / 280) * 2;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toX(obj.target.x), toY(obj.target.z), pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Taxi passenger.
    if (game.missions.taxi) {
      const t = game.missions.taxi;
      const p = t.stage === 'pickup' ? t.passenger : t.dest;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(toX(p.x), toY(p.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Traffic.
    ctx.fillStyle = '#cbd5e1';
    for (const car of game.traffic.cars) {
      ctx.fillRect(toX(car.group.position.x) - 1.5, toY(car.group.position.z) - 1.5, 3, 3);
    }
    // Police.
    ctx.fillStyle = '#60a5fa';
    for (const car of game.police.policeCars) {
      ctx.beginPath();
      ctx.arc(toX(car.group.position.x), toY(car.group.position.z), 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const px = toX(game.player.x);
    const pz = toY(game.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-game.player.heading);
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
