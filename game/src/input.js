// Solmar Heat — input.js
// Keyboard + mouse state only. The game reads this once per frame and
// then calls consumeFrame() so one-frame presses (wasPressed, clicked)
// clear. Keys are tracked by event.code, so the layout is the physical
// one — WASD works the same on any keyboard layout.
//
// Mouse look works by dragging: press and hold on the canvas, then
// move. A plain click (press without a drag) is the shoot action.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    // Keys currently held down, by event.code.
    this.keys = new Set();
    // Keys pressed since the last consumeFrame().
    this.pressed = new Set();
    // Mouse drag deltas accumulated this frame.
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.clicked = false;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.bindKeyboard();
    this.bindMouse(canvas);
  }

  bindKeyboard() {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      this.pressed.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.dragging = false;
    });
  }

  bindMouse(canvas) {
    canvas.addEventListener('mousedown', (event) => {
      this.dragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.clicked = true;
    });
    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });
    window.addEventListener('mousemove', (event) => {
      if (!this.dragging) return;
      this.mouseDX += event.clientX - this.lastX;
      this.mouseDY += event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    });
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // True only on the frame the key went down.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Movement axes, each -1..1. Left/right and forward/back, with the
  // arrow keys as alternates for WASD.
  moveX() {
    let x = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    return x;
  }

  moveY() {
    let y = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y -= 1;
    return y;
  }

  consumeFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.clicked = false;
  }
}
