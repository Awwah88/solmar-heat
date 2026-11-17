// Solmar Heat — audio.js
// One clear job: every sound in the game, synthesized live with WebAudio.
// No audio files, no network: oscillators, filtered noise and scheduled chords.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
    this.musicOn = true;
    this.musicTimer = null;
    this.musicStep = 0;
    this.started = false;
  }

  // Must be called from a user gesture (key/click) or it stays silent.
  ensure() {
    if (this.started) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine hum: two detuned sawtooths through a low-pass filter.
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc2.frequency.value = 28;
      this.engineOsc.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.engineOsc2.start();
      // Police siren: one square wave whose pitch flips on a timer.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.started = true;
      this.startMusic();
    } catch (err) {
      this.started = false;
    }
  }

  setEngine(speed, throttle) {
    if (!this.started) return;
    const target = throttle ? 0.05 + Math.min(0.09, Math.abs(speed) * 0.0022) : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    const freq = 52 + Math.abs(speed) * 3.4;
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(freq / 2, this.ctx.currentTime, 0.08);
  }

  setSiren(active, distance) {
    if (!this.started) return;
    const gain = active ? Math.max(0.012, 0.06 - distance * 0.0006) : 0;
    this.sirenGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.2);
    this.sirenTimer += 1;
    if (this.sirenTimer % 24 === 0) {
      this.sirenHigh = !this.sirenHigh;
      this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 920 : 660, this.ctx.currentTime, 0.05);
    }
  }

  blip(freq = 660, dur = 0.09, type = 'sine', vol = 0.16) {
    if (!this.started) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  coin() {
    this.blip(880, 0.08);
    setTimeout(() => this.blip(1320, 0.12), 70);
  }

  crash() {
    if (!this.started) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(38, this.ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  }

  gunshot() {
    if (!this.started) return;
    const len = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.22;
    src.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  missionComplete() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.2), i * 110));
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  }

  // A slow sunset pad: Am – F – C – G, one soft chord every 4 seconds.
  startMusic() {
    if (this.musicTimer) return;
    const chords = [
      [220, 261.6, 329.6],
      [174.6, 220, 261.6],
      [196, 261.6, 329.6],
      [196, 246.9, 293.7],
    ];
    this.musicTimer = setInterval(() => {
      if (!this.started || !this.musicOn) return;
      const chord = chords[this.musicStep % chords.length];
      this.musicStep += 1;
      chord.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.035, this.ctx.currentTime + 1.2);
        gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 3.8);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 4);
      });
    }, 4000);
  }
}
