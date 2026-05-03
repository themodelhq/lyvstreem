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
import {
  FiVideoOff, FiAlertCircle, FiUsers, FiClock,
  FiCrosshair, FiShare2, FiDollarSign, FiMinimize2, FiRotateCcw
} from 'react-icons/fi';
import { BsCameraVideoFill } from 'react-icons/bs';

const CATEGORIES = ['Entertainment','Gaming','Music','Talk Show','Beauty','Fitness','Cooking','Travel','Education','Sports','Comedy','Fashion'];

// Detect mobile once at module level — stable, no re-render
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ── Earnings ticker ───────────────────────────────────────────────────────────
function EarningsTicker({ initialCoins }) {
  const { socket } = useSocket();
  const [coins, setCoins] = useState(initialCoins || 0);
  const COINS_PER = 210, NAIRA_PER = 1300;

  useEffect(() => {
    if (!socket) return;
    const refresh = () => api.get('/withdrawals/eligibility').then(r => setCoins(r.data.coinsEarned)).catch(() => {});
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

// ── Main Page ────────────────────────────────────────────────────────────────
export default function GoLivePage() {
  const { user }    = useAuth();
  const { socket }  = useSocket();
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();
  const liveCtx     = useLiveStream();

  const [step, setStep]             = useState('setup');
  const [form, setForm]             = useState({ title: '', description: '', category: 'Entertainment', tags: '' });
  const [stream, setStream]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [camOn, setCamOn]           = useState(true);
  const [micOn, setMicOn]           = useState(true);
  const [camError, setCamError]     = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [showPKModal, setShowPKModal] = useState(false);
  const [currentEffect, setCurrentEffect] = useState(null);
  const [recentGifts, setRecentGifts]     = useState([]);
  const [facingMode, setFacingMode] = useState('user');

  // Use a ref for the MediaStream so it never goes stale in callbacks
  const localStreamRef = useRef(null);
  const videoRef       = useRef(null);

  // ── Camera helpers ──────────────────────────────────────────────────────
  const attachToVideo = useCallback((stream) => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {}); // autoplay policy — safe to ignore
    }
  }, []);

  const startCamera = useCallback(async (facing = 'user') => {
    // Stop any existing tracks first
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    // Try with audio+video first; fall back to video-only if mic denied
    const tryGetMedia = async (withAudio) => {
      const constraints = {
        video: IS_MOBILE ? { facingMode: facing } : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: withAudio,
      };
      return navigator.mediaDevices.getUserMedia(constraints);
    };

    try {
      const stream = await tryGetMedia(true);
      localStreamRef.current = stream;
      if (liveCtx) liveCtx.localStream.current = stream;
      setCamError(false);
      attachToVideo(stream);
      return stream;
    } catch (err) {
      // If audio was denied but video might work, retry without mic
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        try {
          const stream = await tryGetMedia(false);
          localStreamRef.current = stream;
          if (liveCtx) liveCtx.localStream.current = stream;
          setCamError(false);
          setMicOn(false);
          attachToVideo(stream);
          toast('Microphone access denied — streaming without audio', { icon: '🔇' });
          return stream;
        } catch {
          setCamError(true);
          return null;
        }
      }
      setCamError(true);
      console.error('Camera error:', err.name, err.message);
      return null;
    }
  }, [attachToVideo, liveCtx]);

  const stopCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // ── On mount ────────────────────────────────────────────────────────────
  useEffect(() => {
    const restoreId = searchParams.get('restore');

    if (restoreId && liveCtx?.activeStream?._id === restoreId) {
      // Restoring from mini-player — reuse existing stream
      setStream(liveCtx.activeStream);
      setCamOn(liveCtx.camOn);
      setMicOn(liveCtx.micOn);
      setStep('live');
      liveCtx.restore();

      // Re-attach existing stream to video element
      const existing = liveCtx.localStream?.current;
      if (existing && existing.active) {
        localStreamRef.current = existing;
        // Attach after a tick so videoRef is rendered
        setTimeout(() => attachToVideo(existing), 50);
      } else {
        // Existing stream died — restart camera
        startCamera(facingMode);
      }
    } else {
      // Normal setup flow — start camera
      startCamera(facingMode);
    }

    // Cleanup on unmount (only if NOT minimized)
    return () => {
      if (!liveCtx?.isMinimized) {
        stopCamera();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-attach video whenever step changes (setup → live transition)
  useEffect(() => {
    if (localStreamRef.current) {
      setTimeout(() => attachToVideo(localStreamRef.current), 50);
    }
  }, [step, attachToVideo]);

  // ── Socket events ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !stream) return;
    const onViewerCount = ({ count }) => setViewerCount(count);
    const onGiftReceived = (data) => {
      setCurrentEffect({
        giftName: data.giftInfo?.giftType,
        giftEmoji: data.giftInfo?.giftEmoji,
        giftValue: data.giftInfo?.giftValue,
        giftRarity: data.giftInfo?.giftRarity,
        giftEffect: data.giftInfo?.giftEffect,
        giftColor: data.giftInfo?.giftColor,
        senderName: data.userId?.displayName || data.userId?.username,
      });
      setRecentGifts(prev => [data, ...prev.slice(0, 9)]);
    };
    socket.on('viewer_count', onViewerCount);
    socket.on('gift_received', onGiftReceived);
    return () => {
      socket.off('viewer_count', onViewerCount);
      socket.off('gift_received', onGiftReceived);
    };
  }, [socket, stream]);

  // ── Camera controls ──────────────────────────────────────────────────────
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
    if (liveCtx) liveCtx.setCamOn(next);
    socket?.emit('host_media_state', { streamId: stream?._id, camOn: next, micOn });
  };

  const toggleMic = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    tracks.forEach(t => { t.enabled = !t.enabled; });
    const next = !micOn;
    setMicOn(next);
    if (liveCtx) liveCtx.setMicOn(next);
    socket?.emit('host_media_state', { streamId: stream?._id, camOn, micOn: next });
  };

  // ── Go Live ──────────────────────────────────────────────────────────────
  const handleGoLive = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Add a stream title'); return; }
    if (!localStreamRef.current) {
      toast.error('Camera is not ready — please allow camera access');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/streams/create', {
        title: form.title, description: form.description,
        category: form.category,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      const newStream = { ...res.data, startedAt: new Date() };
      await api.post(`/streams/${newStream._id}/start`);
      socket?.emit('start_stream', { streamId: newStream._id });
      setStream(newStream);
      liveCtx?.startLiveSession(newStream, localStreamRef.current);
      setStep('live');
      // Re-attach after live view renders
      setTimeout(() => attachToVideo(localStreamRef.current), 100);
      toast.success('🔴 You are now LIVE!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to go live');
    } finally {
      setLoading(false);
    }
  };

  const handleMinimize = () => {
    liveCtx?.minimize();
    liveCtx?.startLiveSession(stream, localStreamRef.current);
    navigate('/');
  };

  const handleEndStream = async () => {
    if (!window.confirm('End your stream?')) return;
    try {
      await api.post(`/streams/${stream._id}/end`);
      socket?.emit('end_stream', { streamId: stream._id });
      stopCamera();
      liveCtx?.endLiveSession();
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

  // ─── LIVE STAGE ───────────────────────────────────────────────────────────
  if (step === 'live' && stream) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-black relative overflow-hidden">
        <AnimatePresence>
          {currentEffect && <GiftEffect gift={currentEffect} onDone={() => setCurrentEffect(null)} />}
        </AnimatePresence>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Camera + Room */}
          <div className="relative flex-1 bg-black flex flex-col min-w-0">
            <PKBattle streamId={stream._id} currentStreamerId={user?._id || user?.id} />

            <div className="flex-1 relative min-h-0">
              {/* Host self-view */}
              {!camOn ? (
                <div className="absolute inset-0 bg-dark-900 flex items-center justify-center">
                  <div className="text-center">
                    <FiVideoOff className="text-white/20 text-5xl mx-auto mb-2" />
                    <p className="text-white/30 text-sm">Camera off</p>
                  </div>
                </div>
              ) : null}
              <video
                ref={videoRef}
                autoPlay muted playsInline
                className={`absolute inset-0 w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''} ${!camOn ? 'opacity-0' : 'opacity-100'}`}
              />

              {/* Multi-seat room overlay */}
              <MultiSeatRoom
                streamId={stream._id}
                isHost={true}
                hostUser={user}
                localStream={localStreamRef.current}
                localVideoRef={videoRef}
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

              {/* Recent gifts ticker */}
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
            <div className="relative p-3 bg-dark-900/90 border-t border-white/5 z-20 flex items-center gap-3">
              <HostMediaPanel
                streamId={stream._id}
                localStreamRef={localStreamRef}
                onStreamUpdated={attachToVideo}
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
                ? <div className="text-center py-8 text-white/20"><span className="text-3xl block mb-1">🎁</span><p className="text-xs">No gifts yet</p></div>
                : <div className="space-y-2">
                    {recentGifts.map((g, i) => (
                      <div key={g._id || i} className="flex items-center gap-2 bg-dark-800 rounded-xl px-3 py-2">
                        <span className="text-xl" style={{ filter: g.giftInfo?.giftColor ? `drop-shadow(0 0 4px ${g.giftInfo.giftColor})` : undefined }}>
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
      <p className="text-white/40 text-sm mb-6">Every minute counts toward your 30h monthly streaming requirement!</p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Camera preview */}
        <div className="glass-card overflow-visible">
          <div className="relative bg-black aspect-video rounded-t-2xl overflow-hidden">
            {camError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 p-6 text-center z-10">
                <FiAlertCircle className="text-4xl mb-3 text-yellow-400" />
                <p className="text-sm font-medium text-white">Camera access needed</p>
                <p className="text-white/40 text-xs mt-1">Allow camera in your browser settings</p>
                <button onClick={() => startCamera(facingMode)}
                  className="btn-ghost text-sm mt-4 py-2 px-4">
                  Try Again
                </button>
              </div>
            ) : null}
            <video
              ref={videoRef}
              autoPlay muted playsInline
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''} ${camError ? 'opacity-0' : 'opacity-100'}`}
            />
            {/* Flip button overlay */}
            {IS_MOBILE && !camError && (
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
              onStreamUpdated={attachToVideo}
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
              <p className="text-white/60 text-xs">Stream <span className="text-brand-400 font-semibold">30+ hours/month</span> + meet coin minimum to unlock withdrawals.</p>
            </div>
            <button type="submit" disabled={loading || camError}
              className="w-full py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-xl hover:from-red-400 hover:to-red-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><span className="w-2 h-2 bg-white rounded-full animate-pulse" /> Go Live Now</>}
            </button>
            {camError && (
              <p className="text-red-400 text-xs text-center">⚠️ Camera access required to go live</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
