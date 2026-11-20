// Solmar Heat — keyboard input (Round 17).
// Tracks held keys and edge-triggered presses. W/S drive, A/D steer
// (A turns left = heading increases), E enters/exits cars, F punches or
// fires the pistol, R starts a street race near a race marker, Space is
// the handbrake, M mutes, Escape pauses.

const STEER_LEFT = ['KeyA', 'ArrowLeft'];
const STEER_RIGHT = ['KeyD', 'ArrowRight'];
const FORWARD = ['KeyW', 'ArrowUp'];
const REVERSE = ['KeyS', 'ArrowDown'];

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.enabled = true;
    this._onDown = (e) => {
      if (!this.enabled) return;
      if (e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    };
    this._onUp = (e) => {
      this.down.delete(e.code);
    };
    this._onBlur = () => {
      this.down.clear();
    };
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup', this._onUp);
    window.addEventListener('blur', this._onBlur);
  }

  isDown(code) {
    return this.down.has(code);
  }

  // True once per physical press; consumed at the end of each frame.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
  }

  // -1 (right) .. +1 (left). A/Left increases heading.
  steerAxis() {
    let v = 0;
    if (STEER_LEFT.some((c) => this.down.has(c))) v += 1;
    if (STEER_RIGHT.some((c) => this.down.has(c))) v -= 1;
    return v;
  }

  // +1 forward, -1 reverse.
  driveAxis() {
    let v = 0;
    if (FORWARD.some((c) => this.down.has(c))) v += 1;
    if (REVERSE.some((c) => this.down.has(c))) v -= 1;
    return v;
  }

  handbrake() {
    return this.down.has('Space');
  }

  sprint() {
    return this.down.has('ShiftLeft') || this.down.has('ShiftRight');
  }

  detach() {
    window.removeEventListener('keydown', this._onDown);
    window.removeEventListener('keyup', this._onUp);
    window.removeEventListener('blur', this._onBlur);
  }
}
