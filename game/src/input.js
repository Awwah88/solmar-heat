// Solmar Heat — keyboard and mouse input.
// A single shared object: the game reads keys by name each frame, and the
// HUD and menus read the same "pressed once" edges for their buttons.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.anyKey = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.add(k);
      this.pressed.add(k);
      this.anyKey = true;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
    };
    this._onMouseMove = (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    };
    this._onMouseDown = () => {
      this.mouseDown = true;
    };
    this._onMouseUp = () => {
      this.mouseDown = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('blur', this._onBlur);
  }

  // Held down right now.
  down(...names) {
    for (const n of names) if (this.keys.has(n)) return true;
    return false;
  }

  // Pressed since the last frame; cleared by endFrame().
  hit(...names) {
    for (const n of names) if (this.pressed.has(n)) return true;
    return false;
  }

  // Driving axes: throttle -1..1, steer -1..1, from WASD or arrows.
  driveAxes() {
    const throttle = (this.down('w', 'ArrowUp') ? 1 : 0) - (this.down('s', 'ArrowDown') ? 1 : 0);
    const steer = (this.down('a', 'ArrowLeft') ? 1 : 0) - (this.down('d', 'ArrowRight') ? 1 : 0);
    return { throttle, steer };
  }

  // Walking axes, camera-relative: forward is away from the camera.
  walkAxes(cameraHeading) {
    const f = (this.down('w', 'ArrowUp') ? 1 : 0) - (this.down('s', 'ArrowDown') ? 1 : 0);
    const r = (this.down('d', 'ArrowRight') ? 1 : 0) - (this.down('a', 'ArrowLeft') ? 1 : 0);
    const sin = Math.sin(cameraHeading);
    const cos = Math.cos(cameraHeading);
    return {
      x: sin * f + cos * r,
      z: cos * f - sin * r,
    };
  }

  endFrame() {
    this.pressed.clear();
  }
}
