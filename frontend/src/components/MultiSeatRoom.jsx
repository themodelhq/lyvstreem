import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import useWebRTC from '../hooks/useWebRTC';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiLock, FiUnlock,
  FiUserX, FiVolume2, FiVolumeX, FiPlus, FiCheck, FiX,
  FiSettings, FiImage
} from 'react-icons/fi';

// ── Wallpapers ────────────────────────────────────────────────────────────────
const WALLPAPERS = [
  { id: 'none',     label: 'None',     style: { background: '#0a0a0f' } },
  { id: 'galaxy',   label: 'Galaxy',   style: { background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' } },
  { id: 'sunset',   label: 'Sunset',   style: { background: 'linear-gradient(135deg,#f83600,#f9d423)' } },
  { id: 'ocean',    label: 'Ocean',    style: { background: 'linear-gradient(135deg,#1a6dff,#0ad3ff)' } },
  { id: 'forest',   label: 'Forest',   style: { background: 'linear-gradient(135deg,#134e5e,#71b280)' } },
  { id: 'midnight', label: 'Midnight', style: { background: 'linear-gradient(135deg,#232526,#414345)' } },
  { id: 'aurora',   label: 'Aurora',   style: { background: 'linear-gradient(135deg,#00c9ff,#92fe9d)' } },
  { id: 'rose',     label: 'Rose',     style: { background: 'linear-gradient(135deg,#f953c6,#b91d73)' } },
  { id: 'fire',     label: 'Fire',     style: { background: 'linear-gradient(135deg,#f12711,#f5af19)' } },
  { id: 'purple',   label: 'Purple',   style: { background: 'linear-gradient(135deg,#6a0572,#c850c0)' } },
  { id: 'dark_red', label: 'Dark Red', style: { background: 'linear-gradient(135deg,#3d0000,#8b0000)' } },
  { id: 'space',    label: 'Space',    style: { background: 'radial-gradient(ellipse at center,#1b2735 0%,#090a0f 100%)' } },
];

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 'md', pulsing = false, muted = false }) {
  const sizes = { xs: 'w-8 h-8 text-xs', sm: 'w-10 h-10 text-sm', md: 'w-12 h-12 text-base', lg: 'w-16 h-16 text-xl', xl: 'w-20 h-20 text-2xl' };
  return (
    <div className={`relative inline-flex shrink-0 rounded-full ${pulsing ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-transparent' : ''}`}>
      <div className={`${sizes[size] || sizes.md} rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center font-bold text-white overflow-hidden`}>
        {user?.avatar
          ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
          : (user?.displayName?.[0] || user?.username?.[0] || '?').toUpperCase()}
      </div>
      {muted && (
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-red-500 border border-dark-900 rounded-full flex items-center justify-center">
          <FiMicOff className="text-white" style={{ fontSize: 8 }} />
        </span>
      )}
    </div>
  );
}

// ── Video tile ────────────────────────────────────────────────────────────────
function VideoTile({ stream, user, muted, isMuted, isHost, coinsGiven = 0 }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream]);
  return (
    <div className="relative w-full h-full bg-dark-800 rounded-xl overflow-hidden">
      {stream
        ? <video ref={ref} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center">
            <Avatar user={user} size="lg" muted={isMuted} />
          </div>}
      <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
        <span className="text-white text-[10px] font-medium truncate max-w-[80%]">
          {isHost && <span className="text-brand-400 font-bold mr-1 text-[9px]">Host</span>}
          {user?.displayName || user?.username || '—'}
        </span>
        <span className="text-yellow-400 text-[9px] shrink-0">🪙{coinsGiven}</span>
      </div>
      {isMuted && (
        <div className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5">
          <FiMicOff className="text-white" style={{ fontSize: 9 }} />
        </div>
      )}
    </div>
  );
}

// ── Seat context menu ─────────────────────────────────────────────────────────
function SeatMenu({ seat, seatIndex, streamId, onClose }) {
  const act = async (action) => {
    try {
      if (action === 'mute')  await api.post(`/rooms/${streamId}/seats/${seatIndex}/mute`, { muted: !seat.isMuted });
      if (action === 'drop')  await api.post(`/rooms/${streamId}/seats/${seatIndex}/drop`);
      if (action === 'lock')  await api.post(`/rooms/${streamId}/seats/${seatIndex}/lock`, { locked: !seat.isLocked });
      toast.success('Done');
    } catch { toast.error('Failed'); }
    onClose();
  };
  return (
    <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
      className="absolute z-[60] top-full mt-1 left-1/2 -translate-x-1/2 bg-dark-700 border border-white/10 rounded-xl shadow-2xl p-1 min-w-[130px]">
      {seat.userId && <>
        <button onClick={() => act('mute')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white hover:bg-white/10 rounded-lg">
          {seat.isMuted ? <FiVolume2 size={12}/> : <FiVolumeX size={12}/>} {seat.isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button onClick={() => act('drop')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg">
          <FiUserX size={12}/> Drop
        </button>
      </>}
      <button onClick={() => act('lock')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white hover:bg-white/10 rounded-lg">
        {seat.isLocked ? <FiUnlock size={12}/> : <FiLock size={12}/>} {seat.isLocked ? 'Unlock' : 'Lock'}
      </button>
    </motion.div>
  );
}

// ── Incoming seat requests banner (host) ──────────────────────────────────────
function RequestsBanner({ requests, onApprove, onDeny }) {
  if (!requests.length) return null;
  return (
    <div className="absolute top-2 right-2 z-40 space-y-2 max-w-[200px] pointer-events-auto">
      {requests.map((r, i) => (
        <motion.div key={r.socketId + i} initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className="bg-dark-800/95 backdrop-blur border border-white/10 rounded-xl p-3 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <Avatar user={r.user} size="xs" />
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{r.user?.displayName || r.user?.username}</p>
              <p className="text-white/40 text-[10px]">Seat #{r.seatIndex + 1}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onApprove(r)} className="flex-1 bg-green-500 hover:bg-green-600 text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1">
              <FiCheck size={10}/> Accept
            </button>
            <button onClick={() => onDeny(r)} className="flex-1 bg-dark-600 text-white/50 text-[10px] py-1.5 rounded-lg flex items-center justify-center gap-1">
              <FiX size={10}/> Deny
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Wallpaper picker ──────────────────────────────────────────────────────────
function WallpaperPicker({ current, onSelect, onClose }) {
  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute bottom-0 inset-x-0 z-50 bg-dark-800/98 backdrop-blur-xl border-t border-white/10 rounded-t-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm flex items-center gap-2"><FiImage size={14}/> Wallpaper</h3>
        <button onClick={onClose} className="text-white/40 hover:text-white p-1"><FiX size={16}/></button>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {WALLPAPERS.map(wp => (
          <button key={wp.id} onClick={() => { onSelect(wp.id); onClose(); }}
            className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${current === wp.id ? 'border-brand-400' : 'border-transparent'}`}
            style={wp.style}>
            <span className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[9px] font-bold">{wp.label}</span>
            {current === wp.id && <FiCheck className="absolute top-0.5 right-0.5 text-white bg-brand-500 rounded-full p-0.5" size={12}/>}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ── Mode picker ───────────────────────────────────────────────────────────────
function ModePicker({ onSelect, loading, onClose }) {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="absolute top-12 left-2 z-50 bg-dark-800/98 backdrop-blur border border-white/10 rounded-2xl p-3 shadow-2xl w-56">
      <div className="flex items-center justify-between mb-2">
        <p className="text-white text-sm font-semibold">Room Mode</p>
        <button onClick={onClose} className="text-white/40 hover:text-white"><FiX size={14}/></button>
      </div>
      {[
        { id: 'solo',  label: 'Solo Stream',  desc: 'Full screen only',     icon: '📺' },
        { id: 'audio', label: 'Audio Room',   desc: '12 voice seats',       icon: '🎙️' },
        { id: 'video', label: 'Video Room',   desc: '12 video seats',       icon: '📹' },
      ].map(m => (
        <button key={m.id} onClick={() => onSelect(m.id)} disabled={loading}
          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-dark-600 border border-transparent hover:border-brand-500/30 transition-all text-left mb-1 last:mb-0">
          <span className="text-xl shrink-0">{m.icon}</span>
          <div>
            <p className="text-white text-xs font-medium">{m.label}</p>
            <p className="text-white/40 text-[10px]">{m.desc}</p>
          </div>
        </button>
      ))}
    </motion.div>
  );
}

// ── Single Audio Seat ─────────────────────────────────────────────────────────
function AudioSeat({ seat, seatIndex, isHost, myUserId, onRequest, streamId, onMenuClose }) {
  const [showMenu, setShowMenu] = useState(false);
  const isOccupied = !!seat.userId;
  const isMe = seat.userId?.toString() === myUserId;

  return (
    <div className="flex flex-col items-center gap-1 relative" style={{ width: '100%' }}>
      <button
        className={`relative flex items-center justify-center rounded-full transition-all
          ${isMe ? 'ring-2 ring-brand-400 ring-offset-1 ring-offset-black/50' : ''}
          ${!isOccupied && !seat.isLocked ? 'hover:scale-105 active:scale-95 cursor-pointer' : ''}
          ${seat.isLocked ? 'cursor-not-allowed opacity-50' : ''}
        `}
        style={{ width: '100%', aspectRatio: '1' }}
        onClick={(e) => {
          e.stopPropagation();
          if (isHost && isOccupied) { setShowMenu(v => !v); return; }
          if (isHost && !isOccupied) { setShowMenu(v => !v); return; }
          if (!isHost && !isOccupied && !seat.isLocked) onRequest(seatIndex);
        }}
      >
        {isOccupied ? (
          <Avatar
            user={{ displayName: seat.displayName, username: seat.username, avatar: seat.avatar }}
            size="md"
            muted={seat.isMuted}
            pulsing={!seat.isMuted}
          />
        ) : seat.isLocked ? (
          <div className="w-full h-full rounded-full bg-dark-700/60 border border-white/10 flex items-center justify-center">
            <FiLock className="text-white/30" size={14} />
          </div>
        ) : (
          <div className="w-full h-full rounded-full bg-white/8 border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-0.5 hover:border-brand-400/50 hover:bg-brand-500/10 transition-all">
            <FiPlus className="text-white/40" size={14} />
          </div>
        )}
      </button>

      {/* Name + coins below avatar */}
      <p className="text-white/60 text-[9px] text-center truncate w-full leading-tight">
        {isOccupied
          ? (seat.displayName || seat.username || '').split(' ')[0].slice(0, 7)
          : seat.isLocked ? '🔒' : `${seatIndex + 1}`}
      </p>
      {isOccupied && (
        <p className="text-yellow-400/80 text-[8px] text-center">🪙{seat.coinsGiven || 0}</p>
      )}

      {/* Context menu */}
      <AnimatePresence>
        {showMenu && isHost && (
          <SeatMenu seat={seat} seatIndex={seatIndex} streamId={streamId} onClose={() => { setShowMenu(false); onMenuClose?.(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MultiSeatRoom({ streamId, isHost, hostUser, localStream, hostStream }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { peerStreams, createPeer, handleOffer, handleAnswer, handleIceCandidate, removePeer, cleanup } = useWebRTC({ socket, localStream });

  const [mode, setMode]             = useState('solo');
  const [seats, setSeats]           = useState([]);
  const [wallpaper, setWallpaper]   = useState('none');
  const [allMuted, setAllMuted]     = useState(false);
  const [mySeatIndex, setMySeatIndex] = useState(null);
  const [selfMuted, setSelfMuted]   = useState(false);
  const [selfVideoOn, setSelfVideoOn] = useState(true);
  const [requests, setRequests]     = useState([]);
  const [showWallpaper, setShowWallpaper] = useState(false);
  const [showModePanel, setShowModePanel] = useState(false);
  const [settingMode, setSettingMode] = useState(false);

  const myId = user?._id || user?.id;
  const wp = WALLPAPERS.find(w => w.id === wallpaper) || WALLPAPERS[0];

  // ── Socket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const onRoomState = ({ mode: m, seats: s, allMuted: am, wallpaper: w }) => {
      setMode(m); setSeats(s || []); setAllMuted(am); if (w) setWallpaper(w);
    };
    const onModeChanged = ({ mode: m, seats: s, wallpaper: w }) => {
      setMode(m); setSeats(s || []);
      if (w !== undefined) setWallpaper(w || 'none');
      setMySeatIndex(null);
    };
    socket.on('room_state', onRoomState);
    socket.on('room_mode_changed', onModeChanged);
    socket.on('room_wallpaper_changed', ({ wallpaper: w }) => setWallpaper(w || 'none'));
    socket.on('seat_updated', ({ seats: s, allMuted: am }) => { setSeats(s || []); if (am !== undefined) setAllMuted(am); });
    socket.on('room_seat_approved', ({ seatIndex, isMuted }) => {
      setMySeatIndex(seatIndex); setSelfMuted(isMuted || false);
      toast.success(`✅ You're in seat #${seatIndex + 1}!`);
      socket.emit('room_join_seat', { streamId, seatIndex });
    });
    socket.on('room_seat_denied', () => toast('❌ Request denied'));
    socket.on('room_seat_request_sent', ({ seatIndex }) => toast(`Request sent for seat #${seatIndex + 1}…`));
    socket.on('seat_dropped', ({ reason }) => {
      setMySeatIndex(null); cleanup();
      toast(reason === 'locked' ? '🔒 Seat locked' : '⚠️ Removed by host');
    });
    socket.on('room_seat_request', (r) => setRequests(prev => [...prev.filter(x => x.socketId !== r.socketId), r]));
    socket.on('room_new_peer', ({ peerId, peerUser, seatIndex, shouldInitiate }) => {
      if (shouldInitiate) createPeer(peerId, true, seatIndex, peerUser);
    });
    socket.on('room_peers_list', ({ peers }) => {
      peers.forEach(({ socketId, seatIndex, user: pu }) => createPeer(socketId, false, seatIndex, pu));
    });
    socket.on('room_peer_left', ({ peerId }) => removePeer(peerId));
    socket.on('rtc_offer', handleOffer);
    socket.on('rtc_answer', handleAnswer);
    socket.on('rtc_ice_candidate', handleIceCandidate);
    socket.on('host_mute_command', ({ muted }) => {
      setSelfMuted(muted);
      localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    });
    return () => {
      ['room_state','room_mode_changed','room_wallpaper_changed','seat_updated','room_seat_approved',
       'room_seat_denied','room_seat_request_sent','seat_dropped','room_seat_request','room_new_peer',
       'room_peers_list','room_peer_left','rtc_offer','rtc_answer','rtc_ice_candidate','host_mute_command'
      ].forEach(e => socket.off(e));
      // Tear down all peer connections so they don't leak when the user
      // navigates away from the live page.
      cleanup();
    };
  }, [socket, streamId, cleanup]);

  // ── Host actions ─────────────────────────────────────────────────────────
  const approveRequest = (r) => {
    socket?.emit('room_approve_seat', { streamId, seatIndex: r.seatIndex, targetSocketId: r.socketId, targetUserId: r.user.userId, targetUser: r.user });
    setRequests(prev => prev.filter(x => x.socketId !== r.socketId));
  };
  const denyRequest = (r) => {
    socket?.emit('room_deny_seat', { targetSocketId: r.socketId, seatIndex: r.seatIndex });
    setRequests(prev => prev.filter(x => x.socketId !== r.socketId));
  };

  const switchMode = async (newMode) => {
    setSettingMode(true);
    // Optimistic UI update — set mode immediately
    const maxSeats = newMode !== 'solo' ? 12 : 0;
    setMode(newMode);
    setSeats(newMode !== 'solo'
      ? Array.from({ length: maxSeats }, (_, i) => ({ seatIndex: i, isLocked: false, isMuted: false }))
      : []);
    setShowModePanel(false);
    try {
      await api.post(`/rooms/${streamId}/mode`, { mode: newMode });
      if (newMode !== 'solo') toast.success(`Switched to ${newMode} room`);
    } catch { toast.error('Failed to switch mode'); }
    setSettingMode(false);
  };

  const toggleMuteAll = async () => {
    try { await api.post(`/rooms/${streamId}/mute-all`, { muted: !allMuted }); }
    catch { toast.error('Failed'); }
  };

  const changeWallpaper = async (wpId) => {
    setWallpaper(wpId); // Optimistic
    try { await api.post(`/rooms/${streamId}/wallpaper`, { wallpaper: wpId }); }
    catch { toast.error('Failed to change wallpaper'); }
  };

  const requestSeat = (idx) => {
    if (!user) { toast.error('Sign in to join'); return; }
    if (mySeatIndex !== null) { toast('Leave your current seat first'); return; }
    socket?.emit('room_request_seat', { streamId, seatIndex: idx });
  };

  const leaveSeat = () => {
    if (mySeatIndex === null) return;
    socket?.emit('room_leave_seat', { streamId, seatIndex: mySeatIndex });
    setMySeatIndex(null); cleanup();
  };

  const toggleSelfMute = () => {
    if (seats[mySeatIndex]?.isMuted) return;
    const next = !selfMuted; setSelfMuted(next);
    localStream?.getAudioTracks().forEach(t => { t.enabled = !next; });
    socket?.emit('room_self_mute', { streamId, seatIndex: mySeatIndex, muted: next });
  };

  // ── Dismiss menus on outside click ──────────────────────────────────────
  useEffect(() => {
    const h = () => { setShowModePanel(false); setShowWallpaper(false); };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  // ── SOLO — host-only mode switcher ────────────────────────────────────────
  if (mode === 'solo') {
    if (!isHost) return null;
    return (
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto" onClick={e => e.stopPropagation()}>
        <button onClick={() => setShowModePanel(v => !v)}
          className="flex items-center gap-2 bg-black/60 backdrop-blur border border-white/20 rounded-full px-3 py-1.5 text-white text-xs font-semibold hover:bg-black/80 transition-all">
          <FiSettings size={12} className="text-brand-400" /> Room Mode
        </button>
        <AnimatePresence>
          {showModePanel && <ModePicker onSelect={switchMode} loading={settingMode} onClose={() => setShowModePanel(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  // ── AUDIO ROOM ────────────────────────────────────────────────────────────
  if (mode === 'audio') {
    return (
      <div className="absolute inset-0 flex flex-col z-10 pointer-events-auto" style={wp.style} onClick={() => { setShowModePanel(false); setShowWallpaper(false); }}>
        <div className="absolute inset-0 bg-black/40" />

        {/* Host requests */}
        {isHost && <RequestsBanner requests={requests} onApprove={approveRequest} onDeny={denyRequest} />}

        {/* Top toolbar */}
        {isHost && (
          <div className="relative z-20 flex items-center gap-1.5 px-3 pt-3 flex-wrap" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowModePanel(v => !v)}
              className="flex items-center gap-1 bg-black/50 backdrop-blur border border-white/15 rounded-full px-2.5 py-1 text-white text-[10px] hover:bg-black/70">
              <FiSettings size={10}/> Mode
            </button>
            <button onClick={() => setShowWallpaper(v => !v)}
              className="flex items-center gap-1 bg-black/50 backdrop-blur border border-white/15 rounded-full px-2.5 py-1 text-white text-[10px] hover:bg-black/70">
              <FiImage size={10}/> Wall
            </button>
            <button onClick={toggleMuteAll}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] border backdrop-blur ${allMuted ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-black/50 border-white/15 text-white'}`}>
              {allMuted ? <FiVolumeX size={10}/> : <FiVolume2 size={10}/>} {allMuted ? 'Unmute All' : 'Mute All'}
            </button>
            <AnimatePresence>
              {showModePanel && <ModePicker onSelect={switchMode} loading={settingMode} onClose={() => setShowModePanel(false)} />}
            </AnimatePresence>
          </div>
        )}

        {/* Host avatar */}
        <div className="relative z-10 flex flex-col items-center py-3">
          <Avatar user={hostUser || user} size="lg" pulsing />
          <div className="mt-1 bg-brand-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">Host</div>
          <p className="text-white text-xs font-semibold mt-1">{hostUser?.displayName || user?.displayName}</p>
        </div>

        {/* Seats grid — 2 rows × 6 cols, properly spaced */}
        <div className="relative z-10 flex-1 px-3 pb-2 flex flex-col gap-3">
          {[0, 1].map(row => (
            <div key={row} className="grid grid-cols-6 gap-x-2 gap-y-1" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
              {Array.from({ length: 6 }, (_, col) => {
                const idx = row * 6 + col;
                const seat = seats[idx] || { seatIndex: idx, isLocked: false, isMuted: false };
                return (
                  <AudioSeat
                    key={idx}
                    seat={seat}
                    seatIndex={idx}
                    isHost={isHost}
                    myUserId={myId}
                    onRequest={requestSeat}
                    streamId={streamId}
                    onMenuClose={() => {}}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* My seat controls */}
        {mySeatIndex !== null && (
          <div className="relative z-20 flex items-center justify-center gap-3 pb-3 pointer-events-auto">
            <button onClick={toggleSelfMute}
              className={`p-2.5 rounded-full ${selfMuted ? 'bg-red-500 text-white' : 'bg-black/50 text-white'}`}>
              {selfMuted ? <FiMicOff size={16}/> : <FiMic size={16}/>}
            </button>
            <button onClick={leaveSeat}
              className="bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-4 py-2 text-xs font-semibold">
              Leave Seat
            </button>
          </div>
        )}

        <AnimatePresence>
          {showWallpaper && <WallpaperPicker current={wallpaper} onSelect={changeWallpaper} onClose={() => setShowWallpaper(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  // ── VIDEO ROOM ────────────────────────────────────────────────────────────
  if (mode === 'video') {
    const occupied = seats.filter(s => !!s.userId);

    return (
      <div className="absolute inset-0 flex flex-col z-10 pointer-events-auto" style={wp.style} onClick={() => { setShowModePanel(false); setShowWallpaper(false); }}>
        <div className="absolute inset-0 bg-black/20" />

        {isHost && <RequestsBanner requests={requests} onApprove={approveRequest} onDeny={denyRequest} />}

        {/* Toolbar */}
        {isHost && (
          <div className="relative z-20 flex items-center gap-1.5 px-3 pt-2 flex-wrap" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowModePanel(v => !v)}
              className="flex items-center gap-1 bg-black/50 backdrop-blur border border-white/15 rounded-full px-2.5 py-1 text-white text-[10px]">
              <FiSettings size={10}/> Mode
            </button>
            <button onClick={() => setShowWallpaper(v => !v)}
              className="flex items-center gap-1 bg-black/50 backdrop-blur border border-white/15 rounded-full px-2.5 py-1 text-white text-[10px]">
              <FiImage size={10}/> Wall
            </button>
            <button onClick={toggleMuteAll}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] border backdrop-blur ${allMuted ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-black/50 border-white/15 text-white'}`}>
              {allMuted ? <FiVolumeX size={10}/> : <FiVolume2 size={10}/>} {allMuted ? 'Unmute All' : 'Mute All'}
            </button>
            <AnimatePresence>
              {showModePanel && <ModePicker onSelect={switchMode} loading={settingMode} onClose={() => setShowModePanel(false)} />}
            </AnimatePresence>
          </div>
        )}

        {/* Video layout */}
        <div className="relative z-10 flex-1 p-2 overflow-hidden min-h-0">
          <div className="h-full flex gap-2">
            {/* Host tile — left, larger */}
            <div className="flex-1 min-w-0 rounded-2xl overflow-hidden relative">
              <VideoTile stream={hostStream} user={hostUser || user} muted isHost coinsGiven={0} />
              <div className="absolute top-2 left-2 z-10">
                <span className="live-badge text-[10px]">LIVE</span>
              </div>
            </div>

            {/* Right column: guest seats */}
            <div className="w-28 sm:w-36 flex flex-col gap-1.5 overflow-y-auto">
              {seats.map((seat, idx) => {
                const isOccupied = !!seat.userId;
                const isMe = seat.userId?.toString() === myId;
                const peer = Object.values(peerStreams).find(p => p.seatIndex === idx);

                if (isOccupied) {
                  return (
                    <div key={idx} className="relative rounded-xl overflow-hidden flex-shrink-0"
                      style={{ height: 80 }}
                      onClick={(e) => { e.stopPropagation(); }}>
                      <VideoTile
                        stream={peer?.stream}
                        user={{ displayName: seat.displayName, username: seat.username, avatar: seat.avatar }}
                        muted={false} isMuted={seat.isMuted} isHost={false} coinsGiven={seat.coinsGiven || 0}
                      />
                      <span className="absolute top-1 left-1 text-[8px] bg-black/50 text-white px-1 rounded">#{idx + 1}</span>
                      {isMe && <div className="absolute inset-0 ring-2 ring-brand-400 rounded-xl pointer-events-none" />}
                      {isHost && (
                        <SeatMenuInline seat={seat} seatIndex={idx} streamId={streamId} />
                      )}
                    </div>
                  );
                }

                return (
                  <button key={idx}
                    className={`flex-shrink-0 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all
                      ${seat.isLocked ? 'border-white/10 bg-dark-700/40 cursor-not-allowed opacity-50' : 'border-dashed border-white/20 bg-white/5 hover:border-brand-400/50 hover:bg-brand-500/10 cursor-pointer'}`}
                    style={{ height: 80 }}
                    onClick={(e) => { e.stopPropagation(); if (!seat.isLocked && !isHost) requestSeat(idx); }}
                  >
                    {seat.isLocked
                      ? <><FiLock className="text-white/30" size={14}/><span className="text-white/30 text-[9px]">Locked</span></>
                      : <><FiPlus className="text-white/40" size={16}/><span className="text-white/40 text-[9px]">#{idx + 1} Join</span></>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* My seat controls */}
        {mySeatIndex !== null && (
          <div className="relative z-20 flex items-center justify-center gap-3 pb-3">
            <button onClick={toggleSelfMute}
              className={`p-2.5 rounded-full ${selfMuted ? 'bg-red-500 text-white' : 'bg-black/50 text-white'}`}>
              {selfMuted ? <FiMicOff size={16}/> : <FiMic size={16}/>}
            </button>
            <button onClick={() => {
              const next = !selfVideoOn; setSelfVideoOn(next);
              localStream?.getVideoTracks().forEach(t => { t.enabled = next; });
              socket?.emit('room_self_video', { streamId, seatIndex: mySeatIndex, videoOn: next });
            }} className={`p-2.5 rounded-full ${!selfVideoOn ? 'bg-red-500 text-white' : 'bg-black/50 text-white'}`}>
              {selfVideoOn ? <FiVideo size={16}/> : <FiVideoOff size={16}/>}
            </button>
            <button onClick={leaveSeat}
              className="bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-4 py-2 text-xs font-semibold">
              Leave Seat
            </button>
          </div>
        )}

        <AnimatePresence>
          {showWallpaper && <WallpaperPicker current={wallpaper} onSelect={changeWallpaper} onClose={() => setShowWallpaper(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  return null;
}

// Inline host controls overlaid on video seat tile
function SeatMenuInline({ seat, seatIndex, streamId }) {
  const [open, setOpen] = useState(false);
  const act = async (action) => {
    try {
      if (action === 'mute') await api.post(`/rooms/${streamId}/seats/${seatIndex}/mute`, { muted: !seat.isMuted });
      if (action === 'drop') await api.post(`/rooms/${streamId}/seats/${seatIndex}/drop`);
      toast.success('Done');
    } catch { toast.error('Failed'); }
    setOpen(false);
  };
  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5 z-10">
        <FiSettings size={10} className="text-white/70" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-0 bg-dark-800/95 backdrop-blur p-1.5 flex gap-1 z-20">
            <button onClick={() => act('mute')}
              className="flex-1 text-[9px] py-1 rounded bg-dark-600 text-white/70 hover:bg-dark-500 flex items-center justify-center gap-0.5">
              {seat.isMuted ? <FiVolume2 size={9}/> : <FiVolumeX size={9}/>}
              {seat.isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button onClick={() => act('drop')}
              className="flex-1 text-[9px] py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/40 flex items-center justify-center gap-0.5">
              <FiUserX size={9}/> Drop
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
