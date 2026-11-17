// Solmar Heat — synthesized sound and music.
// No audio files: every sound is built from oscillators and noise through
// the Web Audio API, and everything here is guarded so the game still runs
// where audio is unavailable (a headless browser, or before any gesture).

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.muted = false;
  }

  // Call from a user gesture (the START button). Safe to call repeatedly.
  unlock() {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  _tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ready || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  _noise(dur, vol = 0.2, lowpass = 1200, delay = 0) {
    if (!this.ready || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  click() {
    this._tone(660, 0.07, 'square', 0.08);
  }

  pickup() {
    this._tone(880, 0.09, 'sine', 0.18);
    this._tone(1318, 0.14, 'sine', 0.16, null, 0.08);
  }

  missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.2, null, i * 0.11));
  }

  missionFail() {
    this._tone(392, 0.25, 'sawtooth', 0.12, 220);
    this._tone(311, 0.4, 'sawtooth', 0.12, 196, 0.2);
  }

  punch() {
    this._noise(0.12, 0.3, 500);
  }

  gunshot() {
    this._noise(0.16, 0.4, 2400);
    this._tone(160, 0.1, 'square', 0.15, 60);
  }

  busted() {
    this._tone(440, 0.3, 'sawtooth', 0.14, 330);
    this._tone(330, 0.5, 'sawtooth', 0.14, 220, 0.28);
  }

  carDoor() {
    this._noise(0.09, 0.2, 800);
    this._tone(180, 0.08, 'square', 0.08, 120, 0.05);
  }

  cashRegister() {
    this._tone(988, 0.08, 'square', 0.1);
    this._tone(1319, 0.16, 'square', 0.1, null, 0.07);
  }

  // A looping two-tone siren while the police are after the player.
  setSiren(on) {
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    try {
      if (!this.ctx) return;
      if (on && this.ready && !this.muted) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 700;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.045;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.9;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(this.sirenOsc.frequency);
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        lfo.start();
        this._sirenLfo = lfo;
      } else if (this.sirenOsc) {
        try {
          this.sirenOsc.stop();
        } catch {
          // Already stopped.
        }
        try {
          this._sirenLfo && this._sirenLfo.stop();
        } catch {
          // Already stopped.
        }
        this.sirenOsc = null;
        this._sirenLfo = null;
      }
    } catch {
      this.sirenOsc = null;
    }
  }

  // Engine hum that follows the player's car speed.
  setEngine(speed, maxSpeed) {
    try {
      if (!this.ready || this.muted) {
        if (this.engineOsc) {
          try {
            this.engineOsc.stop();
          } catch {
            // Already stopped.
          }
          this.engineOsc = null;
        }
        return;
      }
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      const ratio = Math.max(0, Math.min(1, Math.abs(speed) / maxSpeed));
      this.engineOsc.frequency.setTargetAtTime(55 + ratio * 165, this.ctx.currentTime, 0.08);
      this.engineGain.gain.setTargetAtTime(0.02 + ratio * 0.05, this.ctx.currentTime, 0.1);
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  // A slow sunset-synth bass loop, started after the first gesture.
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
    const lead = [220, 262, 330, 262, 294, 330, 392, 330];
    this.musicTimer = window.setInterval(() => {
      if (!this.ready || this.muted) return;
      const i = this.musicStep % bass.length;
      this._tone(bass[i], 0.5, 'triangle', 0.11);
      if (this.musicStep % 2 === 0) {
        this._tone(lead[(this.musicStep / 2) | 0] ?? 220, 0.4, 'sine', 0.05);
      }
      this.musicStep++;
    }, 480);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.setSiren(false);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.setSiren(false);
    return this.muted;
  }
}
