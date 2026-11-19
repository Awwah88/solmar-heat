// Synthesized WebAudio: engine hum, sirens, effects and a small bass loop.
// Everything is guarded — no AudioContext, no crash, no sound.
export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.unlocked = true;
      this._startEngine();
      this._startMusic();
    } catch (err) {
      this.ctx = null;
    }
  }

  _startEngine() {
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (err) { /* silent */ }
  }

  setEngine(speed, maxSpeed) {
    if (!this.ctx || !this.engineOsc) return;
    try {
      const t = this.ctx.currentTime;
      const f = 50 + (Math.abs(speed) / Math.max(1, maxSpeed)) * 130;
      this.engineOsc.frequency.setTargetAtTime(f, t, 0.08);
      this.engineGain.gain.setTargetAtTime(0.02 + Math.abs(speed) / Math.max(1, maxSpeed) * 0.05, t, 0.1);
    } catch (err) { /* silent */ }
  }

  setSiren(on) {
    if (!this.ctx) return;
    try {
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 720;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.025;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        this._sirenFlip = setInterval(() => {
          if (!this.sirenOsc) return;
          try {
            this.sirenOsc.frequency.value = this.sirenOsc.frequency.value > 700 ? 540 : 880;
          } catch (err) { /* silent */ }
        }, 420);
      } else if (!on && this.sirenOsc) {
        clearInterval(this._sirenFlip);
        try { this.sirenOsc.stop(); } catch (err) { /* silent */ }
        this.sirenOsc = null;
        this.sirenGain = null;
      }
    } catch (err) { /* silent */ }
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || !this.master) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch (err) { /* silent */ }
  }

  _noise(dur, vol, freq) {
    if (!this.ctx || !this.master) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq || 1200;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.2;
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t);
    } catch (err) { /* silent */ }
  }

  pickup() { this._tone(880, 0.12, 'sine', 0.18, 1320); }
  cash() { this._tone(660, 0.09, 'square', 0.1); setTimeout(() => this._tone(990, 0.12, 'square', 0.1), 90); }
  punch() { this._noise(0.12, 0.25, 500); }
  shot() { this._noise(0.16, 0.3, 2400); this._tone(180, 0.1, 'square', 0.12, 60); }
  crash() { this._noise(0.25, 0.3, 700); }
  busted() { this._tone(440, 0.5, 'sawtooth', 0.15, 220); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 'triangle', 0.16), i * 110));
  }

  _startMusic() {
    // Sparse bassline: A minor walk, one note per 340ms, quiet under the game.
    const bass = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
    try {
      this.musicTimer = setInterval(() => {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const f = bass[this.musicStep % bass.length];
        this.musicStep++;
        this._tone(f, 0.3, 'triangle', 0.05);
      }, 340);
    } catch (err) { /* silent */ }
  }

  dispose() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    if (this._sirenFlip) clearInterval(this._sirenFlip);
    if (this.ctx) { try { this.ctx.close(); } catch (err) { /* silent */ } }
  }
}
