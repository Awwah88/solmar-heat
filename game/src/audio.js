// Synthesized WebAudio sound: engine hum, police siren, gunshot, pickup
// blip, mission jingle and a quiet synth pad. Everything is created lazily
// on the first user gesture and every call is guarded, so a headless
// browser (or a browser without audio) never breaks the game loop.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.padOsc = null;
    this.padGain = null;
    this._sirenHigh = false;
    this._sirenTimer = 0;
    this._musicTimer = 0;
    this._musicStep = 0;
    this.enabled = true;
  }

  unlock() {
    try {
      if (this.ctx) {
        if (this.ctx.state === "suspended") void this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = "lowpass";
      engineFilter.frequency.value = 420;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = "square";
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.padOsc = this.ctx.createOscillator();
      this.padOsc.type = "triangle";
      this.padOsc.frequency.value = 110;
      this.padGain = this.ctx.createGain();
      this.padGain.gain.value = 0.015;
      this.padOsc.connect(this.padGain);
      this.padGain.connect(this.master);
      this.padOsc.start();
    } catch {
      this.ctx = null;
    }
  }

  _blip(freqA, freqB, dur, vol, type = "sine") {
    try {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freqA, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch {
      // audio is decoration; never let it throw
    }
  }

  _noise(dur, vol) {
    try {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(g);
      g.connect(this.master);
      src.start(t);
    } catch {
      // ignore
    }
  }

  shot() {
    this._noise(0.16, 0.5);
    this._blip(220, 60, 0.12, 0.25, "square");
  }

  punch() {
    this._noise(0.08, 0.3);
  }

  pickup() {
    this._blip(880, 1320, 0.14, 0.3);
  }

  denied() {
    this._blip(180, 120, 0.18, 0.25, "square");
  }

  jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => this._blip(f, f, 0.22, 0.28, "triangle"), i * 110);
    });
  }

  busted() {
    this._blip(392, 196, 0.5, 0.3, "sawtooth");
  }

  update(dt, speed01, wanted) {
    if (!this.ctx) return;
    try {
      if (this.engineGain) {
        this.engineGain.gain.value = 0.015 + speed01 * 0.05;
        this.engineOsc.frequency.value = 52 + speed01 * 130;
      }
      if (this.sirenGain) {
        const target = wanted > 0 ? 0.028 : 0;
        this.sirenGain.gain.value += (target - this.sirenGain.gain.value) * Math.min(1, dt * 4);
        this._sirenTimer += dt;
        if (this._sirenTimer > 0.45) {
          this._sirenTimer = 0;
          this._sirenHigh = !this._sirenHigh;
          this.sirenOsc.frequency.value = this._sirenHigh ? 950 : 700;
        }
      }
      if (this.padOsc) {
        this._musicTimer += dt;
        if (this._musicTimer > 2.4) {
          this._musicTimer = 0;
          const roots = [110, 98, 87.3, 130.8];
          this._musicStep = (this._musicStep + 1) % roots.length;
          this.padOsc.frequency.setValueAtTime(roots[this._musicStep], this.ctx.currentTime);
        }
      }
    } catch {
      // ignore
    }
  }
}
