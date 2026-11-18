// HUD: money, wanted stars, health, minimap, objective, mission
// tracker, toasts and the menu screens. Toasts are suppressed while a
// screenshot is being staged.
export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const moneyEl = $('money');
  const starsEl = $('stars');
  const healthFill = $('health-fill');
  const healthText = $('health-text');
  const objectiveEl = $('objective');
  const trackerEl = $('tracker');
  const toastsEl = $('toasts');
  const speedEl = $('speed');
  const map = $('minimap');
  const mctx = map ? map.getContext('2d') : null;

  let toastTimer = null;

  function renderStars(n) {
    starsEl.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    starsEl.style.color = n >= 3 ? '#ff4444' : '#ffd27a';
  }

  function setObjective(text) {
    if (objectiveEl && objectiveEl.textContent !== text) objectiveEl.textContent = text;
  }

  function toast(msg) {
    if (G.shotMode || !toastsEl) return;
    toastsEl.textContent = msg;
    toastsEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastsEl.style.opacity = '0'; }, 3400);
  }

  function setTracker() {
    if (!trackerEl) return;
    const titles = ['M1 Hot Wheels', 'M2 Sunset Courier', 'M3 The Heat', "M4 Marlin's Debt"];
    const mi = G.missions.missionIndex;
    let html = '';
    titles.forEach((t, i) => {
      const done = i < mi || mi >= 4;
      const active = i === mi && mi < 4;
      html += `<div class="${done ? 'done' : active ? 'active' : ''}">${done ? '✓' : active ? '▶' : '○'} ${t}</div>`;
    });
    if (mi === 1) html += `<div class="sub">Package ${G.missions.packageIdx + 1} of 3 · ${Math.ceil(G.missions.timer)}s</div>`;
    trackerEl.innerHTML = html;
  }

  function drawMinimap() {
    if (!mctx) return;
    const S = 140, W = 380; // world spans -190..190
    const px = (x) => ((x + 190) / W) * S;
    const pz = (z) => ((z + 190) / W) * S;
    mctx.fillStyle = '#10141a';
    mctx.fillRect(0, 0, S, S);
    // Roads.
    mctx.fillStyle = '#3a3a42';
    for (const r of [-162, -126, -90, -54, -18, 18, 54, 90, 126, 162]) {
      mctx.fillRect(px(r) - 2, 0, 4, S);
      mctx.fillRect(0, pz(r) - 2, S, 4);
    }
    // Beach + sea.
    mctx.fillStyle = '#d9b380';
    mctx.fillRect(0, pz(162), S, pz(182) - pz(162));
    mctx.fillStyle = '#1d6f8e';
    mctx.fillRect(0, pz(182), S, S - pz(182));
    // Buildings.
    mctx.fillStyle = '#8a8a86';
    for (const b of G.city.buildings) {
      mctx.fillRect(px(b.x - b.hw), pz(b.z - b.hd), Math.max(2, px(b.x + b.hw) - px(b.x - b.hw)), Math.max(2, pz(b.z + b.hd) - pz(b.z - b.hd)));
    }
    // Landmarks.
    mctx.fillStyle = '#ffd27a';
    for (const k of Object.keys(G.city.landmarks)) {
      const l = G.city.landmarks[k];
      mctx.fillRect(px(l.x) - 2, pz(l.z) - 2, 4, 4);
    }
    // Mission marker.
    const mk = G.missions.marker;
    if (mk) {
      mctx.fillStyle = '#ffdd33';
      mctx.beginPath();
      mctx.arc(px(mk.x), pz(mk.z), 4, 0, Math.PI * 2);
      mctx.fill();
    }
    // Traffic (grey), police (red), gold car (gold).
    mctx.fillStyle = '#9aa0a6';
    for (const c of G.traffic.cars) mctx.fillRect(px(c.group.position.x) - 1, pz(c.group.position.z) - 1, 2, 2);
    mctx.fillStyle = '#ff4444';
    for (const c of G.police.policeCars) mctx.fillRect(px(c.group.position.x) - 1, pz(c.group.position.z) - 1, 3, 3);
    if (G.missions.goldCar) {
      mctx.fillStyle = '#ffd700';
      mctx.fillRect(px(G.missions.goldCar.group.position.x) - 2, pz(G.missions.goldCar.group.position.z) - 2, 4, 4);
    }
    // Player arrow.
    const p = G.playerPos();
    mctx.save();
    mctx.translate(px(p.x), pz(p.z));
    mctx.rotate(Math.PI - G.playerHeading());
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -5); mctx.lineTo(4, 4); mctx.lineTo(-4, 4); mctx.closePath();
    mctx.fill();
    mctx.restore();
  }

  let mapTick = 0;
  return {
    setMoney(v) { if (moneyEl) moneyEl.textContent = '$' + Math.floor(v); },
    setWanted(n) { renderStars(n); },
    setHealth(n) {
      const h = Math.max(0, Math.min(100, Math.ceil(n)));
      if (healthFill) healthFill.style.width = h + '%';
      if (healthText) healthText.textContent = h;
    },
    setSpeed(v) { if (speedEl) speedEl.textContent = v > 0.5 ? Math.round(v * 3.6) + ' km/h' : ''; },
    setObjective, toast, setTracker,
    drawMinimap(dt) {
      mapTick += dt;
      if (mapTick > 0.12) { mapTick = 0; drawMinimap(); }
    },
    showScreen(name) {
      for (const id of ['menu', 'pause-menu', 'win-screen', 'busted-screen', 'wasted-screen']) {
        const el = $(id);
        if (el) el.style.display = id === name ? 'flex' : 'none';
      }
      const hud = $('hud');
      if (hud) hud.style.display = name === null ? 'block' : 'none';
    },
    setWinMoney(v) {
      const el = $('win-money');
      if (el) el.textContent = '$' + Math.floor(v);
    },
  };
}
