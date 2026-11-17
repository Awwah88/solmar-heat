// Solmar Heat — input.js
// Keyboard and mouse state for the whole game. Everything else reads
// this module instead of touching DOM events directly, which keeps the
// controls in exactly one place and makes the autopilot easy to test.

export class Input {
  constructor() {
    // Held keys, by KeyboardEvent.code (KeyW, ArrowUp, Space, ...).
    this.keys = new Set();
    // Edge-triggered presses: true for exactly one update after keydown.
    this.pressed = new Set();
    // Mouse state for aiming and shooting.
    this.mouseDown = false;
    this.mouseClicked = false;
    this.mouseX = 0;
    this.mouseY = 0;
    // Pointer-lock style camera yaw driven by mouse movement.
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.enabled = true;
    this._onKeyDown = (event) => this._keydown(event);
    this._onKeyUp = (event) => this._keyup(event);
    this._onMouseDown = (event) => this._mousedown(event);
    this._onMouseUp = (event) => this._mouseup(event);
    this._onMouseMove = (event) => this._mousemove(event);
    this._onBlur = () => this._blur();
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('blur', this._onBlur);
  }

  _keydown(event) {
    if (!this.enabled) return;
    // Never let the page scroll while the game is running.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) this.pressed.add(event.code);
    this.keys.add(event.code);
  }

  _keyup(event) {
    this.keys.delete(event.code);
  }

  _mousedown(event) {
    if (!this.enabled) return;
    if (event.button === 0) {
      this.mouseDown = true;
      this.mouseClicked = true;
    }
  }

  _mouseup(event) {
    if (event.button === 0) this.mouseDown = false;
  }

  _mousemove(event) {
    this.lookDeltaX += event.movementX || 0;
    this.lookDeltaY += event.movementY || 0;
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;
  }

  _blur() {
    // Losing the window must never leave a key stuck down.
    this.keys.clear();
    this.mouseDown = false;
  }

  // Call once per frame, after the game has consumed the edge events.
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
  }

  isDown(...codes) {
    for (const code of codes) if (this.keys.has(code)) return true;
    return false;
  }

  wasPressed(...codes) {
    for (const code of codes) if (this.pressed.has(code)) return true;
    return false;
  }

  // Driving and walking axes, -1..1, from WASD or the arrow keys.
  get throttle() {
    let t = 0;
    if (this.isDown('KeyW', 'ArrowUp')) t += 1;
    if (this.isDown('KeyS', 'ArrowDown')) t -= 1;
    return t;
  }

  get steer() {
    let s = 0;
    if (this.isDown('KeyA', 'ArrowLeft')) s -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) s += 1;
    return s;
  }

  get running() {
    return this.isDown('ShiftLeft', 'ShiftRight');
  }

  get handbrake() {
    return this.isDown('Space');
  }

  // Edge-triggered actions are METHODS (not getters): the world calls
  // them once per frame and each returns true only on the frame the
  // key went down.
  actionPressed() {
    return this.wasPressed('KeyE', 'Enter');
  }

  shootPressed() {
    return this.wasPressed('KeyF') || this.mouseClicked;
  }

  pausePressed() {
    return this.wasPressed('Escape', 'KeyP');
  }

  radioPressed() {
    return this.wasPressed('KeyR');
  }

  hornPressed() {
    return this.wasPressed('KeyH');
  }

  taxiPressed() {
    return this.wasPressed('KeyT');
  }
}
