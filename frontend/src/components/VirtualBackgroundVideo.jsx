import React, { useEffect, useRef, useState } from 'react';

// Virtual background using MediaPipe Selfie Segmentation.
//
// The segmentation runs entirely in-browser. The model + WASM are loaded from
// jsdelivr the first time the component mounts; subsequent mounts within the
// session reuse the cached instance.
//
// We composite each frame as:
//   1. draw the segmentation mask
//   2. set composite=source-in, draw the camera frame  → person silhouette only
//   3. set composite=destination-over, draw the background → bg fills the rest
// The result is the chosen background behind the host, with their body in
// front. When the host walks out of frame the mask is empty and the bg
// covers the whole canvas.

const SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/selfie_segmentation.js';
const ASSET_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/';

// Preset gradients — must mirror the ones in BG_PRESETS in LiveModerationPanel.
const GRADIENT_PRESETS = {
  galaxy: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
  sunset: 'linear-gradient(135deg,#f83600,#f9d423)',
  ocean:  'linear-gradient(135deg,#1a6dff,#0ad3ff)',
  rose:   'linear-gradient(135deg,#f953c6,#b91d73)',
  forest: 'linear-gradient(135deg,#134e5e,#71b280)',
  fire:   'linear-gradient(135deg,#f12711,#f5af19)',
  purple: 'linear-gradient(135deg,#6a0572,#c850c0)',
  space:  'radial-gradient(ellipse at center,#1b2735 0%,#090a0f 100%)',
  aurora: 'linear-gradient(180deg,#00c9ff,#92fe9d)',
  neon:   'linear-gradient(135deg,#f72585,#4361ee)',
  gold:   'linear-gradient(135deg,#f9d423,#f83600)',
};

// ── Module-level singletons (load once per session) ─────────────────────────
let _scriptPromise = null;
let _segPromise    = null;

function loadMediaPipeScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.SelfieSegmentation) return Promise.resolve();
  if (_scriptPromise) return _scriptPromise;
  _scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload  = () => resolve();
    s.onerror = () => { _scriptPromise = null; reject(new Error('MediaPipe script failed to load')); };
    document.head.appendChild(s);
  });
  return _scriptPromise;
}

async function getSegmenter() {
  if (_segPromise) return _segPromise;
  _segPromise = (async () => {
    await loadMediaPipeScript();
    const seg = new window.SelfieSegmentation({
      locateFile: (file) => ASSET_BASE + file,
    });
    // modelSelection: 0 (256x256, faster, tighter on upper body) /
    //                 1 (256x144, landscape, full body)
    seg.setOptions({ modelSelection: 1, selfieMode: false });
    await seg.initialize();
    return seg;
  })();
  return _segPromise;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Render a CSS gradient string to an offscreen canvas so we can drawImage it
// later. Supports the simple linear-gradient and radial-gradient forms used by
// the moderation panel presets.
function renderGradientToCanvas(cssGradient, w = 1280, h = 720) {
  const c   = document.createElement('canvas');
  c.width   = w;
  c.height  = h;
  const ctx = c.getContext('2d');

  if (cssGradient.startsWith('linear-gradient')) {
    const m = cssGradient.match(/linear-gradient\(\s*(\d+)deg\s*,\s*(.+)\)\s*$/);
    if (m) {
      const angleDeg = parseInt(m[1], 10);
      const colors   = m[2].split(',').map(s => s.trim());
      // CSS angle 0deg → top, 90deg → right. canvas gradient goes from one point
      // to another; project the angle through the rectangle's centre.
      const rad = (angleDeg - 90) * Math.PI / 180;
      const cx = w / 2, cy = h / 2;
      const len = Math.max(w, h);
      const x1 = cx - Math.cos(rad) * len, y1 = cy - Math.sin(rad) * len;
      const x2 = cx + Math.cos(rad) * len, y2 = cy + Math.sin(rad) * len;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      colors.forEach((color, i) => grad.addColorStop(i / Math.max(1, colors.length - 1), color));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      return c;
    }
  }
  if (cssGradient.startsWith('radial-gradient')) {
    // Best-effort: pull the colour-stops, ignore the position spec, centre it.
    const colors = cssGradient
      .replace(/^radial-gradient\([^,]+,\s*/, '')
      .replace(/\)\s*$/, '')
      .split(',')
      .map(s => s.trim());
    const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) / 2);
    colors.forEach((cs, i) => {
      const m = cs.match(/^(.+?)(?:\s+(\d+)%)?$/);
      const color = m ? m[1] : cs;
      const pos   = m && m[2] !== undefined ? parseInt(m[2], 10) / 100 : i / Math.max(1, colors.length - 1);
      grad.addColorStop(Math.max(0, Math.min(1, pos)), color);
    });
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    return c;
  }
  // Plain colour fallback
  ctx.fillStyle = cssGradient || '#0a0a0f';
  ctx.fillRect(0, 0, w, h);
  return c;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function VirtualBackgroundVideo({
  stream,
  backgroundImage,
  mirror = false,
  className = '',
  style,
  onReady,
  onError,
}) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const bgRef     = useRef(null);   // HTMLImageElement | HTMLCanvasElement
  const animRef   = useRef(null);
  const segRef    = useRef(null);
  const [loadError, setLoadError] = useState(null);

  // ── Resolve the chosen background to an image-like source ──────────────────
  useEffect(() => {
    let cancelled = false;
    bgRef.current = null;
    if (!backgroundImage) return;
    (async () => {
      try {
        if (backgroundImage.startsWith('http') || backgroundImage.startsWith('/') || backgroundImage.startsWith('data:')) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload  = resolve;
            img.onerror = reject;
            img.src     = backgroundImage;
          });
          if (!cancelled) bgRef.current = img;
        } else if (GRADIENT_PRESETS[backgroundImage]) {
          if (!cancelled) bgRef.current = renderGradientToCanvas(GRADIENT_PRESETS[backgroundImage]);
        }
      } catch (_) {
        if (!cancelled) bgRef.current = null;
      }
    })();
    return () => { cancelled = true; };
  }, [backgroundImage]);

  // ── Bind incoming MediaStream to the hidden source <video> ────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.play().catch(() => {});
  }, [stream]);

  // ── Run segmentation + composite loop ─────────────────────────────────────
  useEffect(() => {
    if (!stream) return;
    let cancelled    = false;
    let firstFrame   = true;
    let processing   = false;

    (async () => {
      let seg;
      try {
        seg = await getSegmenter();
      } catch (e) {
        if (!cancelled) {
          setLoadError(e);
          if (typeof onError === 'function') onError(e);
        }
        return;
      }
      if (cancelled) return;
      segRef.current = seg;

      seg.onResults((results) => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        const v      = videoRef.current;
        if (!canvas || !v) return;

        const w = v.videoWidth  || canvas.width  || 640;
        const h = v.videoHeight || canvas.height || 480;
        if (canvas.width  !== w) canvas.width  = w;
        if (canvas.height !== h) canvas.height = h;

        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, w, h);

        // Mirror the foreground for selfie cameras (the bg stays unmirrored).
        if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }

        // 1. Mask (white where person, black where bg)
        ctx.drawImage(results.segmentationMask, 0, 0, w, h);
        // 2. Replace mask pixels with the camera frame → person cut-out
        ctx.globalCompositeOperation = 'source-in';
        ctx.drawImage(results.image, 0, 0, w, h);
        // 3. Reset transform so bg paints upright
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // 4. Paint bg behind everything that's still transparent
        ctx.globalCompositeOperation = 'destination-over';
        if (bgRef.current) {
          ctx.drawImage(bgRef.current, 0, 0, w, h);
        } else {
          ctx.fillStyle = '#0a0a0f';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.restore();

        if (firstFrame) {
          firstFrame = false;
          if (typeof onReady === 'function') onReady();
        }
      });

      const tick = async () => {
        if (cancelled) return;
        const v = videoRef.current;
        // readyState >= 2 == HAVE_CURRENT_DATA, enough to feed the model.
        if (!processing && v && v.readyState >= 2 && v.videoWidth > 0) {
          processing = true;
          try { await seg.send({ image: v }); } catch (_) {}
          processing = false;
        }
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, mirror]);

  // If MediaPipe failed to load, show nothing — the parent will fall back
  // to its default rendering.
  if (loadError) return null;

  return (
    <>
      {/* Hidden source video — feeds frames to the segmenter */}
      <video
        ref={videoRef}
        autoPlay muted playsInline
        style={{ display: 'none' }}
      />
      {/* Composited output */}
      <canvas
        ref={canvasRef}
        className={className}
        style={style}
      />
    </>
  );
}
