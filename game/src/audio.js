// Solmar Heat — synthesized sound. Every effect is built with the
// WebAudio API, so the game ships no audio files at all. The context
// is created on the first user gesture (the Start button), which is
// the only way browsers allow audio to begin.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this._startEngine();
      this._startMusic();
    } catch (err) {
      this.ctx = null;
    }
  }

  _startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 420;
    this.engineOsc.connect(filt);
    filt.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speed01, inCar) {
    if (!this.ctx || !this.engineOsc) return;
    const target = inCar ? 0.05 + speed01 * 0.075 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      let high = true;
      this.sirenTimer = setInterval(() => {
        if (!this.sirenOsc) return;
        high = !high;
        this.sirenOsc.frequency.setTargetAtTime(high ? 720 : 540, this.ctx.currentTime, 0.05);
      }, 420);
    } else if (!on && this.sirenOsc) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
      try { this.sirenOsc.stop(); } catch (err) { /* already stopped */ }
      this.sirenOsc.disconnect();
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  _blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(dur, vol, freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = freq || 1200;
    const gain = this.ctx.createGain();
    gain.gain.value = vol || 0.3;
    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  // Create the audio context on the first user gesture (the Start
  // button), which is the only way browsers allow audio to begin.
  resume() { this.ensure(); }
  horn() { this._blip(370, 0.18, 'square', 0.14, 370); setTimeout(() => this._blip(370, 0.15, 'square', 0.12), 160); }
  door() { this._noise(0.09, 0.22, 900); }
  win() {
    this._blip(523, 0.16, 'triangle', 0.22);
    setTimeout(() => this._blip(659, 0.16, 'triangle', 0.22), 150);
    setTimeout(() => this._blip(784, 0.3, 'triangle', 0.22), 300);
  }
  click() { this._blip(660, 0.07, 'square', 0.12); }
  pickup() { this._blip(880, 0.12, 'sine', 0.22, 1320); }
  mission() { this._blip(523, 0.14, 'triangle', 0.22); setTimeout(() => this._blip(784, 0.2, 'triangle', 0.22), 130); }
  punch() { this._noise(0.12, 0.35, 500); }
  shot() { this._noise(0.18, 0.5, 2600); this._blip(180, 0.1, 'square', 0.25, 60); }
  crash() { this._noise(0.25, 0.4, 700); }
  busted() { this._blip(392, 0.25, 'sawtooth', 0.2, 196); }
  spray() { this._noise(0.5, 0.12, 4000); }

  _startMusic() {
    // A lazy bass line: root notes of a I–vi–IV–V loop in A minor.
    const roots = [110, 87.31, 130.81, 98];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const root = roots[this.musicStep % roots.length];
      this.musicStep++;
      this._blip(root, 0.5, 'triangle', 0.06);
      this._blip(root * 2, 0.25, 'sine', 0.04);
    }, 480);
  }
}
