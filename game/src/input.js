// Keyboard + mouse input. A/D steer (heading increases = left turn),
// W/S drive or walk, Shift sprint, Space handbrake, E interact,
// F punch, Esc pause, T taxi, mouse drag orbits the camera, wheel zooms,
// click shoots (pistol). Edge-triggered "pressed" flags are consumed once.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.axes = { x: 0, y: 0 };
    this.orbitDelta = 0;
    this.zoomDelta = 0;
    this.clicked = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedKeys.add(e.code);
      if (["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onBlur = () => {
      this.keys.clear();
      this.pressedKeys.clear();
    };
    this._onMouseDown = (e) => {
      if (e.target !== canvas) return;
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    };
    this._onMouseMove = (e) => {
      if (!this._dragging) return;
      this.orbitDelta += (e.clientX - this._lastX) * 0.005;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    };
    this._onMouseUp = (e) => {
      if (this._dragging && Math.abs(e.clientX - (this._startX ?? e.clientX)) < 4) this.clicked = true;
      this._dragging = false;
    };
    this._onMouseDownCapture = (e) => {
      this._startX = e.clientX;
    };
    this._onWheel = (e) => {
      this.zoomDelta += Math.sign(e.deltaY);
    };
    this._dragging = false;
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);
    canvas.addEventListener("mousedown", this._onMouseDownCapture);
    canvas.addEventListener("mousedown", this._onMouseDown);
    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("mouseup", this._onMouseUp);
    canvas.addEventListener("wheel", this._onWheel, { passive: true });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  down(code) {
    return this.keys.has(code);
  }

  // True once, on the frame after the key went down.
  pressed(code) {
    return this.pressedKeys.has(code);
  }

  update() {
    const ax = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const ay = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
    this.axes.x = ax;
    this.axes.y = ay;
  }

  // Call at the end of every frame: clears edge flags and deltas.
  endFrame() {
    this.pressedKeys.clear();
    this.orbitDelta = 0;
    this.zoomDelta = 0;
    this.clicked = false;
  }

  get sprint() {
    return this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
  }

  get handbrake() {
    return this.keys.has("Space");
  }
}
