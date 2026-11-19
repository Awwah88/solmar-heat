// Synthesized WebAudio sound for Solmar Heat — no audio files, everything
// is oscillators and filtered noise, started only after a user gesture.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._engineOsc = null;
    this._engineGain = null;
    this._sirenOsc = null;
    this._sirenGain = null;
    this._sirenOn = false;
    this._musicTimer = null;
    this._musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this._startEngineHum();
    this._startSiren();
    this._startMusic();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  _noiseBuffer(seconds = 0.4) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _blip(freq, dur, type = 'sine', vol = 0.25, slideTo = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _thump(vol = 0.5, dur = 0.18) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  click() { this._blip(880, 0.06, 'square', 0.12); }
  pickup() { this._blip(660, 0.09, 'sine', 0.22); this._blip(990, 0.14, 'sine', 0.2); }
  punch() { this._thump(0.55, 0.12); this._blip(140, 0.1, 'triangle', 0.3, 60); }
  shot() { this._thump(0.7, 0.22); this._blip(1800, 0.08, 'sawtooth', 0.18, 220); }
  ram() { this._thump(0.8, 0.3); this._blip(90, 0.25, 'sine', 0.4, 45); }
  sirenBlip() { this._blip(1150, 0.12, 'square', 0.1, 950); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this._blip(f, 0.22, 'triangle', 0.22), i * 110);
    });
  }

  engine(speed01) {
    if (!this._engineOsc || !this.ctx) return;
    const t = this.ctx.currentTime;
    this._engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.08);
    this._engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, t, 0.1);
  }

  siren(on) {
    this._sirenOn = on;
    if (!this._sirenGain || !this.ctx) return;
    this._sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.2);
  }

  _startEngineHum() {
    this._engineOsc = this.ctx.createOscillator();
    this._engineOsc.type = 'sawtooth';
    this._engineOsc.frequency.value = 52;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    this._engineGain = this.ctx.createGain();
    this._engineGain.gain.value = 0.02;
    this._engineOsc.connect(f);
    f.connect(this._engineGain);
    this._engineGain.connect(this.master);
    this._engineOsc.start();
  }

  _startSiren() {
    this._sirenOsc = this.ctx.createOscillator();
    this._sirenOsc.type = 'triangle';
    this._sirenOsc.frequency.value = 780;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.9;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfoGain.connect(this._sirenOsc.frequency);
    this._sirenGain = this.ctx.createGain();
    this._sirenGain.gain.value = 0;
    this._sirenOsc.connect(this._sirenGain);
    this._sirenGain.connect(this.master);
    this._sirenOsc.start();
    lfo.start();
  }

  _startMusic() {
    // Slow sunset groove: a bass line that loops while the game runs.
    const bass = [55, 0, 65.4, 0, 49, 0, 58.3, 0, 55, 0, 65.4, 0, 73.4, 65.4, 58.3, 49];
    this._musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const f = bass[this._musicStep % bass.length];
      this._musicStep++;
      if (f) this._blip(f, 0.42, 'triangle', 0.07);
    }, 300);
  }
}
