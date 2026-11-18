// Solmar Heat — sound, all synthesized with WebAudio: no audio files, no
// network. Everything stays silent until the first user gesture, so the
// browser's autoplay rules are never fought.

/** Create the sound system. All methods are safe to call before init. */
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let sirenHigh = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || !ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Sound is garnish; a failure must never break the game.
    }
  }

  function noiseBurst(dur, vol) {
    if (!ensure() || !ctx) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch {
      // Sound is garnish.
    }
  }

  return {
    /** Call from any user gesture to unlock audio. */
    ensure,

    /** Engine hum that follows the car's speed (0..1). */
    engine(speed01) {
      if (!ensure() || !ctx) return;
      try {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineGain = ctx.createGain();
          engineOsc.type = 'sawtooth';
          engineGain.gain.setValueAtTime(0.02, ctx.currentTime);
          engineOsc.connect(engineGain);
          engineGain.connect(ctx.destination);
          engineOsc.start();
        }
        engineOsc.frequency.setValueAtTime(55 + speed01 * 130, ctx.currentTime);
        engineGain.gain.setValueAtTime(0.015 + speed01 * 0.05, ctx.currentTime);
      } catch {
        // Sound is garnish.
      }
    },

    /** Two-tone police siren while wanted. */
    siren(on) {
      if (!ensure() || !ctx) return;
      try {
        if (on && !sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenGain = ctx.createGain();
          sirenOsc.type = 'square';
          sirenGain.gain.setValueAtTime(0.02, ctx.currentTime);
          sirenOsc.connect(sirenGain);
          sirenGain.connect(ctx.destination);
          sirenOsc.start();
          sirenTimer = setInterval(() => {
            if (!sirenOsc) return;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.setValueAtTime(sirenHigh ? 950 : 700, ctx.currentTime);
          }, 350);
        } else if (!on && sirenOsc) {
          clearInterval(sirenTimer);
          sirenTimer = null;
          sirenOsc.stop();
          sirenOsc = null;
          sirenGain = null;
        }
      } catch {
        // Sound is garnish.
      }
    },

    shot() {
      noiseBurst(0.14, 0.3);
      tone(180, 0.1, 'square', 0.12, 60);
    },
    punch() {
      noiseBurst(0.08, 0.18);
    },
    crash() {
      noiseBurst(0.25, 0.3);
      tone(90, 0.25, 'sawtooth', 0.15, 40);
    },
    blip() {
      tone(880, 0.12, 'sine', 0.12, 1320);
    },
    jingle() {
      tone(523, 0.14, 'sine', 0.15);
      setTimeout(() => tone(659, 0.14, 'sine', 0.15), 130);
      setTimeout(() => tone(784, 0.22, 'sine', 0.15), 260);
    },
    busted() {
      tone(392, 0.3, 'sawtooth', 0.15, 196);
      setTimeout(() => tone(311, 0.5, 'sawtooth', 0.15, 155), 280);
    },
  };
}
