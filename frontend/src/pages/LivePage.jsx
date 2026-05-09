import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import GiftPanel from '../components/GiftPanel';
import GiftEffect from '../components/GiftEffect';
import PKBattle from '../components/PKBattle';
import MultiSeatRoom from '../components/MultiSeatRoom';
import LiveModerationPanel from '../components/LiveModerationPanel';
import { playSoundEffect, primeAudio } from '../utils/soundEffects';
import { FiHeart, FiShare2, FiSend, FiUsers, FiChevronLeft, FiVolume2, FiVolumeX, FiPlay } from 'react-icons/fi';

const REACTIONS = ['❤️','😂','😮','🔥','👏','💯'];
const AVATAR_COLORS = ['from-pink-500 to-rose-600','from-purple-500 to-indigo-600','from-cyan-500 to-blue-600','from-green-500 to-emerald-600'];

export default function LivePage() {
  const { streamId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [showGifts, setShowGifts] = useState(false);
  const [currentEffect, setCurrentEffect] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isChatMuted, setIsChatMuted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [streamBackground, setStreamBackground] = useState('');
  const [roomMode, setRoomMode] = useState('solo'); // 'solo'|'audio'|'video'
  const [hostStream, setHostStream] = useState(null);
  // Always start muted. Browsers universally allow muted autoplay; unmuted
  // autoplay is blocked until the user gestures. Surface a "Tap for sound"
  // button while muted is true.
  const [muted, setMuted] = useState(true);
  // True when even muted autoplay was rejected (iOS Safari can do this on
  // cold-loaded pages). Shows a full-screen "Tap to play" overlay so the
  // user can recover with one tap.
  const [needsUserTap, setNeedsUserTap] = useState(false);
  const hostVideoRef = useRef(null);
  const chatRef = useRef(null);
  // Latest stream snapshot for use inside socket callbacks (which capture
  // stale state via closure since the listeners are registered on mount).
  const streamRef = useRef(null);
  // Guards against `stream_ended` firing more than once auto-navigating twice.
  const endedRef  = useRef(false);

  useEffect(() => {
    // Reset auto-navigate guard whenever the viewer lands on a new stream
    endedRef.current = false;
    api.get(`/streams/${streamId}`)
      .then(res => { setStream(res.data); setViewerCount(res.data.viewerCount || 0); })
      .catch(() => toast.error('Stream not found'))
      .finally(() => setLoading(false));
  }, [streamId]);

  // Keep the ref in sync so the socket-event closures see the latest stream
  useEffect(() => { streamRef.current = stream; }, [stream]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join_stream', { streamId });
    socket.on('chat_history', msgs => setMessages(msgs));
    socket.on('new_message', msg => setMessages(prev => [...prev.slice(-200), msg]));
    socket.on('viewer_count', ({ count }) => setViewerCount(count));
    socket.on('gift_received', (data) => {
      setCurrentEffect({ giftName: data.giftInfo?.giftType, giftEmoji: data.giftInfo?.giftEmoji, giftValue: data.giftInfo?.giftValue, giftRarity: data.giftInfo?.giftRarity, giftEffect: data.giftInfo?.giftEffect, giftColor: data.giftInfo?.giftColor, senderName: data.userId?.displayName || data.userId?.username });
    });
    socket.on('new_reaction', ({ reaction }) => {
      const id = Date.now() + Math.random();
      setReactions(prev => [...prev, { id, emoji: reaction, x: Math.random() * 80 + 10 }]);
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2500);
    });
    socket.on('stream_ended', async () => {
      if (endedRef.current) return;
      endedRef.current = true;
      toast('Stream has ended — finding the next one… 📺', { icon: '⏭️' });
      try {
        const params = { excludeStreamId: streamId };
        const cat = streamRef.current?.category;
        if (cat) params.currentCategory = cat;
        const res = await api.get('/streams/next-recommended', { params });
        const next   = res.data?.stream;
        const source = res.data?.source;
        if (next && next._id) {
          const name = next.streamerId?.displayName || next.streamerId?.username || 'next streamer';
          if (source === 'friend') {
            toast.success(`Joining ${name} — they're a friend who's live`);
          } else if (source === 'category') {
            toast.success(`Up next in ${next.category}: ${name}`);
          } else {
            toast.success(`Up next: ${name}`);
          }
          navigate(`/live/${next._id}`);
        } else {
          toast('No other live streams right now');
          navigate('/');
        }
      } catch {
        toast('No other live streams right now');
      }
    });
    socket.on('you_are_muted', ({ muted }) => { setIsChatMuted(muted); if (muted) toast('You have been muted by the host', { icon: '🔇' }); });
    socket.on('you_are_kicked', ({ blocked }) => { toast.error(blocked ? 'You have been blocked from this stream' : 'You have been removed from this stream'); navigate('/'); });
    socket.on('your_mod_state', ({ isAdmin: ia, isMuted }) => { setIsAdmin(ia); setIsChatMuted(isMuted); });
    socket.on('stream_background_changed', ({ backgroundImage }) => setStreamBackground(backgroundImage || ''));
    socket.on('play_sound', ({ soundId }) => {
      try { playSoundEffect(soundId); } catch (_) {}
    });
    socket.on('room_state', ({ mode }) => setRoomMode(mode));
    socket.on('room_mode_changed', ({ mode }) => setRoomMode(mode));
    return () => {
      socket.emit('leave_stream', { streamId });
      ['chat_history','new_message','viewer_count','gift_received','new_reaction','stream_ended','room_state','room_mode_changed','you_are_muted','you_are_kicked','your_mod_state','stream_background_changed','play_sound'].forEach(e => socket.off(e));
    };
  }, [socket, streamId]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // ── Solo-mode WebRTC: receive the host's video ─────────────────────────────
  // Works for both authenticated viewers AND guests since the relay events
  // don't require auth. ICE candidates that arrive before the offer has been
  // applied are buffered and drained once setRemoteDescription resolves.
  // Logs are prefixed `[lyvstream/viewer]` — open DevTools console to follow.
  useEffect(() => {
    if (!socket || !streamId || !stream || !stream.isLive) return;
    const log  = (...a) => console.log('[lyvstream/viewer]', ...a);
    const warn = (...a) => console.warn('[lyvstream/viewer]', ...a);

    let pc = null;
    let hostSocketId = null;
    let cancelled = false;
    let remoteSet = false;
    const pendingIce = [];
    // The set of remote tracks we've already attached so we never lose audio
    // when ontrack fires for video first then audio (or vice-versa) — some
    // unified-plan browsers don't share a `streams[0]` between them.
    let assembledStream = null;
    let retryTimer = null;
    const ICE_SERVERS = { iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]};

    const ensurePeer = () => {
      if (pc) return pc;
      try { pc = new RTCPeerConnection(ICE_SERVERS); }
      catch (e) { warn('RTCPeerConnection ctor failed:', e); pc = null; return null; }

      pc.ontrack = (e) => {
        if (cancelled) return;
        log('ontrack', e.track.kind, 'streams=', e.streams?.length || 0,
            'muted=', e.track.muted, 'readyState=', e.track.readyState);
        // ALWAYS build our own MediaStream from the individual tracks.
        // iOS Safari frequently populates `e.streams[0]` but then the video
        // element shows a black frame instead of decoding it — feeding it a
        // freshly-built stream side-steps that bug entirely.
        if (!assembledStream) assembledStream = new MediaStream();
        if (!assembledStream.getTracks().some(t => t.id === e.track.id)) {
          try { assembledStream.addTrack(e.track); } catch (_) {}
        }

        // iOS Safari sometimes delivers tracks in `muted: true` state and
        // emits an `unmute` event when frames actually start flowing — at
        // which point we must (re)kick play() or the video stays black.
        const onTrackUnmute = () => {
          log('track unmuted', e.track.kind);
          const v = hostVideoRef.current;
          if (!v) return;
          // Re-binding srcObject forces iOS to refresh its rendering pipeline
          if (v.srcObject !== assembledStream) v.srcObject = assembledStream;
          const p = v.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        };
        e.track.addEventListener('unmute', onTrackUnmute);
        e.track.addEventListener('ended',   () => log('track ended', e.track.kind));

        setHostStream(assembledStream);
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && hostSocketId) {
          socket.emit('solo_ice', { targetSocketId: hostSocketId, candidate: e.candidate });
        }
      };
      pc.oniceconnectionstatechange = () => log('ICE state:', pc.iceConnectionState);
      pc.onconnectionstatechange = () => {
        log('connection state:', pc.connectionState);
        if (['failed', 'closed'].includes(pc.connectionState)) {
          if (!cancelled) {
            setHostStream(null);
            assembledStream = null;
            remoteSet = false;
            // Try to re-establish — the host may still be there.
            socket.emit('solo_request_stream', { streamId });
          }
        }
      };
      return pc;
    };

    const onOffer = async ({ fromSocketId, offer }) => {
      if (cancelled) return;
      log('received offer from host', fromSocketId);
      hostSocketId = fromSocketId;
      const peer = ensurePeer();
      if (!peer) return;
      try {
        await peer.setRemoteDescription(offer);
        remoteSet = true;
        for (const cand of pendingIce) {
          try { await peer.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) {}
        }
        pendingIce.length = 0;
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        log('sending answer to host');
        socket.emit('solo_answer', { targetSocketId: fromSocketId, answer, streamId });
      } catch (e) { warn('handling offer failed:', e); }
    };

    const onIce = async ({ candidate }) => {
      if (!pc || !candidate) return;
      if (!remoteSet) { pendingIce.push(candidate); return; }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (e) { warn('addIceCandidate failed:', e); }
    };

    const onHostOffline = () => {
      warn('host_offline received');
      if (!cancelled) setHostStream(null);
    };

    socket.on('solo_offer',         onOffer);
    socket.on('solo_ice',           onIce);
    socket.on('solo_host_offline',  onHostOffline);

    // Keep asking every 3 s until an offer is applied. Covers fresh
    // navigations where the host's broadcaster was still spinning up,
    // socket reconnects, etc.
    const requestStream = () => {
      if (cancelled || remoteSet) return;
      log('requesting stream', streamId);
      socket.emit('solo_request_stream', { streamId });
      retryTimer = setTimeout(requestStream, 3000);
    };
    requestStream();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket.off('solo_offer',        onOffer);
      socket.off('solo_ice',          onIce);
      socket.off('solo_host_offline', onHostOffline);
      if (pc) { try { pc.close(); } catch (_) {} pc = null; }
      assembledStream = null;
      setHostStream(null);
    };
  }, [socket, streamId, stream?.isLive]);

  // Bind the received MediaStream to the visible <video> element.
  //
  // iOS Safari makes WebRTC video playback uniquely fragile:
  //   • `muted`, `autoplay`, `playsinline` must be set on the DOM element
  //     BEFORE srcObject is assigned, AND set as both PROPERTIES and
  //     ATTRIBUTES (the latter needed because some iOS builds ignore the
  //     prop until the attribute is present).
  //   • The video element must not be `opacity: 0` when srcObject is bound
  //     — iOS skips initialising compositor layers for transparent videos
  //     and the resulting layer never renders frames. The video is therefore
  //     ALWAYS visible; the placeholder sits on top and unmounts when a
  //     stream arrives.
  //   • `play()` can resolve without ever firing `playing` on iOS. We watch
  //     for `playing` and surface the Tap-to-play overlay if it doesn't
  //     fire within 4 s.
  //   • `play()` is also retried on `loadedmetadata` / `canplay` because the
  //     first synchronous call frequently rejects on iOS even when muted.
  useEffect(() => {
    const v = hostVideoRef.current;
    if (!v) return;
    if (!hostStream) {
      if (v.srcObject) v.srcObject = null;
      setNeedsUserTap(false);
      return;
    }

    // Properties (modern browsers honour these directly)
    v.muted = muted;
    v.playsInline = true;
    v.autoplay = true;
    v.controls = false;
    try { v.disablePictureInPicture = true; } catch (_) {}

    // Attributes (iOS Safari workaround — some builds need both)
    try {
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.setAttribute('x5-playsinline', '');
      v.setAttribute('autoplay', '');
      if (muted) v.setAttribute('muted', '');
      else       v.removeAttribute('muted');
    } catch (_) {}

    if (v.srcObject !== hostStream) v.srcObject = hostStream;

    let playingFired = false;
    const onPlaying = () => {
      playingFired = true;
      console.log('[lyvstream/viewer] playing event fired');
      setNeedsUserTap(false);
    };
    v.addEventListener('playing', onPlaying);

    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === 'function') {
        p.then(() => {
          // play() resolved — but `playing` may still not have fired on iOS.
          // The watchdog below handles that case.
        }).catch((e) => {
          console.warn('[lyvstream/viewer] play() rejected:', e?.name || e);
          setNeedsUserTap(true);
        });
      }
    };
    tryPlay();
    const onMeta = () => tryPlay();
    const onCan  = () => tryPlay();
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('canplay',        onCan);

    // iOS watchdog: if `playing` hasn't fired within 4 s, surface the
    // Tap-to-play overlay so the user can recover with a real gesture.
    const watchdog = setTimeout(() => {
      if (!playingFired && v.paused) {
        console.warn('[lyvstream/viewer] playing event did not fire within 4 s — showing tap overlay');
        setNeedsUserTap(true);
      }
    }, 4000);

    return () => {
      clearTimeout(watchdog);
      v.removeEventListener('playing',         onPlaying);
      v.removeEventListener('loadedmetadata',  onMeta);
      v.removeEventListener('canplay',         onCan);
    };
  }, [hostStream, muted]);

  const enableSound = () => {
    setMuted(false);
    setNeedsUserTap(false);
    const v = hostVideoRef.current;
    if (v) {
      v.muted = false;
      v.play().catch(() => {});
    }
  };

  // Called from the full-screen Tap-to-play overlay when even muted autoplay
  // was rejected. This is a real user gesture so play() will resolve.
  const tapToPlay = () => {
    setNeedsUserTap(false);
    const v = hostVideoRef.current;
    if (!v) return;
    v.muted = muted; // honour current mute preference
    v.play().catch((e) => console.warn('[lyvstream/viewer] manual play() failed:', e));
  };

  const sendMessage = (e) => {
    e?.preventDefault();
    if (!input.trim() || !user) { if (!user) toast.error('Sign in to chat'); return; }
    if (isChatMuted) { toast('You are muted in this stream', { icon: '🔇' }); return; }
    primeAudio();
    socket?.emit('send_message', { streamId, message: input.trim() });
    setInput('');
  };

  const sendReaction = (emoji) => {
    // Reactions are a user gesture — use it to unblock the audio context
    // so future broadcast sounds can actually play.
    primeAudio();
    socket?.emit('react', { streamId, reaction: emoji });
    const id = Date.now() + Math.random();
    setReactions(prev => [...prev, { id, emoji, x: Math.random() * 80 + 10 }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2500);
  };

  const handleFollow = async () => {
    if (!user || !stream) return;
    const res = await api.post(`/users/${stream.streamerId._id}/follow`);
    setIsFollowing(res.data.following);
    toast.success(res.data.message);
  };

  const shareStream = () => {
    navigator.share?.({ title: stream?.title, url: window.location.href }) ||
      navigator.clipboard.writeText(window.location.href).then(() => toast.success('Link copied!'));
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!stream) return (
    <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center gap-4">
      <p className="text-white/60">Stream not found</p>
      <Link to="/" className="btn-primary">Back Home</Link>
    </div>
  );

  const streamer = stream.streamerId || {};
  const isRoomMode = roomMode === 'audio' || roomMode === 'video';

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-black overflow-hidden relative">
      {/* Gift effect */}
      <AnimatePresence>{currentEffect && <GiftEffect gift={currentEffect} onDone={() => setCurrentEffect(null)} />}</AnimatePresence>

      {/* Floating reactions */}
      <div className="absolute right-20 bottom-24 pointer-events-none z-30 w-8">
        <AnimatePresence>
          {reactions.map(r => (
            <motion.div key={r.id} className="absolute text-2xl"
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: -200, opacity: 0 }}
              transition={{ duration: 2.5 }}>
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── VIDEO / ROOM AREA ── */}
      <div className="relative flex-1 bg-black flex flex-col min-h-0" style={streamBackground.startsWith('http') || streamBackground.startsWith('/') ? { backgroundImage: `url(${streamBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } : streamBackground ? { background: (() => { const g = { galaxy:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', sunset:'linear-gradient(135deg,#f83600,#f9d423)', ocean:'linear-gradient(135deg,#1a6dff,#0ad3ff)', rose:'linear-gradient(135deg,#f953c6,#b91d73)', forest:'linear-gradient(135deg,#134e5e,#71b280)', fire:'linear-gradient(135deg,#f12711,#f5af19)', purple:'linear-gradient(135deg,#6a0572,#c850c0)', space:'radial-gradient(ellipse at center,#1b2735 0%,#090a0f 100%)', aurora:'linear-gradient(180deg,#00c9ff,#92fe9d)', neon:'linear-gradient(135deg,#f72585,#4361ee)', gold:'linear-gradient(135deg,#f9d423,#f83600)' }; return g[streamBackground] || ''; })() } : {}}>
        {/* PK Battle */}
        <PKBattle streamId={streamId} currentStreamerId={streamer._id} />

        {/* Main display */}
        <div className="flex-1 relative min-h-0">
          {/* Background: stream placeholder or room wallpaper is handled inside MultiSeatRoom */}
          {!isRoomMode && (
            <>
              {/* Live video — ALWAYS rendered at full opacity so iOS Safari
                  initialises the compositor layer for it. While there's no
                  remote stream yet the placeholder below covers it; when
                  the placeholder unmounts the video is already running. */}
              <video
                ref={hostVideoRef}
                autoPlay playsInline
                muted={muted}
                onClick={muted ? enableSound : undefined}
                webkit-playsinline=""
                x5-playsinline=""
                className="absolute inset-0 w-full h-full object-cover bg-black z-10"
              />

              {/* Mobile fallback — full-screen tap target if even muted
                  autoplay was rejected. Covers the typical iOS Safari case
                  where the page loaded too cold for autoplay to fire. */}
              {hostStream && needsUserTap && (
                <button
                  onClick={tapToPlay}
                  className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer">
                  <div className="w-20 h-20 rounded-full bg-brand-500 flex items-center justify-center shadow-2xl animate-pulse">
                    <FiPlay className="text-white text-3xl ml-1" />
                  </div>
                  <p className="text-white text-sm mt-4 font-semibold">Tap to start watching</p>
                </button>
              )}
              {hostStream && !needsUserTap && muted && (
                <button
                  onClick={enableSound}
                  className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-semibold animate-pulse">
                  <FiVolume2 /> Tap for sound
                </button>
              )}

              {/* Placeholder layered ABOVE the video (z-20). When a remote
                  stream arrives this just unmounts and the already-running
                  video is revealed beneath. */}
              {!hostStream && (
                <div className={`absolute inset-0 z-20 flex items-center justify-center ${streamBackground ? 'bg-black/40 backdrop-blur-sm' : 'bg-gradient-to-br from-dark-800 to-black'}`}>
                  <div className="text-center px-4">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-4xl font-bold mx-auto mb-4 overflow-hidden ring-2 ring-white/20">
                      {streamer.avatar ? <img src={streamer.avatar} alt="" className="w-full h-full object-cover" /> : (streamer.displayName?.[0] || 'L').toUpperCase()}
                    </div>
                    <p className="text-white font-display text-xl font-bold drop-shadow-lg">{streamer.displayName || streamer.username}</p>
                    <p className="text-white/80 text-sm mt-1 drop-shadow">{stream.title}</p>
                    <p className="text-white/50 text-xs mt-3 drop-shadow flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" />
                      Connecting to live video…
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* MultiSeatRoom — shows audio/video room UI, also handles join requests */}
          <MultiSeatRoom
            streamId={streamId}
            isHost={false}
            hostUser={streamer}
            localStream={null}
            hostStream={null}
          />

          {/* Top bar — back button + viewer count, no LIVE indicator */}
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
            <button onClick={() => navigate(-1)} className="p-2 bg-black/50 rounded-full text-white pointer-events-auto hover:bg-black/70">
              <FiChevronLeft />
            </button>
            <div className="viewer-badge pointer-events-auto"><FiUsers className="text-xs" />{viewerCount.toLocaleString()}</div>
          </div>

          {/* Reaction buttons left */}
          <div className="absolute bottom-4 left-3 z-20 flex flex-col gap-2">
            {REACTIONS.map(emoji => (
              <button key={emoji} onClick={() => sendReaction(emoji)}
                className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full text-xl hover:scale-125 transition-transform active:scale-90">
                {emoji}
              </button>
            ))}
          </div>

          {/* Action buttons right */}
          <div className="absolute bottom-4 right-3 z-20 flex flex-col gap-3">
            <button onClick={handleFollow}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${isFollowing ? 'bg-brand-500 text-white' : 'bg-black/50 text-white hover:bg-brand-500/50'}`}>
              <FiHeart />
            </button>
            <button onClick={() => { if (!user) { toast.error('Sign in to send gifts'); return; } setShowGifts(true); }}
              className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center text-lg hover:bg-brand-500/50 transition-all">
              🎁
            </button>
            <button onClick={shareStream} className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center text-lg hover:bg-white/20 transition-all">
              <FiShare2 />
            </button>
          </div>
        </div>
      </div>

      {/* ── CHAT PANEL ── */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col bg-dark-900 border-l border-white/5 relative" style={{ height: 'calc(100vh - 4rem)' }}>
        {/* Streamer info */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <Link to={`/profile/${streamer.username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 overflow-hidden flex items-center justify-center font-bold">
              {streamer.avatar ? <img src={streamer.avatar} alt="" className="w-full h-full object-cover" /> : (streamer.displayName?.[0] || 'L').toUpperCase()}
            </div>
            <div>
              <p className="text-white text-sm font-semibold">{streamer.displayName || streamer.username}{streamer.isVerified && <span className="text-brand-400 ml-1">✓</span>}</p>
              <p className="text-white/40 text-xs">{(streamer.totalFollowers || 0).toLocaleString()} followers</p>
            </div>
          </Link>
          <button onClick={handleFollow}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${isFollowing ? 'bg-dark-600 text-white/60 hover:bg-red-500/20 hover:text-red-400' : 'bg-brand-500 text-white hover:bg-brand-600'}`}>
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        </div>

        {/* Admin moderation panel */}
        {isAdmin && (
          <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2 bg-brand-500/5">
            <span className="text-brand-400 text-xs font-bold flex items-center gap-1">🛡️ You are an admin</span>
            <div className="ml-auto">
              <LiveModerationPanel
                streamId={streamId}
                isHost={false}
                isAdmin={true}
                onBackgroundChange={(bg) => setStreamBackground(bg || '')}
              />
            </div>
          </div>
        )}

        {/* Room mode indicator */}
        {isRoomMode && (
          <div className="flex items-center gap-2 px-4 py-2 bg-brand-500/10 border-b border-brand-500/20 shrink-0">
            <span className="text-brand-400 text-sm">{roomMode === 'audio' ? '🎙️ Audio Room' : '📹 Video Room'}</span>
            <span className="text-white/40 text-xs">— tap a seat to join!</span>
          </div>
        )}

        {/* Messages — anchored to the bottom (just above the input) so the
            first message appears right next to the chat field, not at the
            top of the empty panel. */}
        <div ref={chatRef} className="flex-1 overflow-y-auto p-3 min-h-0">
          <div className="flex flex-col justify-end min-h-full space-y-2">
            {messages.length === 0 && (
              <div className="text-center py-4 text-white/30 text-sm"><p>Be the first to say hello! 👋</p></div>
            )}
            {messages.map((msg, i) => {
              const sender = msg.userId || {};
              const gradient = AVATAR_COLORS[i % AVATAR_COLORS.length];
              if (msg.type === 'gift') return (
                <motion.div key={msg._id || i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl ${msg.giftInfo?.giftRarity === 'legendary' ? 'legendary-glow' : msg.giftInfo?.giftRarity === 'epic' ? 'epic-glow' : 'bg-brand-500/10 border border-brand-500/20'}`}>
                  <span className="text-2xl">{msg.giftInfo?.giftEmoji || '🎁'}</span>
                  <div>
                    <p className="text-white text-xs font-semibold">{sender.displayName || sender.username}</p>
                    <p className="text-brand-300 text-xs">sent {msg.giftInfo?.giftType}</p>
                  </div>
                  {msg.giftInfo?.giftRarity !== 'common' && <span className={`ml-auto text-[10px] uppercase font-bold rarity-${msg.giftInfo?.giftRarity}`}>{msg.giftInfo?.giftRarity}</span>}
                </motion.div>
              );
              return (
                <div key={msg._id || i} className="flex items-start gap-2 chat-message">
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden`}>
                    {sender.avatar ? <img src={sender.avatar} alt="" className="w-full h-full object-cover" /> : (sender.displayName?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-brand-400 text-xs font-semibold">{sender.displayName || sender.username} </span>
                    <span className="text-white/80 text-xs break-words">{msg.message}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat input */}
        <div className="p-3 border-t border-white/10 shrink-0">
          {user ? (
            <form onSubmit={sendMessage} className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)} maxLength={300}
                placeholder={isChatMuted ? '🔇 You are muted' : 'Say something...'}
                className={`flex-1 bg-dark-700 border rounded-full px-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none transition-colors ${isChatMuted ? 'border-red-500/50 placeholder-red-400/50' : 'border-white/10 focus:border-brand-500'}`} />
              <button type="button" onClick={() => setShowGifts(true)} className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors">🎁</button>
              <button type="submit" disabled={!input.trim()} className="p-2.5 bg-brand-500 rounded-full text-white hover:bg-brand-600 disabled:opacity-40 transition-all">
                <FiSend className="text-sm" />
              </button>
            </form>
          ) : (
            <div className="text-center"><Link to="/login" className="btn-primary text-sm py-2 inline-block">Sign in to chat</Link></div>
          )}
        </div>

        {/* Gift panel */}
        <AnimatePresence>{showGifts && <GiftPanel streamId={streamId} onClose={() => setShowGifts(false)} />}</AnimatePresence>
      </div>
    </div>
  );
}
