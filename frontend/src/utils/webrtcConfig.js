// Shared WebRTC ICE / RTC configuration.
//
// Why TURN matters: STUN gives a peer's reflexive (public NAT) IP, which
// works for most desktop home networks. iOS devices on symmetric NATs (most
// cellular and many WiFi networks) can't be reached via reflexive candidates
// — TURN relays the media through a public host that both peers can
// definitely reach.
//
// The credentials below are Metered's free OpenRelay (rate-limited,
// best-effort). If you outgrow it, swap the TURN block for one of:
//   • Cloudflare WebRTC TURN (free tier with sign-up)
//   • Twilio Network Traversal Service
//   • Self-hosted coturn: https://github.com/coturn/coturn
// Replace the `urls`, `username`, and `credential` fields and you're done.

export const ICE_SERVERS = {
  iceServers: [
    // STUN — fast and free, used for the common direct-connection case.
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // TURN — relay fallback. Multiple URLs / transports increase the chance
    // one of them traverses whichever NAT/firewall the viewer is behind.
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turns:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  // Multiplex audio + video on a single transport — fewer NAT bindings to
  // negotiate, more reliable on mobile.
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 4,
};

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
