// Keyboard + mouse input for Solmar Heat. Tracks held keys, edge-triggered
// presses (consumed once per frame) and a drag-look delta for the camera.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.mouseClicked = false;
    this.lookX = 0;
    this.lookY = 0;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = (e) => {
      this.mouseDown = true;
      this.mouseClicked = true;
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    };
    this._onMouseUp = () => {
      this.mouseDown = false;
      this._dragging = false;
    };
    this._onMouseMove = (e) => {
      if (!this._dragging) return;
      this.lookX += e.clientX - this._lastX;
      this.lookY += e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
      this._dragging = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
  }

  down(code) {
    return this.keys.has(code);
  }

  // True once, on the frame the key went down.
  hit(code) {
    return this.pressed.has(code);
  }

  // Steering axes: x is -1 (A) .. +1 (D), y is -1 (S) .. +1 (W).
  axes() {
    const x = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    const y = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
    return { x, y };
  }

  consumeLook() {
    const d = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return d;
  }

  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('blur', this._onBlur);
  }
}
