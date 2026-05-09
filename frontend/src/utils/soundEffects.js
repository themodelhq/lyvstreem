// Lightweight in-browser sound synthesis. The previous implementation pointed at
// soundjay.com URLs which block hot-linking, so playback silently failed for every
// viewer. These synth fallbacks always work, run with no network round-trip, and
// are short enough not to stall the UI.

let _ctx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!_ctx) {
    try { _ctx = new Ctor(); } catch (_) { return null; }
  }
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

// Schedule a single tone with attack + decay envelope.
function tone(ctx, freq, startOffset, duration, type = 'sine', vol = 0.3) {
  const t0  = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Schedule a band-passed white-noise burst.
function noise(ctx, startOffset, duration, filterFreq = 0, vol = 0.3) {
  const t0     = ctx.currentTime + startOffset;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
  const data   = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  let node = src;
  if (filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterFreq;
    f.Q.value = 1;
    src.connect(f);
    node = f;
  }
  node.connect(g).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

// Pitch-glide tone (start freq → end freq, exponential).
function glide(ctx, fStart, fEnd, startOffset, duration, type = 'sine', vol = 0.3) {
  const t0  = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fStart, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t0 + duration);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playSoundEffect(soundId) {
  const ctx = getCtx();
  if (!ctx) return;
  switch (soundId) {
    case 'laugh': {
      // "ha-ha-ha-ha" — alternating short triangle tones
      [0, 0.13, 0.26, 0.39].forEach((t, i) => {
        const f = i % 2 === 0 ? 520 : 380;
        tone(ctx, f, t, 0.09, 'triangle', 0.28);
      });
      break;
    }
    case 'clap': {
      // five quick noise bursts
      [0, 0.09, 0.18, 0.27, 0.36].forEach(t => noise(ctx, t, 0.05, 1800, 0.45));
      break;
    }
    case 'cheer': {
      // crowd: sustained noise + uplifting tones
      noise(ctx, 0,   1.0, 700,  0.20);
      noise(ctx, 0.4, 0.6, 1200, 0.15);
      tone(ctx, 330, 0,    0.4, 'sawtooth', 0.12);
      tone(ctx, 440, 0.4,  0.4, 'sawtooth', 0.12);
      tone(ctx, 550, 0.8,  0.3, 'sawtooth', 0.12);
      break;
    }
    case 'aww': {
      // long descending sine, slightly mournful
      glide(ctx, 480, 220, 0, 0.85, 'sine', 0.3);
      break;
    }
    case 'drum': {
      // three low thumps — drum roll feel
      [0, 0.18, 0.36].forEach(t => glide(ctx, 140, 50, t, 0.12, 'sine', 0.5));
      break;
    }
    case 'airhorn': {
      // two parallel low square tones
      tone(ctx, 200, 0, 0.7, 'square', 0.35);
      tone(ctx, 250, 0, 0.7, 'square', 0.25);
      break;
    }
    case 'tada': {
      // three rising notes (C5 → E5 → G5)
      tone(ctx, 523, 0,    0.18, 'triangle', 0.30);
      tone(ctx, 659, 0.18, 0.18, 'triangle', 0.30);
      tone(ctx, 784, 0.36, 0.45, 'triangle', 0.40);
      break;
    }
    case 'boo': {
      // descending sawtooth — disapproval
      glide(ctx, 240, 80, 0, 0.65, 'sawtooth', 0.30);
      break;
    }
    default:
      // unknown id — short blip so the host knows the click registered
      tone(ctx, 440, 0, 0.12, 'sine', 0.2);
  }
}

// Optional: prime the audio context on first user gesture so subsequent
// programmatic plays don't get blocked by autoplay policies.
export function primeAudio() { getCtx(); }
