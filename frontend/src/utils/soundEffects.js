// Sound playback for the moderation soundboard.
//
// Resolution chain for each effect id:
//   1. /sounds/<id>.mp3   — bundled with the frontend (`frontend/public/sounds/`)
//                          USER-OVERRIDABLE: drop your own MP3 in there and it
//                          will be used in preference to anything else. This is
//                          the recommended way to ensure you hear EXACTLY the
//                          recording you want.
//   2. /sounds/<id>.ogg   — same idea, .ogg variant
//   3. Hosted fallback URLs (Google Actions sound library) — public hot-link
//                          friendly recordings. Used only if no local file is
//                          present.
//   4. In-browser synth   — last-resort so a click is never silent.
//
// See `frontend/public/sounds/README.md` for download links you can use.

const LOCAL_BASE = '/sounds';

// Hosted fallbacks — used only if `/sounds/<id>.{mp3,ogg}` 404s.
const HOSTED_URLS = {
  laugh:   'https://actions.google.com/sounds/v1/human_voices/woman_laughing.ogg',
  clap:    'https://actions.google.com/sounds/v1/crowds/applause.ogg',
  cheer:   'https://actions.google.com/sounds/v1/crowds/cheering.ogg',
  aww:     'https://actions.google.com/sounds/v1/cartoon/sad_trombone.ogg',
  drum:    'https://actions.google.com/sounds/v1/percussion/snare_drum_roll.ogg',
  airhorn: 'https://actions.google.com/sounds/v1/sports/sport_horn.ogg',
  tada:    'https://actions.google.com/sounds/v1/cartoon/big_finish_with_brass.ogg',
  boo:     'https://actions.google.com/sounds/v1/human_voices/crowd_of_men_groaning.ogg',
};

function urlChainFor(soundId) {
  const chain = [
    `${LOCAL_BASE}/${soundId}.mp3`,
    `${LOCAL_BASE}/${soundId}.ogg`,
  ];
  if (HOSTED_URLS[soundId]) chain.push(HOSTED_URLS[soundId]);
  return chain;
}

// Per-effect: cache the FIRST URL in the chain that successfully decoded so
// subsequent plays go straight to it (no re-probing the network).
const _resolvedUrl = new Map(); // soundId  -> good url
const _audioCache  = new Map(); // soundId  -> Audio element bound to good url
const _failedUrls  = new Set(); // url      -> known to fail
const _activePlays = new Map(); // soundId  -> currently-playing Audio

// Fire-and-forget: try each url until one starts playing. If all fail, run
// the synth fallback.
function tryPlayRealSound(soundId) {
  if (typeof Audio === 'undefined') return false;
  const chain = urlChainFor(soundId);

  // Stop any previous play of the same effect so they don't overlap.
  const prev = _activePlays.get(soundId);
  if (prev) { try { prev.pause(); prev.currentTime = 0; } catch (_) {} }

  // Fast path: we've already proven a URL works for this id.
  const good = _resolvedUrl.get(soundId);
  if (good) {
    let audio = _audioCache.get(soundId);
    if (!audio) {
      audio = new Audio(good);
      audio.volume = 0.7;
      _audioCache.set(soundId, audio);
    }
    try { audio.currentTime = 0; } catch (_) {}
    _activePlays.set(soundId, audio);
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // The previously-good URL stopped working — invalidate and retry.
        _resolvedUrl.delete(soundId);
        _audioCache.delete(soundId);
        _failedUrls.add(good);
        tryPlayRealSound(soundId);
      });
    }
    return true;
  }

  // Cold path: probe each URL in order until one plays.
  let triggered = false;
  const tryNext = (i) => {
    if (triggered) return;
    if (i >= chain.length) {
      try { playSynth(soundId); } catch (_) {}
      return;
    }
    const url = chain[i];
    if (_failedUrls.has(url)) { tryNext(i + 1); return; }

    const audio = new Audio();
    audio.volume = 0.7;
    audio.preload = 'auto';
    let settled = false;
    const onError = () => {
      if (settled) return;
      settled = true;
      _failedUrls.add(url);
      tryNext(i + 1);
    };
    const onCanPlay = () => {
      if (settled) return;
      settled = true;
      _resolvedUrl.set(soundId, url);
      _audioCache.set(soundId, audio);
      _activePlays.set(soundId, audio);
      triggered = true;
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // play() rejected (probably autoplay) — leave the URL marked good
          // so future user-gesture clicks succeed without reprobing.
        });
      }
    };
    audio.addEventListener('error',         onError,    { once: true });
    audio.addEventListener('stalled',       onError,    { once: true });
    audio.addEventListener('canplaythrough', onCanPlay, { once: true });
    audio.src = url;
    audio.load();

    // Network safety net — don't wait forever for a slow URL.
    setTimeout(() => { if (!settled) onError(); }, 4000);
  };
  tryNext(0);
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

    // "Ha-ha-ha-ha" — short formant-filtered noise pulses. Two band-passes
    // tuned to typical vocal formants (~700 Hz F1, ~1500 Hz F2) make it
    // sound like an "ah" vowel rather than a tone.
    case 'laugh': {
      const syllables = [0, 0.13, 0.26, 0.39, 0.52, 0.65];
      syllables.forEach((t, i) => {
        const f1 = 650 + (i % 2) * 150 + (Math.random() * 80 - 40);
        const f2 = 1500 + (i % 2) * 200 + (Math.random() * 100 - 50);
        // Two formant taps + a higher fricative tap = vowel "a" + breath "h"
        noise(ctx, t,        0.10, f1,        0.22, 10);
        noise(ctx, t + 0.005, 0.09, f2,       0.14, 10);
        noise(ctx, t,         0.06, f1 * 3.5, 0.06, 6);
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

    // Crowd cheer — purely noise-based. Multiple voiced (vowel-formant)
    // noise layers + scattered shorter "whoop" formant pulses to suggest
    // individual voices. NO oscillator tones — keeps it from sounding tonal.
    case 'cheer': {
      const dur = 2.0;
      // Sustained crowd "ahhh" — three formants of an open vowel.
      vowelLayer(ctx,  700, 0,    dur, 0.22, 6);
      vowelLayer(ctx, 1100, 0,    dur, 0.18, 6);
      vowelLayer(ctx, 2400, 0,    dur, 0.14, 7);
      // Slight high-formant shimmer for "energy"
      vowelLayer(ctx, 3500, 0.2,  dur - 0.4, 0.08, 9);
      // Scattered short whoops at random offsets — each is a fast formant
      // sweep of noise (no oscillator), giving the impression of individual
      // people yelling within the crowd.
      const whoops = 8 + Math.floor(Math.random() * 4);
      for (let k = 0; k < whoops; k++) {
        const t  = 0.1 + Math.random() * (dur - 0.4);
        const f0 = 600 + Math.random() * 400;
        const t0 = ctx.currentTime + t;
        const len = 0.18 + Math.random() * 0.12;
        const buflen = Math.max(1, Math.floor(ctx.sampleRate * len));
        const buf = ctx.createBuffer(1, buflen, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < buflen; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 9;
        filter.frequency.setValueAtTime(f0, t0);
        filter.frequency.exponentialRampToValueAtTime(f0 * 1.6, t0 + len);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.10, t0 + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
        src.connect(filter).connect(g).connect(ctx.destination);
        src.start(t0);
        src.stop(t0 + len);
      }
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

    // Crowd boo — purely noise-based. Low "oo" formants are what make a
    // crowd boo recognisable; we layer several at slightly different
    // frequencies to suggest many voices and avoid any tonal character.
    case 'boo': {
      const dur = 1.2;
      vowelLayer(ctx, 280, 0,    dur, 0.22, 8);
      vowelLayer(ctx, 380, 0.05, dur - 0.05, 0.18, 7);
      vowelLayer(ctx, 700, 0,    dur, 0.12, 8);
      // Slight pitch-droop: a second pass at lower formants starting halfway
      // through gives the recognisable "boooo→o" tail.
      vowelLayer(ctx, 220, 0.5,  dur - 0.4, 0.16, 8);
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
