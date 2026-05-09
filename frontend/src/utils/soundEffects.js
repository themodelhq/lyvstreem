// Sound playback for the moderation soundboard.
//
// Strategy: try to play a real recorded audio file first (Google's free
// Actions sound library — stable, free for hot-linking, OGG format which all
// modern browsers including Safari 14+ support). If the file fails to load or
// decode, fall back to an in-browser Web-Audio synth so the click is never
// silent. The synth path is also what older browsers without OGG support land on.
//
// Replacing the URLs is just a one-liner per effect — drop in any reachable
// MP3/OGG/WAV URL and it'll be used in preference to the synth.

const REAL_SOUND_URLS = {
  // Google Actions Sound Library — public, hot-link friendly, stable URLs.
  // Filenames verified against the public catalog at
  //   https://developers.google.com/assistant/tools/sound-library/categories
  // If you want to swap any of these for a different recording (your own
  // upload, a Pixabay link, etc.), just change the URL here — no other
  // changes are needed.
  laugh:   'https://actions.google.com/sounds/v1/human_voices/woman_laughing.ogg',
  clap:    'https://actions.google.com/sounds/v1/crowds/applause.ogg',
  cheer:   'https://actions.google.com/sounds/v1/crowds/cheering.ogg',
  aww:     'https://actions.google.com/sounds/v1/cartoon/sad_trombone.ogg',
  drum:    'https://actions.google.com/sounds/v1/percussion/snare_drum_roll.ogg',
  airhorn: 'https://actions.google.com/sounds/v1/sports/sport_horn.ogg',
  tada:    'https://actions.google.com/sounds/v1/cartoon/big_finish_with_brass.ogg',
  // No "boo" file ships in the public Google catalogue; the closest match
  // is the men-groaning recording. If you have a real boo recording, drop
  // the URL in here.
  boo:     'https://actions.google.com/sounds/v1/human_voices/crowd_of_men_groaning.ogg',
};

// Cache an Audio element per id so repeated plays don't re-download. We
// remember whether a URL has fallen back so we don't spam the network.
const _audioCache  = new Map();
const _failedUrls  = new Set();
const _activePlays = new Map(); // id -> Audio element currently playing

function tryPlayRealSound(soundId) {
  const url = REAL_SOUND_URLS[soundId];
  if (!url || _failedUrls.has(url) || typeof Audio === 'undefined') return false;

  // Stop any previous play of the same effect so they don't overlap.
  const prev = _activePlays.get(soundId);
  if (prev) { try { prev.pause(); prev.currentTime = 0; } catch (_) {} }

  let audio = _audioCache.get(soundId);
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    audio.volume = 0.7;
    audio.addEventListener('error', () => {
      // Mark URL as bad so future plays go straight to synth
      _failedUrls.add(url);
      _audioCache.delete(soundId);
      // No await available here; just fire-and-forget the synth as a recovery
      try { playSynth(soundId); } catch (_) {}
    });
    _audioCache.set(soundId, audio);
  }

  try {
    audio.currentTime = 0;
  } catch (_) {}
  const p = audio.play();
  _activePlays.set(soundId, audio);
  if (p && typeof p.catch === 'function') {
    p.catch(() => {
      _failedUrls.add(url);
      _audioCache.delete(soundId);
      try { playSynth(soundId); } catch (_) {}
    });
  }
  return true;
}

// ── Web-Audio synth fallback ─────────────────────────────────────────────────
//
// Design notes for "realistic" effects without samples:
//   • Crowds (cheer, clap, boo) layer many short sources at random offsets so the
//     ear hears it as many people, not a single oscillator.
//   • Voiced sounds (laugh, boo, cheer) feed white noise through narrow
//     band-pass filters tuned to vocal formant frequencies — that's what gives
//     them an "ahh"-ish character instead of a sweep tone.
//   • Percussive sounds use noise bursts with exponential decay envelopes.

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

// ── Primitive helpers ────────────────────────────────────────────────────────

// Single tone with linear attack + exponential decay envelope.
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

// White-noise burst with optional band-pass shaping.
function noise(ctx, startOffset, duration, filterFreq = 0, vol = 0.3, q = 1) {
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
    f.Q.value = q;
    src.connect(f);
    node = f;
  }
  node.connect(g).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

// Sustained band-passed brown-noise layer with attack/sustain/release envelope.
// This is the trick that turns plain noise into something that sounds like a
// crowd "aaah" instead of a hiss.
function vowelLayer(ctx, formantHz, startOffset, duration, peakVol = 0.18, q = 6) {
  const t0  = ctx.currentTime + startOffset;
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // Brown noise — smoother spectrum, more "voice-like" than white.
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    data[i] = last * 3.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = formantHz;
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peakVol,         t0 + 0.15);
  g.gain.linearRampToValueAtTime(peakVol * 0.7,   t0 + duration * 0.7);
  g.gain.linearRampToValueAtTime(0,               t0 + duration);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

// One percussive transient (handclap, drum hit, etc.).
function percussiveHit(ctx, startOffset, duration, filterFreq, vol) {
  const t0 = ctx.currentTime + startOffset;
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // Decaying noise — the exponential drop makes it sound like a transient strike.
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / len * 4);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filterFreq;
  f.Q.value = 1.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

// ── Effect catalogue ─────────────────────────────────────────────────────────

export function playSoundEffect(soundId) {
  // Prefer the real recording. The synth path is only used if the URL fails
  // to load/decode (logged once per URL) or the browser lacks Audio support.
  if (tryPlayRealSound(soundId)) return;
  playSynth(soundId);
}

function playSynth(soundId) {
  const ctx = getCtx();
  if (!ctx) return;

  switch (soundId) {

    // "Ha-ha-ha-ha" — voiced fricative bursts on rising/falling pitch.
    case 'laugh': {
      const t0 = ctx.currentTime;
      const syllables = [0, 0.13, 0.26, 0.39, 0.52, 0.65];
      syllables.forEach((t, i) => {
        const pitch = 380 + (i % 2) * 90 + (Math.random() * 40 - 20);
        // Breath component (the "h" of "ha")
        noise(ctx, t, 0.06, pitch * 1.4, 0.18, 8);
        // Voiced component (the "a" vowel)
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(pitch, t0 + t + 0.02);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0 + t + 0.02);
        g.gain.linearRampToValueAtTime(0.18, t0 + t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + t + 0.11);
        o.connect(g).connect(ctx.destination);
        o.start(t0 + t + 0.02);
        o.stop(t0 + t + 0.13);
      });
      break;
    }

    // Real applause = many small handclap transients overlapping.
    case 'clap': {
      const dur = 1.4;
      // ~50 randomly-placed claps for "many people clapping" texture
      for (let i = 0; i < 55; i++) {
        const t       = Math.random() * dur;
        const length  = 0.035 + Math.random() * 0.03;
        const fcenter = 1400 + Math.random() * 1400;
        const vol     = 0.10 + Math.random() * 0.18;
        percussiveHit(ctx, t, length, fcenter, vol);
      }
      break;
    }

    // Crowd cheer — noise layered at vocal-formant frequencies (the "ahhhh"
    // sound of a crowd) plus a foreground "wooo" tone with vibrato.
    case 'cheer': {
      const dur = 1.8;
      // Three formant bands give it a vowel-like character ("ahh").
      vowelLayer(ctx,  700, 0,    dur,        0.20, 6);
      vowelLayer(ctx, 1200, 0,    dur,        0.16, 6);
      vowelLayer(ctx, 2500, 0,    dur,        0.12, 7);
      // A few short percussive whistles/whoops to suggest individual people
      [0.2, 0.55, 1.0, 1.3].forEach(t => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        const f0 = 700 + Math.random() * 300;
        o.frequency.setValueAtTime(f0, ctx.currentTime + t);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.6, ctx.currentTime + t + 0.18);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime + t);
        g.gain.linearRampToValueAtTime(0.07, ctx.currentTime + t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.20);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.22);
      });
      // Foreground rising "wooo" with vibrato — the loud individual cheerer
      const t0   = ctx.currentTime;
      const osc  = ctx.createOscillator();
      const lfo  = ctx.createOscillator();
      const lfoG = ctx.createGain();
      const oG   = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(330, t0);
      osc.frequency.linearRampToValueAtTime(560, t0 + 0.6);
      osc.frequency.linearRampToValueAtTime(440, t0 + 1.3);
      lfo.type = 'sine';
      lfo.frequency.value = 5.5;
      lfoG.gain.value = 22;
      lfo.connect(lfoG).connect(osc.frequency);
      oG.gain.setValueAtTime(0, t0);
      oG.gain.linearRampToValueAtTime(0.10, t0 + 0.15);
      oG.gain.linearRampToValueAtTime(0.06, t0 + 1.1);
      oG.gain.linearRampToValueAtTime(0,    t0 + 1.5);
      osc.connect(oG).connect(ctx.destination);
      osc.start(t0); lfo.start(t0);
      osc.stop(t0 + 1.5); lfo.stop(t0 + 1.5);
      break;
    }

    // Long "awww" — descending sine through "uh→ah" formants.
    case 'aww': {
      const dur = 0.95;
      // Voiced layer (vowel-y noise) for breathiness
      vowelLayer(ctx, 600, 0, dur, 0.10, 5);
      // Glide tone — pitch droops down like a sympathetic sigh
      glide(ctx, 480, 220, 0, dur, 'sine', 0.30);
      // Tiny vibrato shimmer
      const t0  = ctx.currentTime;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 8;
      // (vibrato on its own is redundant since glide already uses frequency
      //  ramping; just stop the LFO to free the voice)
      lfo.connect(lfoG);
      lfo.start(t0); lfo.stop(t0 + 0.05);
      break;
    }

    // Drum roll — many fast tom-style hits crescendoing into a final crash.
    case 'drum': {
      const t0 = ctx.currentTime;
      const rolls = 28;
      for (let i = 0; i < rolls; i++) {
        const t      = i * 0.045;
        const vol    = 0.12 + (i / rolls) * 0.30;   // crescendo
        const fStart = 160 + Math.random() * 30;
        // Pitched thump
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(fStart, t0 + t);
        o.frequency.exponentialRampToValueAtTime(50, t0 + t + 0.07);
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t0 + t);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + t + 0.07);
        o.connect(g).connect(ctx.destination);
        o.start(t0 + t);
        o.stop(t0 + t + 0.08);
        // Snap component
        percussiveHit(ctx, t, 0.04, 4000, 0.12);
      }
      // Cymbal crash at the end
      noise(ctx, rolls * 0.045, 0.6, 0, 0.35);
      break;
    }

    // Air horn — two parallel low square tones with an initial noise blast.
    case 'airhorn': {
      const t0 = ctx.currentTime;
      // Initial blast — the puff before the horn locks in
      noise(ctx, 0, 0.05, 0, 0.4);
      // Two square tones detuned a perfect fourth apart for the horn body
      [196, 261].forEach(freq => {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(freq, t0);
        // Slight pitch droop to mimic the air pressure tail
        o.frequency.linearRampToValueAtTime(freq * 0.94, t0 + 0.7);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.28, t0 + 0.03);
        g.gain.linearRampToValueAtTime(0.25, t0 + 0.55);
        g.gain.linearRampToValueAtTime(0,    t0 + 0.72);
        o.connect(g).connect(ctx.destination);
        o.start(t0);
        o.stop(t0 + 0.72);
      });
      break;
    }

    // Tada! — Three-note ascending fanfare (C5 → E5 → G5).
    case 'tada': {
      tone(ctx, 523, 0,    0.18, 'triangle', 0.30);
      tone(ctx, 659, 0.18, 0.18, 'triangle', 0.30);
      tone(ctx, 784, 0.36, 0.45, 'triangle', 0.40);
      // Sparkle on the resolved chord
      [1046, 1318, 1568].forEach((f, i) => tone(ctx, f, 0.36 + i * 0.04, 0.4, 'sine', 0.10));
      break;
    }

    // Crowd boo — voiced "ooo" formants over a descending sawtooth tone.
    case 'boo': {
      const dur = 1.05;
      // Layer "oo"-style formants for the crowd backing
      vowelLayer(ctx, 350, 0, dur, 0.18, 7);
      vowelLayer(ctx, 700, 0, dur, 0.10, 7);
      // Foreground booing — descending dissonant saw
      glide(ctx, 230, 95, 0, 0.85, 'sawtooth', 0.28);
      // Slight detuned second voice for a "crowd" feel
      glide(ctx, 215, 88, 0.05, 0.85, 'sawtooth', 0.18);
      break;
    }

    default:
      // Unknown id — short blip so the host knows the click registered
      tone(ctx, 440, 0, 0.12, 'sine', 0.2);
  }
}

// Optional: prime the audio context on first user gesture so subsequent
// programmatic plays don't get blocked by autoplay policies.
export function primeAudio() { getCtx(); }
