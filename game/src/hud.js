// HUD: money/health/wanted/objective bar, live minimap, toast messages and
// the menu / pause / busted / wasted / win screens. The DOM is built here
// so index.html stays small; the smoke test clicks #start-btn.
import { BLOCK_CENTRES, ROAD_CENTRES } from "./config.js";

function el(tag, cls, parent, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (parent) parent.appendChild(n);
  if (text !== undefined) n.textContent = text;
  return n;
}

export class Hud {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this._toastTimer = 0;
    this._build();
  }

  _build() {
    const top = el("div", null, this.root);
    top.id = "topbar";
    this.moneyChip = el("div", "chip panel", top, "$0");
    this.moneyChip.id = "money-chip";
    const hw = el("div", "panel", top);
    hw.id = "health-wrap";
    this.healthFill = el("div", null, hw);
    this.healthFill.id = "health-fill";
    this.starsChip = el("div", "chip panel", top, "");
    this.starsChip.id = "stars-chip";
    this.objective = el("div", "panel", this.root, "");
    this.objective.id = "objective";
    this.map = el("canvas", null, this.root);
    this.map.id = "minimap";
    this.map.width = 170;
    this.map.height = 170;
    this.toastEl = el("div", "panel", this.root, "");
    this.toastEl.id = "toast";
    this.hint = el("div", "panel", this.root, "WASD drive / walk · E enter car · F punch · Click shoot · Shift sprint · Space handbrake · Esc pause");
    this.hint.id = "hint";

    this.menu = el("div", "screen", this.root);
    el("h1", null, this.menu, "SOLMAR HEAT");
    el("h2", null, this.menu, "Dana “Dash” Reyes owes the Marlin Club $400. Four jobs stand between her and freedom.");
    el("p", null, this.menu, "Steal cars, outrun the Solmar Bay police, deliver packages, and pay the debt — or end up busted or wasted on the streets of the Bay.");
    const start = el("button", null, this.menu, "▶  New Game");
    start.id = "start-btn";
    start.addEventListener("click", () => this.game.startNew());
    this.continueBtn = el("button", "ghost", this.menu, "Continue");
    this.continueBtn.id = "continue-btn";
    this.continueBtn.addEventListener("click", () => this.game.continueSaved());
    el("p", "keys", this.menu, "WASD move · E steal / enter car · F punch · Mouse drag camera · Wheel zoom · Shift sprint · Space handbrake · Esc pause");

    this.pause = el("div", "screen hidden", this.root);
    el("h1", null, this.pause, "PAUSED");
    el("p", null, this.pause, "The Bay waits for no one — except right now.");
    const resume = el("button", null, this.pause, "Resume");
    resume.id = "resume-btn";
    resume.addEventListener("click", () => this.game.resume());
    const quit = el("button", "ghost", this.pause, "Quit to menu");
    quit.addEventListener("click", () => this.game.toMenu());

    this.end = el("div", "screen hidden", this.root);
    this.endTitle = el("h1", null, this.end, "");
    this.endText = el("p", null, this.end, "");
    this.endBtn = el("button", null, this.end, "Continue");
    this.endBtn.addEventListener("click", () => this.game.afterEnd());
  }

  showMenu(hasSave) {
    this.menu.classList.remove("hidden");
    this.pause.classList.add("hidden");
    this.end.classList.add("hidden");
    this.continueBtn.style.display = hasSave ? "" : "none";
    this._setHudVisible(false);
  }

  showPlaying() {
    this.menu.classList.add("hidden");
    this.pause.classList.add("hidden");
    this.end.classList.add("hidden");
    this._setHudVisible(true);
  }

  showPaused() {
    this.pause.classList.remove("hidden");
  }

  showEnd(kind, title, text, btn) {
    this.endTitle.textContent = title;
    this.endText.textContent = text;
    this.endBtn.textContent = btn;
    this.end.classList.remove("hidden");
  }

  hideEnd() {
    this.end.classList.add("hidden");
  }

  _setHudVisible(v) {
    const d = v ? "" : "none";
    this.moneyChip.parentElement.style.display = d;
    this.objective.style.display = d;
    this.map.style.display = d;
    this.hint.style.display = d;
    this.toastEl.style.display = d;
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = "1";
    this._toastTimer = 3;
  }

  update(dt, game) {
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.toastEl.style.opacity = "0";
    }
    this.moneyChip.textContent = `$${Math.floor(game.money)}`;
    this.healthFill.style.width = `${Math.max(0, Math.min(100, game.health))}%`;
    this.healthFill.style.background =
      game.health > 50 ? "linear-gradient(90deg,#37d67a,#a5e635)" : game.health > 25 ? "linear-gradient(90deg,#d8a52a,#ffd23e)" : "linear-gradient(90deg,#d82a2a,#ff7a5a)";
    this.starsChip.textContent = "★".repeat(game.police.wanted) + "☆".repeat(Math.max(0, 5 - game.police.wanted));
    this.starsChip.style.visibility = game.police.wanted > 0 ? "visible" : "hidden";
    const obj = game.missions.objective();
    const cur = game.missions.current;
    this.objective.innerHTML = cur ? `<b>${cur.title} ($${cur.reward})</b> — ${obj.replace(/^M\d+ \S+ — /, "")}` : obj;
    this._drawMap(game);
  }

  _drawMap(game) {
    const ctx = this.map.getContext("2d");
    const S = 170;
    const scale = S / 400;
    const toMap = (x, z) => [(x + 200) * scale, (z + 200) * scale];
    ctx.fillStyle = "#0a1626";
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = "#12365e";
    const [seaX] = toMap(180, 0);
    ctx.fillRect(seaX, 0, S - seaX, S);
    ctx.fillStyle = "#c9b183";
    const [sandX] = toMap(172, 0);
    ctx.fillRect(sandX, 0, seaX - sandX, S);
    ctx.fillStyle = "#232830";
    for (const b of BLOCK_CENTRES) {
      for (const c of BLOCK_CENTRES) {
        const [x, y] = toMap(b - 15, c - 15);
        ctx.fillRect(x, y, 30 * scale, 30 * scale);
      }
    }
    ctx.strokeStyle = "#3a4150";
    ctx.lineWidth = 1;
    for (const r of ROAD_CENTRES) {
      const [x0, y0] = toMap(-180, r);
      const [x1] = toMap(180, r);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y0);
      ctx.stroke();
      const [x2, y2] = toMap(r, -180);
      const [, y3] = toMap(r, 180);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2, y3);
      ctx.stroke();
    }
    const dot = (x, z, color, r) => {
      const [mx, my] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const p of game.pickups) if (!p.taken) dot(p.x, p.z, "#37d67a", 2.5);
    const ts = game.missions.taxiStand();
    if (!game.missions.taxi.active) dot(ts.x, ts.z, "#2ad8d8", 2.5);
    for (const c of game.traffic.cars) dot(c.x, c.z, "#9aa0a8", 1.8);
    for (const c of game.police.policeCars) dot(c.x, c.z, "#ff3b30", 2.6);
    const m = game.missions.marker();
    if (m) {
      const [mx, my] = toMap(m.x, m.z);
      const pulse = 4 + Math.sin(performance.now() * 0.006) * 1.6;
      ctx.strokeStyle = "#ffd23e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ffd23e";
      ctx.beginPath();
      ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = game.playerPos();
    const [px, py] = toMap(p.x, p.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - game.playerHeading());
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.4, 5);
    ctx.lineTo(-4.4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
