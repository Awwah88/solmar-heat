// Solmar Heat — audio.js
// All sound is synthesized live with WebAudio: no audio files, no network.
// Engine hum, police siren, gunshots, pickups and three radio stations
// (Solmar FM, Bay Beats, Neon Nights) are all oscillators and noise.

export const RADIO_STATIONS = [
  { name: 'Solmar FM', mood: 'lazy sunset chords' },
  { name: 'Bay Beats', mood: 'low bass cruise' },
  { name: 'Neon Nights', mood: 'bright synth arpeggio' },
];

export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.station = 0;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicOn = true;
    this.started = false;
  }

  // Browsers only allow audio after a user gesture; call from the first click.
  ensure() {
    if (this.started) {
      if (this.context && this.context.state === 'suspended') this.context.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.context = new AC();
      this.master = this.context.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.context.destination);
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.sfxGain = this.context.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.master);
      this._startEngine();
      this._startSiren();
      this._startRadio();
      this.started = true;
    } catch (err) {
      // Sound is garnish: a game with no audio still plays fine.
      this.context = null;
    }
  }

  _startEngine() {
    this.engineOsc = this.context.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  _startSiren() {
    this.sirenOsc = this.context.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 750;
    this.sirenLfo = this.context.createOscillator();
    this.sirenLfo.type = 'triangle';
    this.sirenLfo.frequency.value = 0.5;
    const lfoGain = this.context.createGain();
    lfoGain.gain.value = 280;
    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = this.context.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  // A tiny step sequencer: each station is a different note pattern and
  // waveform, scheduled one bar at a time so the music never blocks.
  _startRadio() {
    const patterns = [
      // Solmar FM — warm major chords, slow.
      { notes: [262, 330, 392, 494, 392, 330], wave: 'triangle', stepMs: 420 },
      // Bay Beats — low bass pulse.
      { notes: [110, 110, 131, 98, 110, 147], wave: 'sine', stepMs: 300 },
      // Neon Nights — quick bright arpeggio.
      { notes: [523, 659, 784, 1047, 784, 659, 587, 659], wave: 'square', stepMs: 170 },
    ];
    const tick = () => {
      if (!this.context || !this.musicOn) return;
      const p = patterns[this.station];
      const note = p.notes[this.musicStep % p.notes.length];
      this.musicStep += 1;
      const osc = this.context.createOscillator();
      osc.type = p.wave;
      osc.frequency.value = note;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.5, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + p.stepMs / 900);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start();
      osc.stop(this.context.currentTime + p.stepMs / 800);
      this.musicTimer = window.setTimeout(tick, p.stepMs);
    };
    tick();
  }

  cycleStation() {
    this.station = (this.station + 1) % RADIO_STATIONS.length;
    return RADIO_STATIONS[this.station].name;
  }

  stationName() {
    return RADIO_STATIONS[this.station].name;
  }

  setMusicOn(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.value = on ? 0.16 : 0.0;
  }

  // Called every frame with the driving state.
  update(speed, inCar, wanted) {
    if (!this.context) return;
    const target = inCar ? 0.05 + Math.min(0.12, Math.abs(speed) * 0.003) : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.context.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 3.2, this.context.currentTime, 0.1);
    const sirenTarget = wanted > 0 ? 0.045 : 0.0;
    this.sirenGain.gain.setTargetAtTime(sirenTarget, this.context.currentTime, 0.3);
  }

  _blip(freq, dur, type, vol) {
    if (!this.context) return;
    const osc = this.context.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(vol || 0.4, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.context.currentTime + dur);
  }

  _noise(dur, vol, lowpass) {
    if (!this.context) return;
    const len = Math.floor(this.context.sampleRate * dur);
    const buffer = this.context.createBuffer(1, len, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.context.createBufferSource();
    src.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = this.context.createGain();
    gain.gain.value = vol || 0.5;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start();
  }

  pickup() {
    this._blip(880, 0.12, 'sine', 0.45);
    window.setTimeout(() => this._blip(1320, 0.18, 'sine', 0.4), 90);
  }

  shell() {
    this._blip(660, 0.1, 'triangle', 0.4);
    window.setTimeout(() => this._blip(990, 0.14, 'triangle', 0.4), 80);
    window.setTimeout(() => this._blip(1320, 0.2, 'triangle', 0.35), 170);
  }

  gunshot() {
    this._noise(0.16, 0.7, 900);
    this._blip(160, 0.1, 'square', 0.3);
  }

  punch() {
    this._noise(0.1, 0.5, 500);
    this._blip(110, 0.12, 'sine', 0.4);
  }

  crash() {
    this._noise(0.3, 0.7, 700);
    this._blip(70, 0.3, 'sawtooth', 0.4);
  }

  horn() {
    this._blip(370, 0.25, 'square', 0.25);
    this._blip(466, 0.25, 'square', 0.25);
  }

  missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => window.setTimeout(() => this._blip(n, 0.22, 'triangle', 0.45), i * 110));
  }

  busted() {
    const notes = [392, 330, 262, 196];
    notes.forEach((n, i) => window.setTimeout(() => this._blip(n, 0.3, 'sawtooth', 0.3), i * 160));
  }

  click() {
    this._blip(700, 0.05, 'square', 0.2);
  }
}
