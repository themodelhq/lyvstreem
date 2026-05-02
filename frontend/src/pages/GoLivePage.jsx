import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import HostMediaPanel from '../components/HostMediaPanel';
import PKBattle from '../components/PKBattle';
import PKInviteModal from '../components/PKInviteModal';
import GiftPanel from '../components/GiftPanel';
import GiftEffect from '../components/GiftEffect';
import MultiSeatRoom from '../components/MultiSeatRoom';
import {
  FiVideo, FiVideoOff, FiMic, FiMicOff, FiUsers, FiAlertCircle,
  FiCrosshair, FiShare2, FiDollarSign, FiClock
} from 'react-icons/fi';
import { BsCameraVideoFill } from 'react-icons/bs';

const CATEGORIES = ['Entertainment','Gaming','Music','Talk Show','Beauty','Fitness','Cooking','Travel','Education','Sports','Comedy','Fashion'];

function EarningsTicker({ initialCoins }) {
  const { socket } = useSocket();
  const [coins, setCoins] = useState(initialCoins || 0);
  const COINS_PER = 210; const NAIRA_PER = 1300;
  useEffect(() => {
    if (!socket) return;
    socket.on('gift_received', () => {
      api.get('/withdrawals/eligibility').then(r => setCoins(r.data.coinsEarned)).catch(() => {});
    });
    return () => socket.off('gift_received');
  }, [socket]);
  useEffect(() => {
    const id = setInterval(() => {
      api.get('/withdrawals/eligibility').then(r => setCoins(r.data.coinsEarned)).catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, []);
  const naira = Math.floor((coins / COINS_PER) * NAIRA_PER);
  return (
    <div className="bg-gradient-to-r from-yellow-900/30 to-dark-800 border border-yellow-500/20 rounded-xl p-3 flex items-center gap-3">
      <span className="text-2xl">💰</span>
      <div className="flex-1">
        <p className="text-white/50 text-[10px] uppercase tracking-widest">Total Earnings</p>
        <p className="text-yellow-400 font-bold text-lg">{coins.toLocaleString()} 🪙</p>
        <p className="text-green-400 text-xs">≈ ₦{naira.toLocaleString()}</p>
      </div>
      <Link to="/withdraw" className="text-xs text-white/40 hover:text-white flex items-center gap-1"><FiDollarSign />Withdraw</Link>
    </div>
  );
}

function StreamClock({ startedAt }) {
  const [t, setT] = useState('00:00');
  useEffect(() => {
    const tick = () => {
      const d = Date.now() - new Date(startedAt).getTime();
      const h = Math.floor(d/3600000), m = Math.floor((d%3600000)/60000), s = Math.floor((d%60000)/1000);
      setT(h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick(); const id = setInterval(tick,1000); return () => clearInterval(id);
  }, [startedAt]);
  return <span className="font-mono">{t}</span>;
}

export default function GoLivePage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [step, setStep] = useState('setup');
  const [form, setForm] = useState({ title: '', description: '', category: 'Entertainment', tags: '' });
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [camError, setCamError] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [showPKModal, setShowPKModal] = useState(false);
  const [currentEffect, setCurrentEffect] = useState(null);
  const [recentGifts, setRecentGifts] = useState([]);
  const videoRef = useRef(null);

  useEffect(() => { startCamera(); return () => stopCamera(); }, []);
  useEffect(() => { if (videoRef.current && localStream) videoRef.current.srcObject = localStream; }, [localStream]);

  useEffect(() => {
    if (!socket || !stream) return;
    socket.on('viewer_count', ({ count }) => setViewerCount(count));
    socket.on('gift_received', (data) => {
      setCurrentEffect({ giftName: data.giftInfo?.giftType, giftEmoji: data.giftInfo?.giftEmoji, giftValue: data.giftInfo?.giftValue, giftRarity: data.giftInfo?.giftRarity, giftEffect: data.giftInfo?.giftEffect, senderName: data.userId?.displayName || data.userId?.username });
      setRecentGifts(prev => [data, ...prev.slice(0, 9)]);
    });
    return () => { socket.off('viewer_count'); socket.off('gift_received'); };
  }, [socket, stream]);

  const startCamera = async () => {
    try { const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); setLocalStream(s); setCamError(false); }
    catch { setCamError(true); }
  };
  const stopCamera = () => localStream?.getTracks().forEach(t => t.stop());
  const toggleCam = () => { localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; }); setCamOn(v => !v); };
  const toggleMic = () => { localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; }); setMicOn(v => !v); };

  const handleGoLive = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Add a stream title'); return; }
    setLoading(true);
    try {
      const res = await api.post('/streams/create', { title: form.title, description: form.description, category: form.category, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) });
      const newStream = res.data;
      await api.post(`/streams/${newStream._id}/start`);
      socket?.emit('start_stream', { streamId: newStream._id });
      setStream({ ...newStream, startedAt: new Date() });
      setStep('live');
      toast.success('🔴 You are now LIVE!');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to go live'); }
    finally { setLoading(false); }
  };

  const handleEndStream = async () => {
    if (!window.confirm('End your stream?')) return;
    try {
      await api.post(`/streams/${stream._id}/end`);
      socket?.emit('end_stream', { streamId: stream._id });
      stopCamera();
      toast.success('Stream ended!');
      navigate('/host-dashboard');
    } catch { toast.error('Failed to end stream'); }
  };

  const shareStream = () => {
    const url = `${window.location.origin}/live/${stream?._id}`;
    navigator.share?.({ title: stream?.title, url }) || navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'));
  };

  // ─── LIVE STAGE ──────────────────────────────────────────────────────────
  if (step === 'live' && stream) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-black relative overflow-hidden">
        <AnimatePresence>{currentEffect && <GiftEffect gift={currentEffect} onDone={() => setCurrentEffect(null)} />}</AnimatePresence>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Video + Room */}
          <div className="relative flex-1 bg-black flex flex-col min-w-0">
            {/* PK Battle */}
            <PKBattle streamId={stream._id} currentStreamerId={user?._id || user?.id} />

            {/* Camera + multi-seat room overlay */}
            <div className="flex-1 relative min-h-0">
              {/* Base camera video */}
              {!camOn ? (
                <div className="absolute inset-0 bg-dark-900 flex items-center justify-center text-white/30"><FiVideoOff className="text-5xl" /></div>
              ) : (
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              )}

              {/* Multi-seat room overlays on top of camera */}
              <MultiSeatRoom
                streamId={stream._id}
                isHost={true}
                hostUser={user}
                localStream={localStream}
                localVideoRef={videoRef}
                hostStream={localStream}
              />

              {/* Top overlays */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                <div className="flex items-center gap-2">
                  <span className="live-badge">● LIVE</span>
                  <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <FiClock className="text-[10px]" /><StreamClock startedAt={stream.startedAt} />
                  </span>
                </div>
                <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 pointer-events-auto">
                  <FiUsers className="text-[10px]" />{viewerCount}
                </span>
              </div>

              {/* Recent gifts ticker */}
              <div className="absolute left-3 bottom-20 space-y-1.5 pointer-events-none z-10">
                <AnimatePresence>
                  {recentGifts.slice(0, 3).map((g, i) => (
                    <motion.div key={g._id || i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5 text-xs text-white">
                      <span>{g.giftInfo?.giftEmoji}</span>
                      <span className="text-white/60">{g.userId?.displayName}</span>
                      <span className="text-yellow-400 font-semibold">{g.giftInfo?.giftType}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Host media controls */}
            <div className="relative p-3 bg-dark-900/90 border-t border-white/5 z-20">
              <HostMediaPanel streamId={stream._id} localStream={localStream} setLocalStream={setLocalStream}
                camOn={camOn} micOn={micOn} onCamToggle={toggleCam} onMicToggle={toggleMic} />
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
                <FiCrosshair className="text-sm"/> PK Battle
              </button>
              <button onClick={shareStream}
                className="flex items-center justify-center gap-1.5 bg-dark-700 hover:bg-dark-600 text-white/70 rounded-xl py-2.5 text-xs font-semibold">
                <FiShare2 className="text-sm"/> Share
              </button>
            </div>

            {/* Gifts received */}
            <div className="flex-1 overflow-y-auto p-3">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Gifts Received</p>
              {recentGifts.length === 0
                ? <div className="text-center py-8 text-white/20"><span className="text-3xl block mb-1">🎁</span><p className="text-xs">No gifts yet</p></div>
                : <div className="space-y-2">
                    {recentGifts.map((g, i) => (
                      <div key={g._id || i} className="flex items-center gap-2 bg-dark-800 rounded-xl px-3 py-2">
                        <span className="text-xl">{g.giftInfo?.giftEmoji || '🎁'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-medium truncate">{g.userId?.displayName || 'Viewer'}</p>
                          <p className="text-white/40 text-[10px]">{g.giftInfo?.giftType}</p>
                        </div>
                        <p className="text-yellow-400 text-xs font-bold">+{g.giftInfo?.giftValue}🪙</p>
                      </div>
                    ))}
                  </div>}
            </div>

            <div className="p-3 border-t border-white/10">
              <button onClick={handleEndStream} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                ■ End Stream
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>{showPKModal && <PKInviteModal myStreamId={stream._id} onClose={() => setShowPKModal(false)} />}</AnimatePresence>
      </div>
    );
  }

  // ─── SETUP ──────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-white mb-2 flex items-center gap-2"><BsCameraVideoFill className="text-brand-400" />Go Live</h1>
      <p className="text-white/40 text-sm mb-6">Every minute counts toward your 30h monthly streaming requirement!</p>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card overflow-visible">
          <div className="relative bg-black aspect-video rounded-t-2xl overflow-hidden">
            {camError
              ? <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 p-6 text-center"><FiAlertCircle className="text-4xl mb-3 text-yellow-400"/><p className="text-sm font-medium text-white">Camera access needed</p><button onClick={startCamera} className="btn-ghost text-sm mt-3 py-1.5">Try Again</button></div>
              : <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />}
          </div>
          <div className="relative p-4">
            <HostMediaPanel streamId={null} localStream={localStream} setLocalStream={setLocalStream} camOn={camOn} micOn={micOn} onCamToggle={toggleCam} onMicToggle={toggleMic} />
          </div>
        </div>
        <div className="glass-card p-6">
          <form onSubmit={handleGoLive} className="space-y-4">
            <div><label className="text-white/70 text-sm mb-1.5 block">Stream Title *</label>
              <input type="text" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="What are you streaming?" maxLength={100} required className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 transition-colors" /></div>
            <div><label className="text-white/70 text-sm mb-1.5 block">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))} className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 appearance-none">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-white/70 text-sm mb-1.5 block">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={3} maxLength={300} placeholder="Tell viewers what you're about..." className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500 resize-none" /></div>
            <div><label className="text-white/70 text-sm mb-1.5 block">Tags</label>
              <input type="text" value={form.tags} onChange={e => setForm(p => ({...p, tags: e.target.value}))} placeholder="music, afrobeats (comma separated)" className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand-500" /></div>
            <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3 flex items-start gap-3">
              <FiClock className="text-brand-400 mt-0.5 shrink-0" />
              <p className="text-white/60 text-xs">Stream <span className="text-brand-400 font-semibold">30+ hours/month</span> + meet coin minimum to unlock withdrawals.</p>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-xl hover:from-red-400 hover:to-red-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/30">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <><span className="w-2 h-2 bg-white rounded-full animate-pulse"/>Go Live Now</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
