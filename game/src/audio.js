// Solmar Heat — audio.js
// Every sound is synthesized live with WebAudio: oscillators, a little
// filtered noise and scheduled chords. No audio files, no network. The
// context only starts from a user gesture (a key press or click), which
// is when the game calls ensure().
//
// The engine is two persistent voices: an engine hum (two detuned
// oscillators through a low-pass filter) and a police siren (one square
// wave that flips pitch on a timer). Everything else — blips, coins,
// crashes, gunshots, the mission fanfare and the music pad — is a
// one-shot built on top of a small tone helper.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    // Engine hum voices.
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    // Police siren voice.
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
    this.musicOn = true;
    this.musicTimer = null;
    this.musicStep = 0;
    this.started = false;
  }

  ensure() {
    if (this.started) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.buildEngineVoices();
      this.buildSirenVoice();
      this.started = true;
      this.startMusic();
    } catch (err) {
      this.started = false;
    }
  }

  // Engine hum: two detuned sawtooths through a low-pass filter.
  buildEngineVoices() {
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
  }

  // Police siren: one square wave whose pitch flips on a timer.
  buildSirenVoice() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  // Engine pitch and loudness follow speed; silent when coasting.
  setEngine(speed, throttle) {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    const target = throttle ? 0.05 + Math.min(0.09, Math.abs(speed) * 0.0022) : 0.0;
    this.engineGain.gain.setTargetAtTime(target, now, 0.1);
    const freq = 52 + Math.abs(speed) * 3.4;
    this.engineOsc.frequency.setTargetAtTime(freq, now, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(freq / 2, now, 0.08);
  }

  // Siren loudness falls off with the nearest police car's distance.
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

  // One short tone with a fast decay — the building block for most
  // effects (blips, coins, the fanfare notes).
  playTone(freq, dur, type, vol, delay = 0) {
    if (!this.started) return;
    const when = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(when);
    osc.stop(when + dur);
  }

  blip(freq = 660, dur = 0.09, type = 'sine', vol = 0.16) {
    this.playTone(freq, dur, type, vol);
  }

  coin() {
    this.blip(880, 0.08);
    setTimeout(() => this.blip(1320, 0.12), 70);
  }

  // A low thump: a sine that drops in pitch and fades fast.
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

  // A burst of white noise that decays — the gunshot.
  gunshot() {
    if (!this.started) return;
    const len = Math.floor(this.ctx.sampleRate * 0.12);
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

  // Four rising notes for a finished mission.
  missionComplete() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.2), i * 110));
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  }

  // Play one soft chord: three triangle waves that swell in and fade
  // out over four seconds.
  playChord(notes) {
    notes.forEach((freq) => {
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
      this.playChord(chord);
    }, 4000);
  }
}
