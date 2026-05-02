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
import { FiHeart, FiShare2, FiSend, FiUsers, FiChevronLeft } from 'react-icons/fi';

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
  const [roomMode, setRoomMode] = useState('solo'); // 'solo'|'audio'|'video'
  const chatRef = useRef(null);

  useEffect(() => {
    api.get(`/streams/${streamId}`)
      .then(res => { setStream(res.data); setViewerCount(res.data.viewerCount || 0); })
      .catch(() => toast.error('Stream not found'))
      .finally(() => setLoading(false));
  }, [streamId]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join_stream', { streamId });
    socket.on('chat_history', msgs => setMessages(msgs));
    socket.on('new_message', msg => setMessages(prev => [...prev.slice(-200), msg]));
    socket.on('viewer_count', ({ count }) => setViewerCount(count));
    socket.on('gift_received', (data) => {
      setCurrentEffect({ giftName: data.giftInfo?.giftType, giftEmoji: data.giftInfo?.giftEmoji, giftValue: data.giftInfo?.giftValue, giftRarity: data.giftInfo?.giftRarity, giftEffect: data.giftInfo?.giftEffect, senderName: data.userId?.displayName || data.userId?.username });
    });
    socket.on('new_reaction', ({ reaction }) => {
      const id = Date.now() + Math.random();
      setReactions(prev => [...prev, { id, emoji: reaction, x: Math.random() * 80 + 10 }]);
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2500);
    });
    socket.on('stream_ended', () => toast('Stream has ended 📺'));
    socket.on('room_state', ({ mode }) => setRoomMode(mode));
    socket.on('room_mode_changed', ({ mode }) => setRoomMode(mode));
    return () => {
      socket.emit('leave_stream', { streamId });
      ['chat_history','new_message','viewer_count','gift_received','new_reaction','stream_ended','room_state','room_mode_changed'].forEach(e => socket.off(e));
    };
  }, [socket, streamId]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = (e) => {
    e?.preventDefault();
    if (!input.trim() || !user) { if (!user) toast.error('Sign in to chat'); return; }
    socket?.emit('send_message', { streamId, message: input.trim() });
    setInput('');
  };

  const sendReaction = (emoji) => {
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
      <div className="relative flex-1 bg-black flex flex-col min-h-0">
        {/* PK Battle */}
        <PKBattle streamId={streamId} currentStreamerId={streamer._id} />

        {/* Main display */}
        <div className="flex-1 relative min-h-0">
          {/* Background: stream placeholder or room wallpaper is handled inside MultiSeatRoom */}
          {!isRoomMode && (
            <div className="absolute inset-0 bg-gradient-to-br from-dark-800 to-black flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-4xl font-bold mx-auto mb-4 overflow-hidden">
                  {streamer.avatar ? <img src={streamer.avatar} alt="" className="w-full h-full object-cover" /> : (streamer.displayName?.[0] || 'L').toUpperCase()}
                </div>
                <p className="text-white font-display text-xl font-bold">{streamer.displayName || streamer.username}</p>
                <p className="text-white/60 text-sm mt-1">{stream.title}</p>
                {stream.isLive && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <span className="live-badge">LIVE</span>
                    <span className="text-white/60 text-sm flex items-center gap-1"><FiUsers className="text-xs" />{viewerCount}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MultiSeatRoom — shows audio/video room UI, also handles join requests */}
          <MultiSeatRoom
            streamId={streamId}
            isHost={false}
            hostUser={streamer}
            localStream={null}
            hostStream={null}
          />

          {/* Top bar */}
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="p-2 bg-black/50 rounded-full text-white pointer-events-auto hover:bg-black/70">
                <FiChevronLeft />
              </button>
              {stream.isLive && <span className="live-badge">● LIVE</span>}
            </div>
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

        {/* Room mode indicator */}
        {isRoomMode && (
          <div className="flex items-center gap-2 px-4 py-2 bg-brand-500/10 border-b border-brand-500/20 shrink-0">
            <span className="text-brand-400 text-sm">{roomMode === 'audio' ? '🎙️ Audio Room' : '📹 Video Room'}</span>
            <span className="text-white/40 text-xs">— tap a seat to join!</span>
          </div>
        )}

        {/* Messages */}
        <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {messages.length === 0 && (
            <div className="text-center py-8 text-white/30 text-sm"><p>Be the first to say hello! 👋</p></div>
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

        {/* Chat input */}
        <div className="p-3 border-t border-white/10 shrink-0">
          {user ? (
            <form onSubmit={sendMessage} className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)} placeholder="Say something..." maxLength={300}
                className="flex-1 bg-dark-700 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500 transition-colors" />
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
