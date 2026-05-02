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
import { BsMusicNoteBeamed } from 'react-icons/bs';

// ── Wallpapers ───────────────────────────────────────────────────────────────
const WALLPAPERS = [
  { id: 'none',      label: 'None',      bg: 'bg-dark-900',           style: {} },
  { id: 'galaxy',    label: 'Galaxy',    bg: '',                       style: { background: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' } },
  { id: 'sunset',    label: 'Sunset',    bg: '',                       style: { background: 'linear-gradient(135deg,#f83600,#f9d423)' } },
  { id: 'ocean',     label: 'Ocean',     bg: '',                       style: { background: 'linear-gradient(135deg,#1a6dff,#0ad3ff)' } },
  { id: 'forest',    label: 'Forest',    bg: '',                       style: { background: 'linear-gradient(135deg,#134e5e,#71b280)' } },
  { id: 'midnight',  label: 'Midnight',  bg: '',                       style: { background: 'linear-gradient(135deg,#232526,#414345)' } },
  { id: 'aurora',    label: 'Aurora',    bg: '',                       style: { background: 'linear-gradient(135deg,#00c9ff,#92fe9d)' } },
  { id: 'rose',      label: 'Rose',      bg: '',                       style: { background: 'linear-gradient(135deg,#f953c6,#b91d73)' } },
  { id: 'fire',      label: 'Fire',      bg: '',                       style: { background: 'linear-gradient(135deg,#f12711,#f5af19)' } },
  { id: 'purple',    label: 'Purple',    bg: '',                       style: { background: 'linear-gradient(135deg,#6a0572,#c850c0)' } },
  { id: 'dark_red',  label: 'Dark Red',  bg: '',                       style: { background: 'linear-gradient(135deg,#3d0000,#8b0000)' } },
  { id: 'space',     label: 'Space',     bg: '',                       style: { background: 'radial-gradient(ellipse at center,#1b2735 0%,#090a0f 100%)' } },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function Avatar({ user, size = 'md', pulsing = false, muted = false }) {
  const sizeMap = { sm: 'w-10 h-10 text-sm', md: 'w-14 h-14 text-lg', lg: 'w-20 h-20 text-2xl', xl: 'w-24 h-24 text-3xl' };
  const cls = sizeMap[size] || sizeMap.md;
  return (
    <div className={`relative rounded-full overflow-hidden flex-shrink-0 ${pulsing ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-transparent' : ''}`}>
      <div className={`${cls} bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center font-bold text-white`}>
        {user?.avatar
          ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
          : (user?.displayName?.[0] || user?.username?.[0] || '?').toUpperCase()}
      </div>
      {muted && (
        <div className="absolute bottom-0 right-0 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
          <FiMicOff className="text-white text-[8px]" />
        </div>
      )}
    </div>
  );
}

function VideoTile({ stream, user, muted, isMuted, isHost, size = 'md', coinsGiven = 0 }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-dark-800 rounded-xl overflow-hidden flex flex-col items-center justify-center">
      {stream
        ? <video ref={videoRef} autoPlay playsInline muted={muted} className="w-full h-full object-cover" />
        : <Avatar user={user} size={size} muted={isMuted} />}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
        <span className="text-white text-xs font-medium truncate">{isHost ? <span className="text-brand-400 text-[10px] font-bold mr-1">Host</span> : null}{user?.displayName || user?.username || 'Viewer'}</span>
        <span className="text-yellow-400 text-[10px] flex items-center gap-0.5">🪙{coinsGiven}</span>
      </div>
      {isMuted && (
        <div className="absolute top-1.5 right-1.5 bg-black/50 rounded-full p-0.5">
          <FiMicOff className="text-white text-[10px]" />
        </div>
      )}
    </div>
  );
}

// ── Host Context Menu (right-click on seat) ──────────────────────────────────
function SeatContextMenu({ seat, seatIndex, streamId, onClose, isHost }) {
  if (!isHost) return null;
  const doAction = async (action) => {
    try {
      if (action === 'mute') await api.post(`/rooms/${streamId}/seats/${seatIndex}/mute`, { muted: !seat.isMuted });
      if (action === 'drop') await api.post(`/rooms/${streamId}/seats/${seatIndex}/drop`);
      if (action === 'lock') await api.post(`/rooms/${streamId}/seats/${seatIndex}/lock`, { locked: !seat.isLocked });
      toast.success('Done');
    } catch (e) { toast.error('Action failed'); }
    onClose();
  };
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      className="absolute z-50 bg-dark-700 border border-white/10 rounded-xl shadow-2xl p-1 min-w-[140px]">
      {seat.userId && <>
        <button onClick={() => doAction('mute')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg">
          {seat.isMuted ? <FiVolume2 /> : <FiVolumeX />} {seat.isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button onClick={() => doAction('drop')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg">
          <FiUserX /> Drop from seat
        </button>
      </>}
      <button onClick={() => doAction('lock')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg">
        {seat.isLocked ? <FiUnlock /> : <FiLock />} {seat.isLocked ? 'Unlock Seat' : 'Lock Seat'}
      </button>
    </motion.div>
  );
}

// ── Pending seat requests (host sees these) ───────────────────────────────────
function SeatRequests({ requests, streamId, onApprove, onDeny }) {
  if (requests.length === 0) return null;
  return (
    <div className="absolute top-2 right-2 z-40 space-y-2 max-w-[220px]">
      {requests.map((r, i) => (
        <motion.div key={r.socketId + i} initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
          className="bg-dark-800/95 backdrop-blur border border-white/10 rounded-xl p-3 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <Avatar user={r.user} size="sm" />
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{r.user?.displayName || r.user?.username}</p>
              <p className="text-white/40 text-[10px]">Wants seat #{r.seatIndex + 1}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => onApprove(r)} className="flex-1 flex items-center justify-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs py-1.5 rounded-lg font-semibold transition-colors">
              <FiCheck className="text-xs" /> Accept
            </button>
            <button onClick={() => onDeny(r)} className="flex-1 flex items-center justify-center gap-1 bg-dark-600 hover:bg-dark-500 text-white/60 text-xs py-1.5 rounded-lg transition-colors">
              <FiX className="text-xs" /> Deny
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MultiSeatRoom({
  streamId, isHost, hostUser,
  localStream, localVideoRef,
  hostStream,
}) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { peerStreams, createPeer, handleOffer, handleAnswer, handleIceCandidate, removePeer, cleanup } = useWebRTC({ socket, localStream });

  const [mode, setMode] = useState('solo');           // 'solo' | 'audio' | 'video'
  const [seats, setSeats] = useState([]);
  const [wallpaper, setWallpaper] = useState('none');
  const [allMuted, setAllMuted] = useState(false);
  const [mySeatIndex, setMySeatIndex] = useState(null);
  const [selfMuted, setSelfMuted] = useState(false);
  const [selfVideoOn, setSelfVideoOn] = useState(true);
  const [requests, setRequests] = useState([]);        // pending join requests (host)
  const [contextMenu, setContextMenu] = useState(null); // { seatIndex, x, y }
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showModePanel, setShowModePanel] = useState(false);
  const [settingMode, setSettingMode] = useState(false);
  const containerRef = useRef(null);

  const currentWallpaper = WALLPAPERS.find(w => w.id === wallpaper) || WALLPAPERS[0];

  // ── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on('room_state', ({ mode: m, seats: s, allMuted: am, wallpaper: wp }) => {
      setMode(m); setSeats(s || []); setAllMuted(am);
      if (wp) setWallpaper(wp);
    });
    socket.on('room_mode_changed', ({ mode: m, seats: s, wallpaper: wp }) => {
      setMode(m); setSeats(s || []);
      if (wp !== undefined) setWallpaper(wp || 'none');
      setMySeatIndex(null);
    });
    socket.on('room_wallpaper_changed', ({ wallpaper: wp }) => setWallpaper(wp || 'none'));
    socket.on('seat_updated', ({ seats: s, allMuted: am }) => {
      setSeats(s || []);
      if (am !== undefined) setAllMuted(am);
    });
    // Viewer: host approved my seat
    socket.on('room_seat_approved', ({ seatIndex, mode: m, isMuted }) => {
      setMySeatIndex(seatIndex);
      setSelfMuted(isMuted);
      toast.success(`✅ You're now in seat #${seatIndex + 1}!`);
      socket.emit('room_join_seat', { streamId, seatIndex });
    });
    socket.on('room_seat_denied', () => toast('❌ Seat request denied'));
    socket.on('room_seat_request_sent', ({ seatIndex }) => toast(`Request sent for seat #${seatIndex + 1}...`));
    socket.on('seat_dropped', ({ reason }) => {
      setMySeatIndex(null); cleanup();
      toast(reason === 'locked' ? '🔒 Seat was locked' : '⚠️ Host removed you from the seat');
    });
    // Host: incoming seat request
    socket.on('room_seat_request', (req) => {
      setRequests(prev => [...prev.filter(r => r.socketId !== req.socketId), req]);
    });
    // WebRTC
    socket.on('room_new_peer', ({ peerId, peerUser, seatIndex, shouldInitiate }) => {
      if (shouldInitiate) createPeer(peerId, true, seatIndex, peerUser);
    });
    socket.on('room_peers_list', ({ peers, hostSocketId }) => {
      peers.forEach(({ socketId, seatIndex, user: peerUser }) => {
        createPeer(socketId, false, seatIndex, peerUser);
      });
    });
    socket.on('room_peer_left', ({ peerId }) => removePeer(peerId));
    socket.on('rtc_offer', (data) => handleOffer(data));
    socket.on('rtc_answer', (data) => handleAnswer(data));
    socket.on('rtc_ice_candidate', (data) => handleIceCandidate(data));
    socket.on('host_mute_command', ({ muted }) => {
      setSelfMuted(muted);
      localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    });

    return () => {
      ['room_state','room_mode_changed','room_wallpaper_changed','seat_updated','room_seat_approved',
       'room_seat_denied','room_seat_request_sent','seat_dropped','room_seat_request','room_new_peer',
       'room_peers_list','room_peer_left','rtc_offer','rtc_answer','rtc_ice_candidate','host_mute_command'
      ].forEach(e => socket.off(e));
    };
  }, [socket, streamId]);

  // ── Host: approve / deny ──────────────────────────────────────────────────
  const approveRequest = (req) => {
    socket?.emit('room_approve_seat', {
      streamId,
      seatIndex: req.seatIndex,
      targetSocketId: req.socketId,
      targetUserId: req.user.userId,
      targetUser: req.user,
    });
    setRequests(prev => prev.filter(r => r.socketId !== req.socketId));
  };
  const denyRequest = (req) => {
    socket?.emit('room_deny_seat', { targetSocketId: req.socketId, seatIndex: req.seatIndex });
    setRequests(prev => prev.filter(r => r.socketId !== req.socketId));
  };

  // ── Viewer: request a seat ────────────────────────────────────────────────
  const requestSeat = (seatIndex) => {
    if (!user) { toast.error('Sign in to join a seat'); return; }
    if (mySeatIndex !== null) { toast('Leave your current seat first'); return; }
    socket?.emit('room_request_seat', { streamId, seatIndex });
  };

  // ── Viewer: leave seat ────────────────────────────────────────────────────
  const leaveSeat = () => {
    if (mySeatIndex === null) return;
    socket?.emit('room_leave_seat', { streamId, seatIndex: mySeatIndex });
    setMySeatIndex(null); cleanup();
  };

  // ── Host mode switch ──────────────────────────────────────────────────────
  const switchMode = async (newMode) => {
    setSettingMode(true);
    try {
      await api.post(`/rooms/${streamId}/mode`, { mode: newMode });
      setShowModePanel(false);
      if (newMode !== 'solo') toast.success(`Switched to ${newMode} room mode`);
    } catch (e) { toast.error('Failed to switch mode'); }
    setSettingMode(false);
  };

  // ── Host: mute all ────────────────────────────────────────────────────────
  const toggleMuteAll = async () => {
    try { await api.post(`/rooms/${streamId}/mute-all`, { muted: !allMuted }); }
    catch { toast.error('Failed'); }
  };

  // ── Host: change wallpaper ────────────────────────────────────────────────
  const changeWallpaper = async (wpId) => {
    try {
      await api.post(`/rooms/${streamId}/wallpaper`, { wallpaper: wpId });
      setWallpaper(wpId); setShowWallpaperPicker(false);
    } catch { toast.error('Failed to change wallpaper'); }
  };

  // ── Self mute toggle ──────────────────────────────────────────────────────
  const toggleSelfMute = () => {
    if (seats[mySeatIndex]?.isMuted) return; // host muted, can't unmute
    const newMuted = !selfMuted;
    setSelfMuted(newMuted);
    localStream?.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    socket?.emit('room_self_mute', { streamId, seatIndex: mySeatIndex, muted: newMuted });
  };

  const toggleSelfVideo = () => {
    const newOn = !selfVideoOn;
    setSelfVideoOn(newOn);
    localStream?.getVideoTracks().forEach(t => { t.enabled = newOn; });
    socket?.emit('room_self_video', { streamId, seatIndex: mySeatIndex, videoOn: newOn });
  };

  // ── Click outside to close context menu ──────────────────────────────────
  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ── RENDER: solo mode (no room UI) ────────────────────────────────────────
  if (mode === 'solo') {
    if (!isHost) return null;
    return (
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
        <button onClick={() => setShowModePanel(v => !v)}
          className="flex items-center gap-2 bg-dark-800/80 backdrop-blur border border-white/20 rounded-full px-4 py-1.5 text-white text-xs font-semibold hover:bg-dark-700 transition-all">
          <FiSettings className="text-brand-400" /> Room Mode: Solo
        </button>
        <AnimatePresence>
          {showModePanel && <ModePickerPanel onSelect={switchMode} loading={settingMode} onClose={() => setShowModePanel(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  // ── RENDER: AUDIO MODE ────────────────────────────────────────────────────
  if (mode === 'audio') {
    return (
      <div className="absolute inset-0 flex flex-col" style={currentWallpaper.style} onClick={() => setContextMenu(null)}>
        {/* Wallpaper overlay */}
        <div className="absolute inset-0 bg-black/30" />

        {/* Pending requests */}
        {isHost && <SeatRequests requests={requests} streamId={streamId} onApprove={approveRequest} onDeny={denyRequest} />}

        {/* Host controls top bar */}
        {isHost && (
          <div className="relative z-10 flex items-center gap-2 p-3 flex-wrap">
            <button onClick={() => setShowModePanel(v => !v)}
              className="flex items-center gap-1.5 bg-dark-800/70 backdrop-blur border border-white/10 rounded-full px-3 py-1 text-white text-xs hover:bg-dark-700">
              <FiSettings className="text-[11px]" /> Mode
            </button>
            <button onClick={() => setShowWallpaperPicker(v => !v)}
              className="flex items-center gap-1.5 bg-dark-800/70 backdrop-blur border border-white/10 rounded-full px-3 py-1 text-white text-xs hover:bg-dark-700">
              <FiImage className="text-[11px]" /> Wallpaper
            </button>
            <button onClick={toggleMuteAll}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border backdrop-blur ${allMuted ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-dark-800/70 border-white/10 text-white'}`}>
              {allMuted ? <FiVolumeX className="text-[11px]" /> : <FiVolume2 className="text-[11px]" />}
              {allMuted ? 'Unmute All' : 'Mute All'}
            </button>
          </div>
        )}

        {/* Host avatar (top center) */}
        <div className="relative z-10 flex flex-col items-center pt-2 pb-3">
          <div className="relative">
            <Avatar user={hostUser || user} size="xl" pulsing />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">Host</div>
          </div>
          <p className="text-white text-sm font-semibold mt-2">{hostUser?.displayName || user?.displayName || 'Host'}</p>
          <p className="text-yellow-400 text-xs">🪙 {seats.reduce((a, s) => a + (s.coinsGiven || 0), 0)}</p>
        </div>

        {/* AUDIO SEATS GRID — 2 rows of 6, exactly like BIGO */}
        <div className="relative z-10 flex-1 px-3 pb-3">
          {[0, 1].map(row => (
            <div key={row} className="grid grid-cols-6 gap-2 mb-3">
              {seats.slice(row * 6, row * 6 + 6).map((seat, colIdx) => {
                const idx = row * 6 + colIdx;
                const isOccupied = !!seat.userId;
                const isMe = seat.userId?.toString() === (user?._id || user?.id);
                const peerData = Object.values(peerStreams).find(p => p.seatIndex === idx);

                return (
                  <div key={idx} className="flex flex-col items-center gap-1 relative">
                    {/* Seat button */}
                    <button
                      className={`w-full aspect-square rounded-full relative overflow-hidden flex items-center justify-center transition-all
                        ${seat.isLocked ? 'bg-dark-700/60 cursor-not-allowed opacity-60' : isOccupied ? 'cursor-default' : 'cursor-pointer hover:scale-105 active:scale-95'}
                        ${isMe ? 'ring-2 ring-brand-400' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isHost && isOccupied) {
                          setContextMenu({ seatIndex: idx });
                        } else if (!isHost && !isOccupied && !seat.isLocked) {
                          requestSeat(idx);
                        }
                      }}
                      onContextMenu={(e) => {
                        if (isHost) { e.preventDefault(); setContextMenu({ seatIndex: idx }); }
                      }}
                    >
                      {isOccupied ? (
                        <Avatar user={{ displayName: seat.displayName, username: seat.username, avatar: seat.avatar }} size="md" muted={seat.isMuted} pulsing={peerData && !seat.isMuted} />
                      ) : seat.isLocked ? (
                        <div className="w-14 h-14 rounded-full bg-dark-600 flex items-center justify-center"><FiLock className="text-white/40" /></div>
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-white/10 border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-0.5">
                          <FiPlus className="text-white/50 text-lg" />
                        </div>
                      )}
                    </button>

                    {/* Seat label */}
                    <span className="text-white/70 text-[9px] text-center leading-tight truncate w-full text-center">
                      {isOccupied ? (seat.displayName || seat.username || '').split(' ')[0] : seat.isLocked ? 'Locked' : `${idx + 1}`}
                    </span>
                    {isOccupied && <span className="text-yellow-400 text-[9px]">🪙{seat.coinsGiven || 0}</span>}

                    {/* Context menu */}
                    <AnimatePresence>
                      {contextMenu?.seatIndex === idx && isHost && (
                        <SeatContextMenu seat={seat} seatIndex={idx} streamId={streamId} isHost={isHost} onClose={() => setContextMenu(null)} />
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* My seat controls */}
        {mySeatIndex !== null && (
          <div className="relative z-10 flex items-center justify-center gap-3 pb-4">
            <button onClick={toggleSelfMute}
              className={`p-3 rounded-full ${selfMuted ? 'bg-red-500 text-white' : 'bg-dark-700 text-white'}`}>
              {selfMuted ? <FiMicOff /> : <FiMic />}
            </button>
            <button onClick={leaveSeat} className="bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-5 py-2 text-sm font-semibold">
              Leave Seat
            </button>
          </div>
        )}

        {/* Wallpaper picker */}
        <AnimatePresence>
          {showWallpaperPicker && <WallpaperPicker current={wallpaper} onSelect={changeWallpaper} onClose={() => setShowWallpaperPicker(false)} />}
        </AnimatePresence>

        {/* Mode picker */}
        <AnimatePresence>
          {showModePanel && <ModePickerPanel onSelect={switchMode} loading={settingMode} onClose={() => setShowModePanel(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  // ── RENDER: VIDEO MODE ────────────────────────────────────────────────────
  if (mode === 'video') {
    const occupiedSeats = seats.filter(s => !!s.userId);
    const totalSlots = 1 + seats.length; // host + 12 seats

    // Determine grid layout based on occupied count
    const occupied = occupiedSeats.length;
    let gridCols = 'grid-cols-2';
    if (occupied >= 8) gridCols = 'grid-cols-4';
    else if (occupied >= 4) gridCols = 'grid-cols-3';

    return (
      <div className="absolute inset-0 flex flex-col" style={currentWallpaper.style} onClick={() => setContextMenu(null)}>
        <div className="absolute inset-0 bg-black/20" />

        {/* Pending requests */}
        {isHost && <SeatRequests requests={requests} streamId={streamId} onApprove={approveRequest} onDeny={denyRequest} />}

        {/* Host controls */}
        {isHost && (
          <div className="relative z-10 flex items-center gap-2 p-2 flex-wrap">
            <button onClick={() => setShowModePanel(v => !v)} className="flex items-center gap-1.5 bg-dark-800/70 backdrop-blur border border-white/10 rounded-full px-3 py-1 text-white text-xs">
              <FiSettings className="text-[11px]" /> Mode
            </button>
            <button onClick={() => setShowWallpaperPicker(v => !v)} className="flex items-center gap-1.5 bg-dark-800/70 backdrop-blur border border-white/10 rounded-full px-3 py-1 text-white text-xs">
              <FiImage className="text-[11px]" /> Wallpaper
            </button>
            <button onClick={toggleMuteAll} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border backdrop-blur ${allMuted ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-dark-800/70 border-white/10 text-white'}`}>
              {allMuted ? <FiVolumeX className="text-[11px]" /> : <FiVolume2 className="text-[11px]" />}
              {allMuted ? 'Unmute All' : 'Mute All'}
            </button>
          </div>
        )}

        {/* VIDEO GRID */}
        <div className="relative z-10 flex-1 overflow-hidden p-2">
          {occupied === 0 ? (
            // Solo host + empty seats below
            <div className="h-full flex flex-col gap-2">
              {/* Host large tile */}
              <div className="flex-1 rounded-2xl overflow-hidden relative min-h-0">
                <VideoTile stream={hostStream} user={hostUser || user} muted isHost coinsGiven={0} size="lg" />
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="live-badge text-[10px] py-0.5 px-2">LIVE</span>
                </div>
              </div>
              {/* Empty seats row */}
              <div className="grid grid-cols-6 gap-1.5 h-20">
                {seats.slice(0, 6).map((seat, idx) => (
                  <EmptySeatTile key={idx} seat={seat} seatIndex={idx} isHost={isHost} onRequest={() => requestSeat(idx)}
                    onContextMenu={(e) => { if (isHost) { e.preventDefault(); setContextMenu({ seatIndex: idx }); } }}
                    contextMenu={contextMenu} streamId={streamId} setContextMenu={setContextMenu} />
                ))}
              </div>
              <div className="grid grid-cols-6 gap-1.5 h-20">
                {seats.slice(6, 12).map((seat, i) => {
                  const idx = i + 6;
                  return <EmptySeatTile key={idx} seat={seat} seatIndex={idx} isHost={isHost} onRequest={() => requestSeat(idx)}
                    onContextMenu={(e) => { if (isHost) { e.preventDefault(); setContextMenu({ seatIndex: idx }); } }}
                    contextMenu={contextMenu} streamId={streamId} setContextMenu={setContextMenu} />;
                })}
              </div>
            </div>
          ) : (
            // Split view: host left + guests right (like image 2)
            <div className="h-full flex gap-2">
              {/* Host - large left panel */}
              <div className="flex-1 rounded-2xl overflow-hidden relative min-w-0">
                <VideoTile stream={hostStream} user={hostUser || user} muted isHost coinsGiven={0} size="xl" />
                <div className="absolute top-2 left-2"><span className="live-badge text-[10px]">LIVE</span></div>
              </div>
              {/* Right: occupied + empty seats */}
              <div className="w-32 sm:w-40 flex flex-col gap-1.5 overflow-y-auto">
                {seats.map((seat, idx) => {
                  const isOccupied = !!seat.userId;
                  const isMe = seat.userId?.toString() === (user?._id || user?.id);
                  const peerData = Object.values(peerStreams).find(p => p.seatIndex === idx);

                  if (isOccupied) {
                    return (
                      <div key={idx} className="relative rounded-xl overflow-hidden flex-shrink-0 h-28"
                        onContextMenu={(e) => { if (isHost) { e.preventDefault(); e.stopPropagation(); setContextMenu({ seatIndex: idx }); } }}>
                        <VideoTile stream={peerData?.stream} user={{ displayName: seat.displayName, username: seat.username, avatar: seat.avatar }}
                          muted={false} isMuted={seat.isMuted} isHost={false} coinsGiven={seat.coinsGiven || 0} size="sm" />
                        <span className="absolute top-1 left-1 text-[9px] bg-black/50 text-white px-1 rounded">#{idx + 1}</span>
                        {isMe && <div className="absolute inset-0 ring-2 ring-brand-400 rounded-xl pointer-events-none" />}
                        <AnimatePresence>
                          {contextMenu?.seatIndex === idx && isHost && (
                            <SeatContextMenu seat={seat} seatIndex={idx} streamId={streamId} isHost onClose={() => setContextMenu(null)} />
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }
                  return (
                    <EmptySeatTileVideo key={idx} seat={seat} seatIndex={idx} isHost={isHost}
                      onRequest={() => requestSeat(idx)}
                      onContextMenu={(e) => { if (isHost) { e.preventDefault(); e.stopPropagation(); setContextMenu({ seatIndex: idx }); } }}
                      contextMenu={contextMenu} streamId={streamId} setContextMenu={setContextMenu} />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* My seat controls */}
        {mySeatIndex !== null && (
          <div className="relative z-10 flex items-center justify-center gap-3 pb-3">
            <button onClick={toggleSelfMute} className={`p-3 rounded-full ${selfMuted ? 'bg-red-500 text-white' : 'bg-dark-700 text-white'}`}>
              {selfMuted ? <FiMicOff /> : <FiMic />}
            </button>
            <button onClick={toggleSelfVideo} className={`p-3 rounded-full ${!selfVideoOn ? 'bg-red-500 text-white' : 'bg-dark-700 text-white'}`}>
              {selfVideoOn ? <FiVideo /> : <FiVideoOff />}
            </button>
            <button onClick={leaveSeat} className="bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-5 py-2 text-sm font-semibold">
              Leave Seat
            </button>
          </div>
        )}

        {/* Wallpaper picker */}
        <AnimatePresence>
          {showWallpaperPicker && <WallpaperPicker current={wallpaper} onSelect={changeWallpaper} onClose={() => setShowWallpaperPicker(false)} />}
        </AnimatePresence>
        <AnimatePresence>
          {showModePanel && <ModePickerPanel onSelect={switchMode} loading={settingMode} onClose={() => setShowModePanel(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function EmptySeatTile({ seat, seatIndex, isHost, onRequest, onContextMenu, contextMenu, streamId, setContextMenu }) {
  return (
    <div className="flex flex-col items-center gap-0.5 relative">
      <button
        className={`w-full aspect-square rounded-full flex items-center justify-center transition-all
          ${seat.isLocked ? 'bg-dark-700/40 cursor-not-allowed' : 'bg-white/10 border-2 border-dashed border-white/20 hover:scale-105 cursor-pointer'}`}
        onClick={seat.isLocked ? undefined : onRequest}
        onContextMenu={onContextMenu}
      >
        {seat.isLocked ? <FiLock className="text-white/30 text-lg" /> : <FiPlus className="text-white/50 text-xl" />}
      </button>
      <span className="text-white/40 text-[8px]">{seat.isLocked ? '🔒' : seatIndex + 1}</span>
      <AnimatePresence>
        {contextMenu?.seatIndex === seatIndex && isHost && (
          <SeatContextMenu seat={seat} seatIndex={seatIndex} streamId={streamId} isHost onClose={() => setContextMenu(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptySeatTileVideo({ seat, seatIndex, isHost, onRequest, onContextMenu, contextMenu, streamId, setContextMenu }) {
  return (
    <div className="relative rounded-xl overflow-hidden flex-shrink-0 h-28 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-white/5 transition-all"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)' }}
      onClick={seat.isLocked ? undefined : onRequest}
      onContextMenu={onContextMenu}
    >
      {seat.isLocked
        ? <><FiLock className="text-white/30 text-xl" /><span className="text-white/30 text-[10px]">Locked</span></>
        : <><FiPlus className="text-white/40 text-2xl" /><span className="text-white/40 text-[10px]">#{seatIndex + 1} Join</span></>}
      <AnimatePresence>
        {contextMenu?.seatIndex === seatIndex && isHost && (
          <SeatContextMenu seat={seat} seatIndex={seatIndex} streamId={streamId} isHost onClose={() => setContextMenu(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function WallpaperPicker({ current, onSelect, onClose }) {
  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute bottom-0 left-0 right-0 z-50 bg-dark-800/98 backdrop-blur-xl border-t border-white/10 rounded-t-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center gap-2"><FiImage /> Room Wallpaper</h3>
        <button onClick={onClose} className="p-1 text-white/50 hover:text-white"><FiX /></button>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {WALLPAPERS.map(wp => (
          <button key={wp.id} onClick={() => onSelect(wp.id)}
            className={`relative rounded-xl overflow-hidden aspect-video flex items-center justify-center text-xs font-medium text-white transition-all hover:scale-105 ${current === wp.id ? 'ring-2 ring-brand-400 scale-105' : ''}`}
            style={{ ...wp.style, background: wp.style.background || '#1a1a26' }}>
            <span className="absolute inset-0 bg-black/30 flex items-center justify-center text-[10px] font-bold">{wp.label}</span>
            {current === wp.id && <FiCheck className="absolute top-1 right-1 text-white text-xs bg-brand-500 rounded-full p-0.5" />}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function ModePickerPanel({ onSelect, loading, onClose }) {
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="absolute top-14 left-3 z-50 bg-dark-800/98 backdrop-blur border border-white/10 rounded-2xl p-4 shadow-2xl w-64">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white font-semibold text-sm">Room Mode</p>
        <button onClick={onClose} className="text-white/40 hover:text-white p-1"><FiX /></button>
      </div>
      <div className="space-y-2">
        {[
          { id: 'solo', label: 'Solo Stream', desc: 'Full screen, no seats', icon: '📺' },
          { id: 'audio', label: 'Audio Room', desc: '12 seats, voice only', icon: '🎙️' },
          { id: 'video', label: 'Video Room', desc: '12 seats, with video', icon: '📹' },
        ].map(m => (
          <button key={m.id} onClick={() => onSelect(m.id)} disabled={loading}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-dark-700/50 hover:bg-dark-600 border border-white/5 hover:border-brand-500/30 transition-all text-left group">
            <span className="text-2xl">{m.icon}</span>
            <div>
              <p className="text-white text-sm font-medium group-hover:text-brand-300 transition-colors">{m.label}</p>
              <p className="text-white/40 text-xs">{m.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
