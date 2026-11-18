// Solmar Heat — the HUD: money, health, wanted stars, the mission tracker,
// toasts, the minimap, and the menu / win / busted / wasted screens.

import { CONFIG } from './config.js';

/** Wire the HUD. `game` is the shared game object. */
export function createHUD(game) {
  const $ = (id) => document.getElementById(id);
  const el = {
    money: $('money'),
    health: $('health-fill'),
    healthText: $('health-text'),
    stars: $('stars'),
    objective: $('objective'),
    objectiveBox: $('objective-box'),
    toasts: $('toasts'),
    minimap: $('minimap'),
    menu: $('screen-menu'),
    win: $('screen-win'),
    busted: $('screen-busted'),
    wasted: $('screen-wasted'),
    winTotal: $('win-total'),
    startBtn: $('start-btn'),
    continueBtn: $('continue-btn'),
    againBtn: $('again-btn'),
    retryBtn: $('retry-btn'),
    retryBtn2: $('retry-btn2'),
    saveNote: $('save-note'),
  };
  const ctx = el.minimap.getContext('2d');
  let shotMode = false;

  function starsText(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }

  return {
    set shotMode(v) {
      shotMode = v;
    },

    setMoney(n) {
      el.money.textContent = `$${n}`;
    },

    setHealth(n) {
      el.health.style.width = `${Math.max(0, Math.min(100, n))}%`;
      el.healthText.textContent = `${Math.ceil(Math.max(0, n))}`;
    },

    setWanted(n) {
      el.stars.textContent = starsText(n);
      el.stars.style.color = n > 0 ? '#ffd23e' : '#888';
    },

    setObjective(text) {
      el.objective.textContent = text;
      el.objectiveBox.style.display = text ? 'block' : 'none';
    },

    toast(title, body) {
      if (shotMode) return; // FIX: no toasts over staged shots.
      const div = document.createElement('div');
      div.className = 'toast';
      const b = document.createElement('div');
      b.className = 'toast-title';
      b.textContent = title;
      div.appendChild(b);
      if (body) {
        const s = document.createElement('div');
        s.className = 'toast-body';
        s.textContent = body;
        div.appendChild(s);
      }
      el.toasts.appendChild(div);
      while (el.toasts.children.length > 3) el.toasts.removeChild(el.toasts.firstChild);
      setTimeout(() => {
        if (div.parentNode) div.parentNode.removeChild(div);
      }, 4000);
    },

    showScreen(name) {
      for (const s of [el.menu, el.win, el.busted, el.wasted]) {
        if (s) s.style.display = 'none';
      }
      if (name === 'menu' && el.menu) el.menu.style.display = 'flex';
      if (name === 'win' && el.win) {
        el.winTotal.textContent = `$${game.money}`;
        el.win.style.display = 'flex';
      }
      if (name === 'busted' && el.busted) el.busted.style.display = 'flex';
      if (name === 'wasted' && el.wasted) el.wasted.style.display = 'flex';
    },

    hideScreens() {
      for (const s of [el.menu, el.win, el.busted, el.wasted]) {
        if (s) s.style.display = 'none';
      }
    },

    showContinue(hasSave) {
      if (el.continueBtn) el.continueBtn.style.display = hasSave ? 'inline-block' : 'none';
      if (el.saveNote) el.saveNote.style.display = hasSave ? 'block' : 'none';
    },

    onStart(fn) {
      if (el.startBtn) el.startBtn.addEventListener('click', () => fn(false));
      if (el.continueBtn) el.continueBtn.addEventListener('click', () => fn(true));
      if (el.againBtn) el.againBtn.addEventListener('click', () => fn(false));
      if (el.retryBtn) el.retryBtn.addEventListener('click', () => fn(false));
      if (el.retryBtn2) el.retryBtn2.addEventListener('click', () => fn(false));
    },

    /** Top-down minimap: roads, sea, player, police, mission marker. */
    drawMinimap() {
      const W = el.minimap.width;
      const H = el.minimap.height;
      const toMap = (x, z) => [((x + 210) / 420) * W, ((z + 210) / 420) * H];
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(20, 40, 30, 0.85)';
      ctx.fillRect(0, 0, W, H);
      // Sea.
      ctx.fillStyle = '#1f7a8c';
      ctx.fillRect(0, ((170 + 210) / 420) * H, W, H - ((170 + 210) / 420) * H);
      // Roads.
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      for (const r of CONFIG.world.roads) {
        const [x] = toMap(r, 0);
        const [, z] = toMap(0, r);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, z);
        ctx.lineTo(W, z);
        ctx.stroke();
      }
      // Mission marker.
      const marker = game.missions ? game.missions.marker : null;
      if (marker) {
        const [mx, mz] = toMap(marker.x, marker.z);
        ctx.fillStyle = marker.red ? '#ff4444' : '#ffd23e';
        ctx.beginPath();
        ctx.arc(mx, mz, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Police.
      if (game.police) {
        ctx.fillStyle = '#4488ff';
        for (const car of game.police.policeCars) {
          const [px, pz] = toMap(car.group.position.x, car.group.position.z);
          ctx.beginPath();
          ctx.arc(px, pz, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Player.
      const p = game.playerPos();
      if (p) {
        const [px, pz] = toMap(p.x, p.z);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, pz, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    },
  };
}
