// Solmar Heat bootstrap: build the game, surface any boot failure as
// an on-screen banner (so a headless run can report it), and expose the
// debug handle the dev tools poll.
import { createGame } from './world.js';

function banner(msg) {
  const el = document.getElementById('error-banner');
  if (el) {
    el.style.display = 'block';
    el.textContent = msg;
  }
  console.error(msg);
}

window.addEventListener('error', (e) => banner('Error: ' + (e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => banner('Error: ' + (e.reason && e.reason.message ? e.reason.message : e.reason)));

try {
  createGame();
} catch (err) {
  banner('Failed to start Solmar Heat: ' + (err && err.message ? err.message : err));
}
