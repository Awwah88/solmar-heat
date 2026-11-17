// Solmar Heat — input.js
// One clear job: keyboard and mouse state, nothing else.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.clicked = false;
    this.pressed = new Set();
    this.canvas = canvas;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;

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
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.dragging = false;
    });
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // True once, on the frame the key was pressed.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Steering / movement axes, -1..1.
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
