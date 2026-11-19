// Solmar Heat — keyboard + mouse input.
// Tracks held keys, exposes steering/throttle axes, and records
// edge-triggered presses (E to enter a car, F to punch, G for the
// pistol) that the world loop consumes once per frame.

export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseDown = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.dragging = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.justPressed.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = () => {
      this.mouseDown = true;
      this.dragging = true;
    };
    this._onMouseUp = () => {
      this.mouseDown = false;
      this.dragging = false;
    };
    this._onMouseMove = (e) => {
      if (this.dragging) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    };
    this._onWheel = (e) => {
      this.wheel += e.deltaY;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
      this.dragging = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('wheel', this._onWheel);
    window.addEventListener('blur', this._onBlur);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // True once for the frame in which the key went down.
  pressed(code) {
    return this.justPressed.has(code);
  }

  // Steering: +1 = D (right), -1 = A (left). Throttle: +1 = W, -1 = S.
  get axes() {
    const x = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const y = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    return { x, y };
  }

  get run() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  // Call at the end of every frame: clears edge triggers and drag deltas.
  endFrame() {
    this.justPressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
