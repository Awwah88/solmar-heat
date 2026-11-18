// Synthesized WebAudio: engine hum, siren, gunshot, pickups, jingles.
// No audio files — everything is oscillators and filtered noise, built
// lazily on the first user gesture so browsers allow it.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      return true;
    } catch (e) { return false; }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch (e) { /* audio is decoration, never fatal */ }
  }

  function noise(dur, vol, freq) {
    if (!ensure()) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq || 1200;
      const g = ctx.createGain();
      g.gain.value = vol || 0.2;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start();
    } catch (e) { /* ignore */ }
  }

  return {
    ensure,
    click() { tone(660, 0.07, 'square', 0.06); },
    blip() { tone(880, 0.09, 'sine', 0.1, 1320); },
    cash() { tone(1046, 0.08, 'sine', 0.1); setTimeout(() => tone(1318, 0.12, 'sine', 0.1), 70); },
    jingle() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.12), i * 110));
    },
    shot() { noise(0.14, 0.3, 900); },
    punch() { noise(0.08, 0.18, 500); },
    crash() { noise(0.2, 0.25, 300); },
    busted() { tone(220, 0.5, 'sawtooth', 0.1, 110); },
    engine(on, speed01) {
      if (!ensure()) return;
      try {
        if (on && !engineOsc) {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineOsc.type = 'sawtooth';
          engineOsc.frequency.value = 60;
          engineGain.gain.value = 0.0;
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = 420;
          engineOsc.connect(f); f.connect(engineGain); engineGain.connect(ctx.destination);
          engineOsc.start();
        }
        if (engineOsc) {
          engineOsc.frequency.setTargetAtTime(55 + (speed01 || 0) * 140, ctx.currentTime, 0.08);
          engineGain.gain.setTargetAtTime(on ? 0.05 : 0.0, ctx.currentTime, 0.1);
        }
      } catch (e) { /* ignore */ }
    },
    siren(on) {
      if (!ensure()) return;
      try {
        if (on && !sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenGain = ctx.createGain();
          sirenOsc.type = 'sine';
          sirenOsc.frequency.value = 700;
          sirenGain.gain.value = 0.035;
          sirenOsc.connect(sirenGain); sirenGain.connect(ctx.destination);
          sirenOsc.start();
          let hi = false;
          sirenTimer = setInterval(() => {
            if (!sirenOsc) return;
            hi = !hi;
            sirenOsc.frequency.setTargetAtTime(hi ? 950 : 650, ctx.currentTime, 0.05);
          }, 420);
        } else if (!on && sirenOsc) {
          clearInterval(sirenTimer); sirenTimer = null;
          try { sirenOsc.stop(); } catch (e) { /* ignore */ }
          sirenOsc = null; sirenGain = null;
        }
      } catch (e) { /* ignore */ }
    },
  };
}
