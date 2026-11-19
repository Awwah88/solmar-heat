// HUD, minimap and menus for Solmar Heat. All DOM lives in index.html;
// this module only reads and updates it.

import { BLOCKS, ROADS } from './config.js';

export class HUD {
  constructor(doc) {
    this.doc = doc;
    this.el = {};
    for (const id of ['hud', 'money', 'score', 'health-fill', 'health-text', 'stars', 'objective', 'speed', 'timer', 'toast', 'hint', 'menu', 'start-btn', 'continue-btn', 'pause-screen', 'resume-btn', 'pause-restart-btn', 'end-screen', 'end-title', 'end-text', 'end-stats', 'end-btn', 'down-overlay', 'down-text']) {
      this.el[id] = doc.getElementById(id);
    }
    this.minimap = doc.getElementById('minimap');
    this.mm = this.minimap ? this.minimap.getContext('2d') : null;
    this._toastTimer = null;
    this.onStart = null;
    this.onContinue = null;
    this.onResume = null;
    this.onRestart = null;
    this.onEnd = null;
    if (this.el['start-btn']) this.el['start-btn'].addEventListener('click', () => this.onStart && this.onStart());
    if (this.el['continue-btn']) this.el['continue-btn'].addEventListener('click', () => this.onContinue && this.onContinue());
    if (this.el['resume-btn']) this.el['resume-btn'].addEventListener('click', () => this.onResume && this.onResume());
    if (this.el['pause-restart-btn']) this.el['pause-restart-btn'].addEventListener('click', () => this.onRestart && this.onRestart());
    if (this.el['end-btn']) this.el['end-btn'].addEventListener('click', () => this.onEnd && this.onEnd());
  }

  _show(id, on) {
    const e = this.el[id];
    if (e) e.style.display = on ? '' : 'none';
  }

  showDown(kind, fine) {
    if (this.el['down-text']) this.el['down-text'].textContent = `${kind} — $${fine} fine`;
    if (this.el['down-overlay']) this.el['down-overlay'].style.display = '';
  }

  hideDown() {
    if (this.el['down-overlay']) this.el['down-overlay'].style.display = 'none';
  }

  showMenu(hasSave) {
    this._show('hud', false);
    this._show('menu', true);
    this._show('pause-screen', false);
    this._show('end-screen', false);
    if (this.el['continue-btn']) this.el['continue-btn'].style.display = hasSave ? '' : 'none';
  }

  showPlaying() {
    this._show('hud', true);
    this._show('menu', false);
    this._show('pause-screen', false);
    this._show('end-screen', false);
  }

  showPaused() {
    this._show('pause-screen', true);
  }

  showEnd(kind, stats) {
    this._show('hud', false);
    this._show('end-screen', true);
    const titles = { win: 'SOLMAR LEGEND', busted: 'BUSTED', wasted: 'WASTED' };
    const texts = {
      win: 'Debt paid in full. Dana "Dash" Reyes is free.',
      busted: 'The Solmar PD caught up with you. The Marlin Club is not pleased.',
      wasted: 'You blacked out on the streets of Solmar Bay.',
    };
    if (this.el['end-title']) this.el['end-title'].textContent = titles[kind] || kind.toUpperCase();
    if (this.el['end-text']) this.el['end-text'].textContent = texts[kind] || '';
    if (this.el['end-stats']) {
      this.el['end-stats'].textContent = `$${stats.money} in the pocket · ${stats.missions}/4 missions · ${stats.time}`;
    }
  }

  toast(msg) {
    const t = this.el.toast;
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 3600);
  }

  update(g) {
    if (this.el.money) this.el.money.textContent = `$${Math.floor(g.money)}`;
    if (this.el.score) this.el.score.textContent = `SCORE ${g.score}`;
    const hp = Math.max(0, Math.ceil(g.health));
    if (this.el['health-fill']) this.el['health-fill'].style.width = `${hp}%`;
    if (this.el['health-text']) this.el['health-text'].textContent = `${hp}`;
    if (this.el.stars) {
      this.el.stars.textContent = '★'.repeat(g.police.wanted) + '☆'.repeat(5 - g.police.wanted);
      this.el.stars.style.color = g.police.wanted > 0 ? '#ffd23e' : '#888';
    }
    if (this.el.objective) {
      const m = g.missions.current;
      const obj = g.missions.objective();
      this.el.objective.textContent = m ? `M${m.id} ${m.title} ($${m.reward}) — ${obj}` : obj;
    }
    if (this.el.speed) {
      this.el.speed.textContent = g.player.car ? `${Math.round(Math.abs(g.player.car.speed) * 3.6)} km/h` : 'ON FOOT';
    }
    if (this.el.timer) {
      const m = g.missions.current;
      this.el.timer.style.display = m && m.id === 2 ? '' : 'none';
      if (m && m.id === 2) {
        const left = Math.max(0, Math.ceil(g.missions.timer));
        this.el.timer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      }
    }
    this._drawMinimap(g);
  }

  _drawMinimap(g) {
    if (!this.mm) return;
    const ctx = this.mm;
    const S = 180;
    const toMap = (v) => ((v + 180) / 360) * S;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(12, 18, 28, 0.85)';
    ctx.fillRect(0, 0, S, S);
    // Blocks.
    ctx.fillStyle = '#3a4356';
    for (const bx of BLOCKS) {
      for (const bz of BLOCKS) {
        ctx.fillRect(toMap(bx - 13), toMap(bz - 13), 26 / 360 * S, 26 / 360 * S);
      }
    }
    // Roads.
    ctx.strokeStyle = '#6a7284';
    ctx.lineWidth = 5;
    for (const r of ROADS) {
      ctx.beginPath();
      ctx.moveTo(0, toMap(r));
      ctx.lineTo(S, toMap(r));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(toMap(r), 0);
      ctx.lineTo(toMap(r), S);
      ctx.stroke();
    }
    // Sea.
    ctx.fillStyle = '#1e6f9e';
    ctx.fillRect(toMap(180), 0, S - toMap(180), S);
    ctx.fillRect(0, toMap(180), S, S - toMap(180));
    // Cash pickups.
    ctx.fillStyle = '#39d353';
    for (const p of g.pickups || []) {
      if (!p.taken) {
        ctx.beginPath();
        ctx.arc(toMap(p.x), toMap(p.z), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Mission target.
    const tgt = g.missionTarget ? g.missionTarget() : null;
    if (tgt) {
      const pulse = 4 + Math.sin(performance.now() / 240) * 1.6;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(toMap(tgt[0]), toMap(tgt[1]), pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#20242e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Traffic.
    ctx.fillStyle = '#cfd6e4';
    for (const c of g.traffic.cars) {
      ctx.fillRect(toMap(c.group.position.x) - 1.5, toMap(c.group.position.z) - 1.5, 3, 3);
    }
    // Police.
    ctx.fillStyle = '#ff4d4d';
    for (const c of g.police.policeCars) {
      ctx.beginPath();
      ctx.arc(toMap(c.group.position.x), toMap(c.group.position.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const p = g.playerPos();
    const h = g.playerHeading();
    ctx.save();
    ctx.translate(toMap(p.x), toMap(p.z));
    ctx.rotate(Math.atan2(Math.sin(h), -Math.cos(h)));
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
