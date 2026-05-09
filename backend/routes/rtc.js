const router = require('express').Router();
const axios  = require('axios');

// ── Cloudflare WebRTC TURN credentials ──────────────────────────────────────
//
// Mints short-lived (default 24 h) TURN credentials from the Cloudflare API
// and returns them in RTCPeerConnection's `iceServers` shape. The frontend
// uses these directly when constructing peer connections.
//
// Required environment variables:
//   CLOUDFLARE_TURN_KEY_ID      Your TURN Token ID (NOT the secret)
//   CLOUDFLARE_TURN_API_TOKEN   The matching API token (keep secret — set
//                               this on Render's environment, not in code)
//
// The token is never exposed to the browser. The frontend hits
// `/api/rtc/credentials` and gets a fresh, short-lived username/credential
// pair on demand, with the secret staying server-side.
//
// We cache the response for ~23 h so we don't hammer Cloudflare on every
// peer connection.

const STUN_FALLBACK = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

const CACHE_TTL_MS = 23 * 60 * 60 * 1000; // 23 h
let _cache = null; // { at: timestamp, iceServers: [...] }

router.get('/credentials', async (req, res) => {
  // Serve from cache while it's still fresh
  if (_cache && (Date.now() - _cache.at) < CACHE_TTL_MS) {
    return res.json({ iceServers: _cache.iceServers, source: 'cache' });
  }

  const keyId    = process.env.CLOUDFLARE_TURN_KEY_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;

  if (!keyId || !apiToken) {
    // No TURN configured — fall back to STUN only.
    return res.json({ iceServers: STUN_FALLBACK, source: 'stun-fallback' });
  }

  try {
    const response = await axios.post(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate`,
      { ttl: 86400 },
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    // Cloudflare returns a SINGLE object for iceServers; RTCPeerConnection
    // wants an array. Wrap and prepend STUN as an additional fallback path.
    const cfIce = response.data?.iceServers;
    if (!cfIce) throw new Error('Cloudflare returned no iceServers');
    const iceServers = [
      ...STUN_FALLBACK.slice(0, 2),
      ...(Array.isArray(cfIce) ? cfIce : [cfIce]),
    ];

    _cache = { at: Date.now(), iceServers };
    res.json({ iceServers, source: 'cloudflare' });
  } catch (err) {
    console.error('Cloudflare TURN error:', err.response?.status, err.response?.data || err.message);
    // Don't fail the page — fall back to STUN so basic same-network viewers
    // still work.
    res.json({ iceServers: STUN_FALLBACK, source: 'stun-fallback-error' });
  }
});

module.exports = router;
