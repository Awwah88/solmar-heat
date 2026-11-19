// Solmar Heat — keyboard + mouse input. One job: turn raw DOM events into
// a clean per-frame state (axes, held keys, edge-triggered presses) that
// world.js, combat.js and the menus can read without touching events.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.mousePressed = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.enabled = true;
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); });
    window.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.mousePressed = true;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.keys.clear();
    });
  }
  get axes() {
    // x: -1 = D (right), +1 = A (left). y: +1 = W (forward), -1 = S (back).
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x += 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x -= 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    return { x, y };
  }
  get sprint() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  get interact() { return this.consume('KeyE'); }
  get punch() { return this.consume('Space') || this.consumeMouse(); }
  get shoot() { return this.consume('KeyF'); }
  get pause() { return this.consume('Escape') || this.consume('KeyP'); }
  get horn() { return this.keys.has('KeyH'); }
  consume(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }
  consumeMouse() {
    if (this.mousePressed) { this.mousePressed = false; return true; }
    return false;
  }
  endFrame() { this.pressed.clear(); this.mousePressed = false; }
}
