// Solmar Heat — bootstrap (Round 17). Creates the game, exposes it as
// window.__solmarHeat for the smoke/playtest drivers, wires the menu
// buttons, and applies ?shot= staging for screenshots.
import { Game } from './world.js';

const errBox = document.getElementById('error');
window.addEventListener('error', (e) => {
  if (errBox) {
    errBox.style.display = 'block';
    errBox.textContent = 'Error: ' + (e.message || (e.error && e.error.message) || 'unknown');
  }
});

const game = new Game();
window.__solmarHeat = game;

document.getElementById('start-btn').addEventListener('click', () => {
  game.audio.ensure();
  game.startGame();
});

const restartBtn = document.getElementById('restart-btn');
if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    game.saveSys.clear();
    window.location.reload();
  });
}

const muteBtn = document.getElementById('mute-btn');
if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    game.audio.ensure();
    game.audio.setMuted(!game.audio.muted);
    muteBtn.textContent = game.audio.muted ? '🔇 Muted' : '🔊 Sound';
  });
}

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  game.shots.apply(shot);
}
