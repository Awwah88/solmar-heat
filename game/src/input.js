// Keyboard + mouse input. Tracks held keys and edge-triggered presses
// (consumed once per frame by the game loop).
export function createInput() {
  const held = new Set();
  const pressed = new Set();
  let mouseDown = false;
  let mouseClicked = false;

  const down = (e) => {
    if (e.repeat) return;
    held.add(e.code);
    pressed.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  };
  const up = (e) => held.delete(e.code);
  const md = () => { mouseDown = true; mouseClicked = true; };
  const mu = () => { mouseDown = false; };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('mousedown', md);
  window.addEventListener('mouseup', mu);
  window.addEventListener('blur', () => held.clear());

  return {
    isDown(code) { return held.has(code); },
    // True once for the frame the key went down; call once per frame.
    wasPressed(code) { return pressed.has(code); },
    mouseClicked() { return mouseClicked; },
    get mouseDown() { return mouseDown; },
    // Call at the end of each frame so edges do not linger.
    endFrame() { pressed.clear(); mouseClicked = false; },
  };
}
