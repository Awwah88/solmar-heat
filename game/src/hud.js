// Solmar Heat — HUD, minimap and menus. Draws money, health, wanted
// stars, the mission objective and dots, and — new in R16 — the doubloon
// counter, the taxi fare streak and the M5 objective line. The minimap is
// a live canvas: roads, blocks, landmarks, the player, police, traffic
// and the current mission beacon. Menus: start, pause, end (win/busted)
// and the downed overlay.
import { ROADS, BLOCKS } from './config.js';

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {};
    for (const id of ['hud', 'money', 'health-fill', 'health-num', 'stars', 'objective', 'mission-dots', 'doubloons', 'fare-streak', 'timer', 'toast', 'menu', 'start-btn', 'continue-btn', 'end', 'end-title', 'end-sub', 'end-btn', 'down', 'down-text', 'pause', 'resume-btn', 'restart-btn', 'minimap']) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCtx = this.el.minimap ? this.el.minimap.getContext('2d') : null;
    this.toastTimer = 0;
    if (this.el['start-btn']) this.el['start-btn'].addEventListener('click', () => this.game.startNewGame());
    if (this.el['continue-btn']) this.el['continue-btn'].addEventListener('click', () => this.game.continueGame());
    if (this.el['end-btn']) this.el['end-btn'].addEventListener('click', () => this.game.showMenu());
    if (this.el['resume-btn']) this.el['resume-btn'].addEventListener('click', () => this.game.resume());
    if (this.el['restart-btn']) this.el['restart-btn'].addEventListener('click', () => this.game.startNewGame());
  }
  showMenu() {
    this.el.menu.style.display = 'flex';
    this.el.hud.style.display = 'none';
    this.el.end.style.display = 'none';
    this.el.pause.style.display = 'none';
  }
  showPlaying() {
    this.el.menu.style.display = 'none';
    this.el.hud.style.display = 'block';
    this.el.end.style.display = 'none';
    this.el.pause.style.display = 'none';
  }
  showPause() {
    this.el.pause.style.display = 'flex';
  }
  hidePause() { this.el.pause.style.display = 'none'; }
  showEnd(kind, title, sub) {
    this.el.end.style.display = 'flex';
    this.el['end-title'].textContent = title;
    this.el['end-sub'].textContent = sub;
    this.el.end.dataset.kind = kind;
  }
  showDown(text) {
    this.el.down.style.display = 'flex';
    this.el['down-text'].textContent = text;
  }
  hideDown() { this.el.down.style.display = 'none'; }
  toast(msg) {
    if (!this.el.toast) return;
    this.el.toast.textContent = msg;
    this.el.toast.style.opacity = '1';
    this.toastTimer = 3.2;
  }
  update(dt) {
    const g = this.game;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.style.opacity = '0';
    }
    if (g.state !== 'playing' && g.state !== 'end') return;
    this.el.money.textContent = `$${Math.floor(g.money)}`;
    this.el['health-fill'].style.width = `${Math.max(0, Math.min(100, g.health))}%`;
    this.el['health-num'].textContent = `${Math.ceil(g.health)}`;
    this.el.stars.textContent = '★'.repeat(g.police.wanted) + '☆'.repeat(5 - g.police.wanted);
    this.el.stars.style.color = g.police.wanted > 0 ? '#ff5a5a' : '#ffd24a';
    this.el.objective.textContent = g.missions.objective();
    const dots = [1, 2, 3, 4, 5].map((i) => (g.missions.doneIds.includes(i) ? '●' : '○')).join(' ');
    this.el['mission-dots'].textContent = `Missions ${dots}  (${g.missions.doneCount}/5)`;
    this.el.doubloons.textContent = `◉ Doubloons ${g.missions.doubloonCount}/12`;
    const t = g.missions.taxi;
    this.el['fare-streak'].textContent = t.active
      ? `Taxi: ${t.active.state === 'pickup' ? 'pick up the fare' : 'drop off the fare'} · streak ${t.streak}`
      : `Taxi streak ${t.streak} · fares done ${t.done}`;
    this.el.timer.textContent = g.missions.current && g.missions.current.id === 2
      ? `Courier ${Math.max(0, Math.ceil(g.missions.timer))}s`
      : (g.missions.current && g.missions.current.id === 5 && g.missions.stage === 2
        ? `Deliver! ${Math.max(0, Math.ceil(g.missions.timer))}s` : '');
    this._drawMinimap();
  }
  _drawMinimap() {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const W = 170;
    const toMap = (v) => ((v + 200) / 400) * W;
    ctx.fillStyle = 'rgba(12,18,26,0.85)';
    ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = '#2c3844';
    for (const bx of BLOCKS) for (const bz of BLOCKS) ctx.fillRect(toMap(bx - 15), toMap(bz - 15), 30 * W / 400, 30 * W / 400);
    ctx.strokeStyle = '#5a6a78';
    ctx.lineWidth = 2;
    for (const r of ROADS) {
      ctx.beginPath(); ctx.moveTo(toMap(-198), toMap(r)); ctx.lineTo(toMap(198), toMap(r)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(toMap(r), toMap(-198)); ctx.lineTo(toMap(r), toMap(198)); ctx.stroke();
    }
    ctx.fillStyle = '#3fa7c9';
    ctx.fillRect(toMap(200), 0, W - toMap(200), W);
    const g = this.game;
    const target = g.missions.targetPos();
    if (target) {
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.arc(toMap(target.x), toMap(target.z), 5, 0, Math.PI * 2); ctx.fill();
    }
    const fare = g.missions.taxi.active;
    if (fare) {
      const ft = fare.state === 'pickup' ? fare.pickup : fare.dest;
      ctx.fillStyle = '#14b8a6';
      ctx.beginPath(); ctx.arc(toMap(ft.x), toMap(ft.z), 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ff5a5a';
    for (const c of g.police.policeCars) {
      ctx.beginPath(); ctx.arc(toMap(c.x), toMap(c.z), 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#e8e8e8';
    for (const c of g.traffic.cars) ctx.fillRect(toMap(c.x) - 1.5, toMap(c.z) - 1.5, 3, 3);
    const p = g.playerPos();
    ctx.fillStyle = '#37e08b';
    ctx.beginPath(); ctx.arc(toMap(p.x), toMap(p.z), 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#37e08b';
    ctx.beginPath();
    ctx.moveTo(toMap(p.x), toMap(p.z));
    ctx.lineTo(toMap(p.x + Math.sin(g.player.heading) * 14), toMap(p.z + Math.cos(g.player.heading) * 14));
    ctx.stroke();
  }
}
