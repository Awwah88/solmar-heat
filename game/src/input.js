// Keyboard + mouse input. A turns left (heading increases), D turns right,
// the same on foot and in a car. W/S are forward/back, E interacts.
export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseDown = false;
    this.dragX = 0;
    this.dragY = 0;
    this.wheel = 0;
    this.enabled = true;
    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.justPressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = (e) => {
      this.mouseDown = true;
      this.justPressed.add('Mouse0');
    };
    this._onMouseUp = () => { this.mouseDown = false; };
    this._onMouseMove = (e) => {
      if (this.mouseDown) {
        this.dragX += e.movementX || 0;
        this.dragY += e.movementY || 0;
      }
    };
    this._onWheel = (e) => { this.wheel += Math.sign(e.deltaY); };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('wheel', this._onWheel);
    window.addEventListener('blur', this._onBlur);
  }

  // Steering axis: A = -1, D = +1. Heading changes by -axes.x * turn * dt,
  // so A (axes.x = -1) increases the heading: A turns left.
  get axes() {
    const x = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0)
      - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const y = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0)
      - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    return { x, y };
  }

  get sprint() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  get handbrake() {
    return this.keys.has('Space');
  }

  // Edge-triggered press; consumes the press so it fires once.
  consume(code) {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    return false;
  }

  pressed(code) {
    return this.justPressed.has(code);
  }

  // Called at the end of each frame: clears one-shot presses and drag deltas.
  endFrame() {
    this.justPressed.clear();
    this.dragX = 0;
    this.dragY = 0;
    this.wheel = 0;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('blur', this._onBlur);
  }
}
