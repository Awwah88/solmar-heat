// Solmar Heat — synthesized WebAudio sound. No audio files: every effect is
// a short oscillator/envelope patch, plus a quiet two-chord synth loop for
// the menu and a siren wail while the police are after you.
// New in R16: limo alarm, doubloon chime, fare bell, casino win arpeggio.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicTimer = null;
    this.sirenOn = false;
    this.sirenNodes = null;
    this.muted = false;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  }
  _tone(freq, dur, type = 'sine', vol = 0.5, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  _noise(dur, vol = 0.3, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }
  click() { this._tone(660, 0.07, 'square', 0.18); }
  pickup() { this._tone(880, 0.09, 'sine', 0.4); this._tone(1320, 0.12, 'sine', 0.3, null, 0.07); }
  cash() { this._tone(988, 0.08, 'triangle', 0.4); this._tone(1319, 0.14, 'triangle', 0.35, null, 0.06); }
  doubloon() { this._tone(1568, 0.1, 'sine', 0.45); this._tone(2093, 0.16, 'sine', 0.4, null, 0.08); this._tone(2637, 0.2, 'sine', 0.3, null, 0.16); }
  fareBell() { this._tone(1175, 0.12, 'triangle', 0.4); this._tone(1568, 0.18, 'triangle', 0.35, null, 0.1); }
  fareDone() { [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.14, 'triangle', 0.35, null, i * 0.07)); }
  missionDone() { [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(f, 0.16, 'triangle', 0.4, null, i * 0.08)); }
  casinoWin() { [880, 1109, 1319, 1760, 2217].forEach((f, i) => this._tone(f, 0.2, 'square', 0.16, null, i * 0.09)); }
  limoAlarm() { for (let i = 0; i < 3; i++) { this._tone(2200, 0.09, 'square', 0.2, 1800, i * 0.18); this._tone(1800, 0.09, 'square', 0.2, 2200, i * 0.18 + 0.09); } }
  punch() { this._noise(0.12, 0.5); this._tone(140, 0.1, 'sine', 0.5, 60); }
  shoot() { this._noise(0.09, 0.55); this._tone(900, 0.08, 'square', 0.25, 180); }
  crash() { this._noise(0.25, 0.6); this._tone(90, 0.22, 'sine', 0.5, 45); }
  busted() { [392, 330, 262, 196].forEach((f, i) => this._tone(f, 0.25, 'sawtooth', 0.25, null, i * 0.16)); }
  win() { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.4, null, i * 0.11)); }
  engineStart() { this._tone(70, 0.3, 'sawtooth', 0.25, 160); }
  spray() { this._noise(0.4, 0.2); this._tone(1200, 0.3, 'sine', 0.12, 2400); }
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const chords = [[220, 277, 330], [175, 220, 262], [196, 247, 294], [165, 208, 247]];
    let step = 0;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const chord = chords[step % chords.length];
      chord.forEach((f) => this._tone(f, 1.6, 'triangle', 0.05));
      step++;
    }, 900);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
  setSiren(on) {
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (!this.ctx) return;
    if (!on && this.sirenNodes) {
      try { this.sirenNodes.o.stop(); } catch (e) {}
      this.sirenNodes = null;
      return;
    }
    if (on) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 700;
      g.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.6;
      const lg = this.ctx.createGain();
      lg.gain.value = 320;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this.sirenNodes = { o, lfo };
    }
  }
}
