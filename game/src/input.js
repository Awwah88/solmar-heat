// Solmar Heat — input: keyboard state and mouse clicks, with the browser's
// default scrolling and shortcuts suppressed while the game has focus.

/** Track held keys and clicks. Returns helpers the game loop reads. */
export function createInput(onClick) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDown = false;

  const GAME_KEYS = [
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'KeyR',
  ];

  function onKeyDown(e) {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseDown(e) {
    if (e.button !== 0) return;
    mouseDown = true;
    if (onClick) onClick(e);
  }
  function onMouseUp() {
    mouseDown = false;
  }
  function onBlur() {
    keys.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  return {
    /** True while the key is held. */
    down(code) {
      return keys.has(code);
    },
    /** True only on the frame the key went down. */
    wasPressed(code) {
      return pressed.has(code);
    },
    /** Clear the per-frame pressed set (call once per frame). */
    endFrame() {
      pressed.clear();
    },
    get mouseDown() {
      return mouseDown;
    },
    /** Driving axes from WASD/arrows: { throttle, steer }. */
    driveAxes() {
      const up = keys.has('KeyW') || keys.has('ArrowUp');
      const dn = keys.has('KeyS') || keys.has('ArrowDown');
      const left = keys.has('KeyA') || keys.has('ArrowLeft');
      const right = keys.has('KeyD') || keys.has('ArrowRight');
      return {
        throttle: (up ? 1 : 0) + (dn ? -1 : 0),
        steer: (left ? -1 : 0) + (right ? 1 : 0),
        brake: keys.has('Space'),
        handbrake: keys.has('Space'),
        run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      };
    },
    /** On-foot move axes from WASD/arrows, relative to the camera heading. */
    moveAxes() {
      const up = keys.has('KeyW') || keys.has('ArrowUp');
      const dn = keys.has('KeyS') || keys.has('ArrowDown');
      const left = keys.has('KeyA') || keys.has('ArrowLeft');
      const right = keys.has('KeyD') || keys.has('ArrowRight');
      return {
        forward: (up ? 1 : 0) + (dn ? -1 : 0),
        strafe: (right ? 1 : 0) + (left ? -1 : 0),
        run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      };
    },
  };
}
