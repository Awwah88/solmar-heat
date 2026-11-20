// Solmar Heat — synthesized sound (Round 17). No audio files: every sound
// is built from WebAudio oscillators and noise, so the game stays offline.
// All calls are safe before init and when audio is unavailable (headless).

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._engineOsc = null;
    this._engineGain = null;
    this._sirenOsc = null;
    this._sirenGain = null;
    this._sirenTimer = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  _noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol || 0.25;
      let node = src;
      if (lowpass) {
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = lowpass;
        src.connect(f);
        node = f;
      }
      node.connect(g);
      g.connect(this.master);
      src.start(t0);
    } catch (e) { /* ignore */ }
  }

  click() { this._tone(660, 0.06, 'square', 0.08); }
  pickup() { this._tone(880, 0.12, 'sine', 0.2, 1320); }
  coin() { this._tone(1180, 0.1, 'triangle', 0.18); this._tone(1560, 0.14, 'triangle', 0.14); }
  punch() { this._noise(0.12, 0.3, 900); }
  shot() { this._noise(0.16, 0.4, 2400); this._tone(180, 0.1, 'sawtooth', 0.2, 60); }
  crash() { this._noise(0.3, 0.4, 500); this._tone(90, 0.25, 'sawtooth', 0.2, 40); }
  door() { this._tone(220, 0.08, 'square', 0.1, 140); }
  vaultTick() { this._tone(1400, 0.05, 'square', 0.12); }
  vaultOpen() { this._tone(523, 0.15, 'triangle', 0.2); this._tone(784, 0.2, 'triangle', 0.2); }
  raceBeep(final) {
    if (final) { this._tone(1046, 0.3, 'square', 0.2); }
    else this._tone(440, 0.12, 'square', 0.16);
  }
  missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 'triangle', 0.2), i * 110));
  }
  busted() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => this._tone(f, 0.3, 'sawtooth', 0.16), i * 160));
  }

  engine(speed01) {
    if (!this.ctx || this.muted) return;
    try {
      if (!this._engineOsc) {
        this._engineOsc = this.ctx.createOscillator();
        this._engineOsc.type = 'sawtooth';
        this._engineGain = this.ctx.createGain();
        this._engineGain.gain.value = 0;
        this._engineOsc.connect(this._engineGain);
        this._engineGain.connect(this.master);
        this._engineOsc.start();
      }
      const target = speed01 > 0.02 ? 0.05 + speed01 * 0.06 : 0;
      this._engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this._engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.08);
    } catch (e) { /* ignore */ }
  }

  engineOff() {
    if (this._engineGain) this._engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  siren(on) {
    if (!this.ctx) return;
    try {
      if (on && !this._sirenOsc) {
        this._sirenOsc = this.ctx.createOscillator();
        this._sirenOsc.type = 'sine';
        this._sirenGain = this.ctx.createGain();
        this._sirenGain.gain.value = 0.0;
        this._sirenOsc.connect(this._sirenGain);
        this._sirenGain.connect(this.master);
        this._sirenOsc.start();
        this._sirenTimer = 0;
      } else if (!on && this._sirenOsc) {
        const o = this._sirenOsc;
        const g = this._sirenGain;
        this._sirenOsc = null;
        this._sirenGain = null;
        g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        setTimeout(() => { try { o.stop(); } catch (e) {} }, 400);
      }
    } catch (e) { /* ignore */ }
  }

  updateSiren(dt, wanted) {
    if (!this._sirenOsc || this.muted) return;
    this._sirenTimer += dt;
    const f = 700 + 320 * Math.sin(this._sirenTimer * 2.6);
    try {
      this._sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
      this._sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.045 : 0, this.ctx.currentTime, 0.2);
    } catch (e) { /* ignore */ }
  }
}
