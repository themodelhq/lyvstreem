// Shared WebRTC ICE / RTC configuration.
//
// TURN credentials are fetched from the backend (`GET /api/rtc/credentials`),
// which mints short-lived ones from Cloudflare on demand using a server-side
// API token. The frontend never sees the secret token; it just receives the
// resulting `iceServers` array and uses it directly in RTCPeerConnection.
//
// Why TURN matters for iOS Safari: STUN alone gets a peer's reflexive (public
// NAT) IP, which works on most desktop home networks. iOS devices on
// symmetric NATs (most cellular and many WiFi networks) can't be reached via
// reflexive candidates — TURN relays the media through a public host that
// both peers can definitely reach.
//
// The first call kicks off the fetch and caches the result for the rest of
// the session; subsequent calls return the cached promise immediately.

import api from './api';

const STUN_FALLBACK = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

const RTC_OPTIONS = {
  // Multiplex audio + video on a single transport — fewer NAT bindings to
  // negotiate, more reliable on mobile.
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 4,
};

let _cache   = null; // RTCConfiguration once we have one
let _pending = null; // in-flight fetch promise

// Returns an RTCConfiguration with iceServers + bundle/mux options. Always
// resolves; if the backend can't be reached, falls back to STUN-only so basic
// same-network viewers still work.
export async function getIceConfig() {
  if (_cache) return _cache;
  if (_pending) return _pending;

  _pending = (async () => {
    let iceServers = STUN_FALLBACK;
    try {
      const res = await api.get('/rtc/credentials', { timeout: 10000, _noRetry: true });
      const fetched = res.data?.iceServers;
      if (Array.isArray(fetched) && fetched.length) {
        iceServers = fetched;
        // eslint-disable-next-line no-console
        console.log('[lyvstream/rtc] using ICE servers from', res.data?.source || 'backend',
                    '(', fetched.length, 'entries)');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[lyvstream/rtc] credentials fetch failed — falling back to STUN-only:', e?.message);
    }
    _cache = { iceServers, ...RTC_OPTIONS };
    return _cache;
  })();

  return _pending;
}

// Optional: kick off the fetch eagerly on app boot so by the time WebRTC
// actually needs the config it's already cached. Failures are swallowed —
// the lazy `getIceConfig()` path will retry on first peer-connection creation.
export function preloadIceConfig() {
  getIceConfig().catch(() => {});
}

// Force H.264 to the front of the video codec list when offered. iOS Safari
// has rock-solid hardware H.264 decode but flaky VP8/VP9 paths that can
// leave the viewer with a black frame even with the connection good. Call
// AFTER addTrack/addTransceiver and BEFORE createOffer/createAnswer.
export function preferH264Video(pc) {
  if (!pc || typeof pc.getTransceivers !== 'function') return;
  if (typeof RTCRtpSender === 'undefined' || typeof RTCRtpSender.getCapabilities !== 'function') return;
  try {
    const caps = RTCRtpSender.getCapabilities('video');
    if (!caps || !caps.codecs || !caps.codecs.length) return;
    const h264   = caps.codecs.filter(c => /H264/i.test(c.mimeType));
    const others = caps.codecs.filter(c => !/H264/i.test(c.mimeType));
    if (!h264.length) return;
    const ordered = [...h264, ...others];
    for (const t of pc.getTransceivers()) {
      if (t.sender && t.sender.track && t.sender.track.kind === 'video' && typeof t.setCodecPreferences === 'function') {
        try { t.setCodecPreferences(ordered); } catch (_) {}
      }
    }
  } catch (_) { /* setCodecPreferences not supported — skip */ }
}
