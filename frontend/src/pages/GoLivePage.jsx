import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useLiveStream } from '../context/LiveStreamContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import HostMediaPanel from '../components/HostMediaPanel';
import PKBattle from '../components/PKBattle';
import PKInviteModal from '../components/PKInviteModal';
import GiftEffect from '../components/GiftEffect';
import MultiSeatRoom from '../components/MultiSeatRoom';
import LiveModerationPanel from '../components/LiveModerationPanel';
import {
  FiVideoOff, FiAlertCircle, FiUsers, FiClock,
  FiCrosshair, FiShare2, FiDollarSign, FiMinimize2, FiRotateCcw,
  FiRefreshCw
} from 'react-icons/fi';
import { BsCameraVideoFill } from 'react-icons/bs';

const CATEGORIES = ['Entertainment','Gaming','Music','Talk Show','Beauty','Fitness',
  'Cooking','Travel','Education','Sports','Comedy','Fashion'];

const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ── Earnings ticker ───────────────────────────────────────────────────────────
function EarningsTicker({ initialCoins }) {
  const { socket } = useSocket();
  const [coins, setCoins] = useState(initialCoins || 0);
  const COINS_PER = 210, NAIRA_PER = 1300;

  useEffect(() => {
    if (!socket) return;
    const refresh = () =>
      api.get('/withdrawals/eligibility').then(r => setCoins(r.data.coinsEarned)).catch(() => {});
    socket.on('gift_received', refresh);
    const id = setInterval(refresh, 15000);
    return () => { socket.off('gift_received', refresh); clearInterval(id); };
  }, [socket]);

  const naira = Math.floor((coins / COINS_PER) * NAIRA_PER);
  return (
    <div className="bg-gradient-to-r from-yellow-900/30 to-dark-800 border border-yellow-500/20 rounded-xl p-3 flex items-center gap-3">
      <span className="text-2xl">💰</span>
      <div className="flex-1 min-w-0">
        <p className="text-white/50 text-[10px] uppercase tracking-widest">Total Earnings</p>
        <p className="text-yellow-400 font-bold text-lg">{coins.toLocaleString()} 🪙</p>
        <p className="text-green-400 text-xs">≈ ₦{naira.toLocaleString()}</p>
      </div>
      <Link to="/withdraw" className="text-xs text-white/40 hover:text-white flex items-center gap-1 shrink-0">
        <FiDollarSign /> Withdraw
      </Link>
    </div>
  );
}

// ── Stream clock ──────────────────────────────────────────────────────────────
function StreamClock({ startedAt }) {
  const [t, setT] = useState('00:00');
  useEffect(() => {
    const tick = () => {
      const d = Date.now() - new Date(startedAt).getTime();
      const h = Math.floor(d / 3600000);
      const m = Math.floor((d % 3600000) / 60000);
      const s = Math.floor((d % 60000) / 1000);
      setT(h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span className="font-mono">{t}</span>;
}

// ── Camera error UI ───────────────────────────────────────────────────────────
function CameraErrorUI({ error, onRetry }) {
  const messages = {
    NotAllowedError:      { title: 'Camera permission denied', hint: 'Click the camera icon in your browser\'s address bar and allow access, then retry.' },
    PermissionDeniedError:{ title: 'Camera permission denied', hint: 'Allow camera access in your browser settings.' },
    NotFoundError:        { title: 'No camera found', hint: 'Make sure a webcam is connected and not disabled.' },
    NotReadableError:     { title: 'Camera is in use', hint: 'Another app may be using your camera. Close other tabs or apps and retry.' },
    OverconstrainedError: { title: 'Camera settings unsupported', hint: 'Retrying with basic settings...' },
    AbortError:           { title: 'Camera access aborted', hint: 'Please try again.' },
    default:              { title: 'Cannot access camera', hint: 'Check your device settings and make sure the camera is connected and enabled.' },
  };
  const { title, hint } = messages[error] || messages.default;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 p-6 text-center z-10 bg-dark-900">
      <FiAlertCircle className="text-5xl mb-3 text-yellow-400" />
      <p className="text-sm font-semibold text-white mb-1">{title}</p>
      <p className="text-white/40 text-xs max-w-xs leading-relaxed">{hint}</p>
      <button onClick={onRetry}
        className="mt-4 flex items-center gap-2 btn-ghost text-sm py-2 px-5">
        <FiRefreshCw size={14} /> Try Again
      </button>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function GoLivePage() {
  const { user }           = useAuth();
  const { socket }         = useSocket();
  const navigate           = useNavigate();
  const [searchParams]     = useSearchParams();
  const liveCtxRef         = useRef(null);            // stable ref to avoid stale closure
  const liveCtx            = useLiveStream();
  liveCtxRef.current       = liveCtx;                // always current

  const [step, setStep]                   = useState('setup');
  const [form, setForm]                   = useState({ title: '', description: '', category: 'Entertainment', tags: '' });
  const [stream, setStream]               = useState(null);
  const [loading, setLoading]             = useState(false);
  const [camOn, setCamOn]                 = useState(true);
  const [micOn, setMicOn]                 = useState(true);
  const [camError, setCamError]           = useState(null);  // null = ok, string = error name
  const [cameraReady, setCameraReady]     = useState(false);
  const [viewerCount, setViewerCount]     = useState(0);
  const [showPKModal, setShowPKModal]     = useState(false);
  const [currentEffect, setCurrentEffect] = useState(null);
  const [recentGifts, setRecentGifts]     = useState([]);
  const [facingMode, setFacingMode]       = useState('user');
  const [streamBackground, setStreamBackground] = useState('');

  const localStreamRef = useRef(null);
  const videoRef       = useRef(null);
  const heartbeatRef   = useRef(null);
  const mountedRef     = useRef(true);

  // ── Attach stream to a video element safely ───────────────────────────────
  const attachToVideo = useCallback((stream, el) => {
    try {
      const target = el || (videoRef && videoRef.current);
      if (!target || !stream) return;
      if (target.srcObject === stream) return;
      target.srcObject = stream;
      target.play().catch(() => {});
    } catch (_) {}
  }, []);

  // ── Core camera start — stable ref-based, never recreated ─────────────────
  const startCameraRef = useRef(null);
  const startCamera = useCallback(async (facing = 'user') => {
    if (!mountedRef.current) return null;

    // 1. Stop any existing tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setCamError(null);
    setCameraReady(false);

    // 2. Build a progressive list of constraint attempts
    const attemptList = IS_MOBILE
      ? [
          { video: { facingMode: facing },  audio: true  },
          { video: { facingMode: facing },  audio: false },
          { video: true,                    audio: true  },
          { video: true,                    audio: false },
        ]
      : [
          { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true  },
          { video: { width: { ideal: 640  }, height: { ideal: 480 } }, audio: true  },
          { video: true,                                                 audio: true  },
          { video: true,                                                 audio: false },
        ];

    let lastError = null;

    for (const constraints of attemptList) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return null; }

        // Guard: ref objects may be null if component unmounted between ticks
        if (localStreamRef && 'current' in localStreamRef) {
          localStreamRef.current = stream;
        }
        try {
          if (liveCtxRef.current && liveCtxRef.current.localStream && 'current' in liveCtxRef.current.localStream) {
            liveCtxRef.current.localStream.current = stream;
          }
        } catch (_) {}

        // Muted if audio track missing
        if (!stream.getAudioTracks().length) {
          setMicOn(false);
          toast('No microphone detected — audio disabled', { icon: '🔇', duration: 3000 });
        }

        setCamError(null);
        setCameraReady(true);

        // Attach to video after next paint — guard all refs
        const capturedStream = stream;
        requestAnimationFrame(() => {
          try {
            if (mountedRef && mountedRef.current) {
              attachToVideo(capturedStream);
            }
          } catch (_) {}
        });

        return stream;
      } catch (err) {
        lastError = err;
        // NotAllowedError = user denied — no point retrying other constraints
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') break;
      }
    }

    // All attempts failed
    if (mountedRef.current) {
      setCamError(lastError?.name || 'UnknownError');
      setCameraReady(false);
    }
    console.error('[Camera] All attempts failed:', lastError?.name, lastError?.message);
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = useCallback(() => {
    try {
      if (localStreamRef && localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => { try { t.stop(); } catch (_) {} });
        localStreamRef.current = null;
      }
      if (videoRef && videoRef.current) {
        videoRef.current.srcObject = null;
      }
    } catch (_) {}
    // Only call setState if still mounted
    if (mountedRef.current) setCameraReady(false);
  }, []);

  // ── Mount / restore ───────────────────────────────────────────────────────
  useEffect(() => {
    // Mark component as mounted — must be synchronous before any async
    mountedRef.current = true;
    const restoreId = searchParams.get('restore');

    if (restoreId && liveCtxRef.current?.activeStream?._id === restoreId) {
      const existing = liveCtxRef.current.localStream?.current;
      setStream(liveCtxRef.current.activeStream);
      setCamOn(liveCtxRef.current.camOn);
      setMicOn(liveCtxRef.current.micOn);
      setStep('live');
      liveCtxRef.current.restore();

      if (existing && existing.active) {
        try {
          if (localStreamRef && 'current' in localStreamRef) {
            localStreamRef.current = existing;
          }
        } catch (_) {}
        if (mountedRef.current) { setCameraReady(true); setCamError(null); }
        const capturedExisting = existing;
        requestAnimationFrame(() => {
          try {
            if (mountedRef && mountedRef.current) attachToVideo(capturedExisting);
          } catch (_) {}
        });
      } else {
        startCamera(facingMode);
      }
    } else {
      startCamera(facingMode);
    }

    return () => {
      mountedRef.current = false;
      // Don't null the refs here — just signal unmount
      // stopCamera is safe because it checks localStreamRef existence
      const isMinimized = liveCtxRef.current?.isMinimized;
      if (!isMinimized) {
        try { stopCamera(); } catch (_) {}
      }
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []); // eslint-disable-line

  // Re-attach when step changes (setup → live view renders new video element)
  useEffect(() => {
    const s = localStreamRef && localStreamRef.current;
    if (s && cameraReady) {
      const captured = s;
      requestAnimationFrame(() => {
        try {
          if (mountedRef && mountedRef.current) attachToVideo(captured);
        } catch (_) {}
      });
    }
  }, [step]); // eslint-disable-line

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !stream) return;
    const onVC      = ({ count }) => setViewerCount(count);
    const onGift    = (data) => {
      setCurrentEffect({
        giftName:   data.giftInfo?.giftType,
        giftEmoji:  data.giftInfo?.giftEmoji,
        giftValue:  data.giftInfo?.giftValue,
        giftRarity: data.giftInfo?.giftRarity,
        giftEffect: data.giftInfo?.giftEffect,
        giftColor:  data.giftInfo?.giftColor,
        senderName: data.userId?.displayName || data.userId?.username,
      });
      setRecentGifts(prev => [data, ...prev.slice(0, 9)]);
    };
    const onBg = ({ backgroundImage }) => setStreamBackground(backgroundImage || '');

    socket.on('viewer_count',            onVC);
    socket.on('gift_received',           onGift);
    socket.on('stream_background_changed', onBg);
    return () => {
      socket.off('viewer_count',            onVC);
      socket.off('gift_received',           onGift);
      socket.off('stream_background_changed', onBg);
    };
  }, [socket, stream]);

  // ── Heartbeat while live ──────────────────────────────────────────────────
  useEffect(() => {
    if (!stream?._id || !socket) return;
    // Send heartbeat every 30 seconds to prevent ghost stream cleanup
    heartbeatRef.current = setInterval(() => {
      socket.emit('host_heartbeat', { streamId: stream._id });
    }, 30000);
    socket.emit('host_heartbeat', { streamId: stream._id }); // immediate
    return () => clearInterval(heartbeatRef.current);
  }, [stream?._id, socket]);

  // ── Camera controls ───────────────────────────────────────────────────────
  const flipCamera = async () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    await startCamera(next);
  };

  const toggleCam = () => {
    const tracks = localStreamRef.current?.getVideoTracks() || [];
    tracks.forEach(t => { t.enabled = !t.enabled; });
    const next = !camOn;
    setCamOn(next);
    if (liveCtxRef.current) liveCtxRef.current.setCamOn(next);
    socket?.emit('host_media_state', { streamId: stream?._id, camOn: next, micOn });
  };

  const toggleMic = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    tracks.forEach(t => { t.enabled = !t.enabled; });
    const next = !micOn;
    setMicOn(next);
    if (liveCtxRef.current) liveCtxRef.current.setMicOn(next);
    socket?.emit('host_media_state', { streamId: stream?._id, camOn, micOn: next });
  };

  // ── Go Live ───────────────────────────────────────────────────────────────
  const handleGoLive = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Add a stream title'); return; }
    if (!cameraReady || !localStreamRef.current) {
      toast.error('Camera is not ready — please allow camera access and retry');
      return;
    }
    setLoading(true);
    try {
      // Single atomic call: ends any existing live sessions + creates + starts
      const res = await api.post('/streams/go-live', {
        title:       form.title.trim(),
        description: form.description,
        category:    form.category,
        tags:        form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });

      const newStream = { ...res.data, startedAt: res.data.startedAt || new Date() };

      // Notify socket layer
      socket?.emit('start_stream', { streamId: newStream._id });

      // Update state
      setStream(newStream);
      try {
        liveCtxRef.current?.startLiveSession(newStream, localStreamRef.current);
      } catch (_) {}

      setStep('live');

      // Attach camera after live view renders (double rAF ensures DOM is ready)
      const capturedForLive = localStreamRef.current;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            if (mountedRef && mountedRef.current && capturedForLive) {
              attachToVideo(capturedForLive);
            }
          } catch (_) {}
        });
      });

      toast.success('🔴 You are now LIVE!');
    } catch (err) {
      console.error('Go live error:', err);
      const msg = err.response?.data?.error || 'Failed to go live. Please try again.';
      toast.error(msg);
      // Do NOT navigate or change step — let user retry
    } finally {
      setLoading(false);
    }
  };

  const handleMinimize = () => {
    liveCtxRef.current?.minimize();
    liveCtxRef.current?.startLiveSession(stream, localStreamRef.current);
    navigate('/');
  };

  const handleEndStream = async () => {
    if (!window.confirm('End your stream?')) return;
    try {
      await api.post(`/streams/${stream._id}/end`);
      socket?.emit('end_stream', { streamId: stream._id });
      stopCamera();
      liveCtxRef.current?.endLiveSession();
      toast.success('Stream ended!');
      navigate('/host-dashboard');
    } catch {
      toast.error('Failed to end stream');
    }
  };

  const shareStream = () => {
    const url = `${window.location.origin}/live/${stream?._id}`;
    navigator.share?.({ title: stream?.title, url }) ||
      navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'));
  };

  // ── Background style helper ───────────────────────────────────────────────
  const getBgStyle = () => {
    if (!streamBackground) return {};
    if (streamBackground.startsWith('http') || streamBackground.startsWith('/')) {
      return { backgroundImage: `url(${streamBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    // Gradient presets
    const gradients = {
      galaxy:  'linear-gradient(135deg,#0f0c29,#302b63,#24243e)',
      sunset:  'linear-gradient(135deg,#f83600,#f9d423)',
      ocean:   'linear-gradient(135deg,#1a6dff,#0ad3ff)',
      rose:    'linear-gradient(135deg,#f953c6,#b91d73)',
      forest:  'linear-gradient(135deg,#134e5e,#71b280)',
      fire:    'linear-gradient(135deg,#f12711,#f5af19)',
      purple:  'linear-gradient(135deg,#6a0572,#c850c0)',
      space:   'radial-gradient(ellipse at center,#1b2735 0%,#090a0f 100%)',
      aurora:  'linear-gradient(180deg,#00c9ff,#92fe9d)',
      neon:    'linear-gradient(135deg,#f72585,#4361ee)',
      gold:    'linear-gradient(135deg,#f9d423,#f83600)',
    };
    return gradients[streamBackground] ? { background: gradients[streamBackground] } : {};
  };

  // ─── LIVE STAGE ───────────────────────────────────────────────────────────
  if (step === 'live' && stream) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-black relative overflow-hidden">
        <AnimatePresence>
          {currentEffect && <GiftEffect gift={currentEffect} onDone={() => setCurrentEffect(null)} />}
        </AnimatePresence>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Video */}
          <div className="relative flex-1 bg-black flex flex-col min-w-0">
            <PKBattle streamId={stream._id} currentStreamerId={user?._id || user?.id} />

            <div className="flex-1 relative min-h-0" style={getBgStyle()}>
              {/* Camera feed */}
              <video
                ref={videoRef}
                autoPlay muted playsInline
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300
                  ${facingMode === 'user' ? 'scale-x-[-1]' : ''}
                  ${camOn ? 'opacity-100' : 'opacity-0'}`}
              />
              {!camOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80 z-[1]">
                  <div className="text-center">
                    <FiVideoOff className="text-white/20 text-5xl mx-auto mb-2" />
                    <p className="text-white/30 text-sm">Camera off</p>
                  </div>
                </div>
              )}

              {/* Multi-seat room overlay */}
              <MultiSeatRoom
                streamId={stream._id} isHost={true}
                hostUser={user}
                localStream={localStreamRef.current}
                hostStream={localStreamRef.current}
              />

              {/* Top bar */}
              <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2">
                  <span className="live-badge">● LIVE</span>
                  <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 font-mono">
                    <FiClock className="text-[10px]" /><StreamClock startedAt={stream.startedAt} />
                  </span>
                </div>
                <div className="flex items-center gap-2 pointer-events-auto">
                  <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <FiUsers className="text-[10px]" />{viewerCount}
                  </span>
                  <button onClick={handleMinimize}
                    className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition-colors"
                    title="Minimize stream">
                    <FiMinimize2 className="text-sm" />
                  </button>
                </div>
              </div>

              {/* Recent gifts */}
              <div className="absolute left-3 bottom-20 space-y-1.5 pointer-events-none z-10">
                <AnimatePresence>
                  {recentGifts.slice(0, 3).map((g, i) => (
                    <motion.div key={g._id || i}
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5 text-xs text-white">
                      <span style={{ filter: g.giftInfo?.giftColor ? `drop-shadow(0 0 4px ${g.giftInfo.giftColor})` : undefined }}>
                        {g.giftInfo?.giftEmoji}
                      </span>
                      <span className="text-white/60">{g.userId?.displayName}</span>
                      <span className="text-yellow-400 font-semibold">{g.giftInfo?.giftType}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Bottom controls */}
            <div className="relative p-3 bg-dark-900/90 border-t border-white/5 z-20 flex items-center gap-2 flex-wrap">
              <HostMediaPanel
                streamId={stream._id}
                localStreamRef={localStreamRef}
                onStreamUpdated={(s) => { attachToVideo(s); }}
                camOn={camOn} micOn={micOn}
                onCamToggle={toggleCam} onMicToggle={toggleMic}
              />
              {IS_MOBILE && (
                <button onClick={flipCamera}
                  className="p-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-xl transition-all shrink-0"
                  title="Flip camera">
                  <FiRotateCcw className="text-lg" />
                </button>
              )}
              {/* Moderation panel button */}
              <div className="relative ml-auto">
                <LiveModerationPanel streamId={stream._id} isHost={true} isAdmin={false} />
              </div>
            </div>
          </div>

          {/* Right: Dashboard */}
          <div className="w-64 xl:w-72 bg-dark-900 border-l border-white/5 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <p className="text-white font-semibold text-sm truncate">{stream.title}</p>
              <p className="text-white/40 text-xs">{form.category}</p>
            </div>
            <div className="p-3 border-b border-white/10">
              <EarningsTicker initialCoins={user?.earningCoins || 0} />
            </div>
            <div className="p-3 grid grid-cols-2 gap-2 border-b border-white/10">
              <button onClick={() => setShowPKModal(true)}
                className="flex items-center justify-center gap-1.5 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 border border-brand-500/30 rounded-xl py-2.5 text-xs font-semibold">
                <FiCrosshair className="text-sm" /> PK Battle
              </button>
              <button onClick={shareStream}
                className="flex items-center justify-center gap-1.5 bg-dark-700 hover:bg-dark-600 text-white/70 rounded-xl py-2.5 text-xs font-semibold">
                <FiShare2 className="text-sm" /> Share
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Gifts Received</p>
              {recentGifts.length === 0
                ? <div className="text-center py-8 text-white/20">
                    <span className="text-3xl block mb-1">🎁</span>
                    <p className="text-xs">No gifts yet</p>
                  </div>
                : <div className="space-y-2">
                    {recentGifts.map((g, i) => (
                      <div key={g._id || i} className="flex items-center gap-2 bg-dark-800 rounded-xl px-3 py-2">
                        <span className="text-xl"
                          style={{ filter: g.giftInfo?.giftColor ? `drop-shadow(0 0 4px ${g.giftInfo.giftColor})` : undefined }}>
                          {g.giftInfo?.giftEmoji || '🎁'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium truncate">{g.userId?.displayName || 'Viewer'}</p>
                          <p className="text-white/40 text-[10px]">{g.giftInfo?.giftType}</p>
                        </div>
                        <p className="text-yellow-400 text-xs font-bold">+{g.giftInfo?.giftValue}🪙</p>
                      </div>
                    ))}
                  </div>}
            </div>

            <div className="p-3 border-t border-white/10 space-y-2">
              <button onClick={handleMinimize}
                className="w-full bg-dark-700 hover:bg-dark-600 text-white/70 font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                <FiMinimize2 /> Minimize
              </button>
              <button onClick={handleEndStream}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                ■ End Stream
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showPKModal && <PKInviteModal myStreamId={stream._id} onClose={() => setShowPKModal(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  // ─── SETUP ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-white mb-2 flex items-center gap-2">
        <BsCameraVideoFill className="text-brand-400" /> Go Live
      </h1>
      <p className="text-white/40 text-sm mb-6">Every minute counts toward your 30h monthly requirement!</p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Camera preview */}
        <div className="glass-card overflow-visible">
          <div className="relative bg-black aspect-video rounded-t-2xl overflow-hidden">
            {camError && <CameraErrorUI error={camError} onRetry={() => startCamera(facingMode)} />}
            <video
              ref={videoRef}
              autoPlay muted playsInline
              className={`w-full h-full object-cover
                ${facingMode === 'user' ? 'scale-x-[-1]' : ''}
                ${camError ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            />
            {!camError && !cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-dark-900">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-white/40 text-xs">Starting camera...</p>
                </div>
              </div>
            )}
            {IS_MOBILE && !camError && cameraReady && (
              <button onClick={flipCamera}
                className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors z-10">
                <FiRotateCcw className="text-lg" />
              </button>
            )}
          </div>
          <div className="relative p-4">
            <HostMediaPanel
              streamId={null}
              localStreamRef={localStreamRef}
              onStreamUpdated={(s) => { attachToVideo(s); setCameraReady(!!s); }}
              camOn={camOn} micOn={micOn}
              onCamToggle={toggleCam} onMicToggle={toggleMic}
            />
          </div>
        </div>

        {/* Form */}
        <div className="glass-card p-6">
          <form onSubmit={handleGoLive} className="space-y-4">
            <div>
              <label className="text-white/70 text-sm mb-1.5 block">Stream Title *</label>
              <input type="text" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="What are you streaming?" maxLength={100} required
                className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 transition-colors" />
            </div>
            <div>
              <label className="text-white/70 text-sm mb-1.5 block">Category</label>
              <select value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 appearance-none">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/70 text-sm mb-1.5 block">Description</label>
              <textarea value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={3} maxLength={300} placeholder="Tell viewers what you're about..."
                className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 resize-none" />
            </div>
            <div>
              <label className="text-white/70 text-sm mb-1.5 block">Tags</label>
              <input type="text" value={form.tags}
                onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                placeholder="music, afrobeats (comma separated)"
                className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500" />
            </div>
            <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3 flex items-start gap-3">
              <FiClock className="text-brand-400 mt-0.5 shrink-0" />
              <p className="text-white/60 text-xs">Stream <span className="text-brand-400 font-semibold">30+ hours/month</span> to unlock withdrawals.</p>
            </div>

            {/* Camera status indicator */}
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${cameraReady ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
              <span className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
              {cameraReady ? 'Camera ready' : camError ? 'Camera unavailable' : 'Starting camera…'}
            </div>

            <button type="submit" disabled={loading || !cameraReady}
              className="w-full py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-xl hover:from-red-400 hover:to-red-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><span className="w-2 h-2 bg-white rounded-full animate-pulse" /> Go Live Now</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
