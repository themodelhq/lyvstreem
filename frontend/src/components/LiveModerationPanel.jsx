import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { playSoundEffect, primeAudio } from '../utils/soundEffects';
import {
  FiShield, FiX, FiVolumeX, FiVolume2, FiUserX, FiUserCheck,
  FiPlus, FiTrash2, FiMic, FiMicOff, FiImage, FiMusic,
  FiChevronDown, FiChevronUp, FiAlertTriangle
} from 'react-icons/fi';

// ── Sound board ───────────────────────────────────────────────────────────────
const SOUNDS = [
  { id: 'laugh',   label: 'Laugh',   emoji: '😂', src: 'https://www.soundjay.com/human/sounds/laughing-1.mp3' },
  { id: 'clap',    label: 'Clap',    emoji: '👏', src: 'https://www.soundjay.com/human/sounds/clapping-1.mp3' },
  { id: 'cheer',   label: 'Cheer',   emoji: '🎉', src: 'https://www.soundjay.com/human/sounds/cheering-1.mp3' },
  { id: 'aww',     label: 'Aww',     emoji: '😮', src: 'https://www.soundjay.com/human/sounds/aww-1.mp3' },
  { id: 'drum',    label: 'Drum',    emoji: '🥁', src: 'https://www.soundjay.com/music/sounds/drum-roll-1.mp3' },
  { id: 'airhorn', label: 'Air Horn', emoji: '📣', src: 'https://www.soundjay.com/transportation/sounds/air-horn-1.mp3' },
  { id: 'tada',    label: 'Ta-da!',  emoji: '🎺', src: 'https://www.soundjay.com/misc/sounds/tada-1.mp3' },
  { id: 'boo',     label: 'Boo',     emoji: '👎', src: 'https://www.soundjay.com/human/sounds/boo-1.mp3' },
];

// ── Wallpaper / background images ─────────────────────────────────────────────
// These are real photos that match each label, served from Unsplash's CDN.
// `id` is the full-resolution URL (what's stored on the stream and what
// VirtualBackgroundVideo composites behind the host). `thumbUrl` is a small,
// low-quality version used only for the preview tile in this panel.
const _u = (id, w, q) => `https://images.unsplash.com/photo-${id}?w=${w}&q=${q}&fit=crop&auto=format`;
const _bgEntry = (label, photoId) => ({
  id:       _u(photoId, 1280, 80),
  thumbUrl: _u(photoId, 220,  60),
  label,
});

const BG_PRESETS = [
  { id: '', label: 'None', style: { background: '#0a0a0f' } },
  _bgEntry('Galaxy', '1462331940025-496dfbfc7564'),
  _bgEntry('Sunset', '1495616811223-4d98c6e9c869'),
  _bgEntry('Ocean',  '1505142468610-359e7d316be0'),
  _bgEntry('Rose',   '1518895949257-7621c3c786d7'),
  _bgEntry('Forest', '1448375240586-882707db888b'),
  _bgEntry('Fire',   '1497032628192-86f99bcd76bc'),
  _bgEntry('Purple', '1493514789931-586cb221d7a7'),
  _bgEntry('Space',  '1419242902214-272b3f66ee7a'),
  _bgEntry('Aurora', '1531366936337-7c912a4589a7'),
  _bgEntry('Neon',   '1545987796-200677ee1011'),
  _bgEntry('Gold',   '1573497019418-b400bb3ab074'),
];

// ── Viewer row in moderation list ─────────────────────────────────────────────
function ViewerRow({ viewer, streamId, isMuted, isAdmin, isHost, onAction }) {
  const [open, setOpen] = useState(false);

  const actions = [
    isMuted
      ? { label: 'Unmute Chat', icon: FiVolume2,  fn: () => onAction('unmute', viewer), color: 'text-green-400' }
      : { label: 'Mute Chat',   icon: FiVolumeX,  fn: () => onAction('mute',   viewer), color: 'text-yellow-400' },
    { label: 'Kick',           icon: FiUserX,     fn: () => onAction('kick',   viewer), color: 'text-orange-400' },
    { label: 'Kick & Block',   icon: FiAlertTriangle, fn: () => onAction('block', viewer), color: 'text-red-400' },
    ...(!isAdmin && isHost ? [{ label: 'Make Admin', icon: FiShield, fn: () => onAction('addAdmin', viewer), color: 'text-brand-400' }] : []),
    ...(isAdmin  && isHost ? [{ label: 'Remove Admin', icon: FiTrash2, fn: () => onAction('removeAdmin', viewer), color: 'text-red-300' }] : []),
  ];

  return (
    <div className="bg-dark-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
          {viewer.avatar ? <img src={viewer.avatar} alt="" className="w-full h-full object-cover" /> : (viewer.displayName?.[0] || '?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium truncate">
            {viewer.displayName || viewer.username}
            {isAdmin && <span className="ml-1 text-[9px] text-brand-400 font-bold bg-brand-500/20 px-1 rounded">ADMIN</span>}
            {isMuted && <span className="ml-1 text-[9px] text-yellow-400 bg-yellow-500/20 px-1 rounded">MUTED</span>}
          </p>
          <p className="text-white/30 text-[10px]">@{viewer.username}</p>
        </div>
        {open ? <FiChevronUp className="text-white/30 text-sm shrink-0" /> : <FiChevronDown className="text-white/30 text-sm shrink-0" />}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {actions.map(a => (
                <button key={a.label} onClick={() => { a.fn(); setOpen(false); }}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-dark-600 hover:bg-dark-500 transition-all ${a.color}`}>
                  <a.icon size={10} /> {a.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function LiveModerationPanel({ streamId, isHost, isAdmin: myIsAdmin, onBackgroundChange }) {
  const { user }  = useAuth();
  const { socket } = useSocket();

  const [open, setOpen]           = useState(false);
  const [tab, setTab]             = useState('viewers'); // viewers | background | sounds | admins
  const [viewers, setViewers]     = useState([]);        // connected viewers
  const [mutedUsers, setMutedUsers] = useState([]);
  const [admins, setAdmins]       = useState([]);
  const [customBg, setCustomBg]   = useState('');
  const [currentBg, setCurrentBg] = useState('');
  const [playingSound, setPlayingSound] = useState(null);
  const audioRef  = useRef(null);

  const canModerate = isHost || myIsAdmin;

  // Listen for socket viewer join events
  useEffect(() => {
    if (!socket) return;
    socket.on('user_joined', ({ user: u }) => {
      if (u.userId === (user?._id || user?.id)) return;
      setViewers(prev => {
        if (prev.find(v => v.userId === u.userId)) return prev;
        return [...prev, u];
      });
    });
    socket.on('viewer_muted', ({ targetUserId, muted }) => {
      setMutedUsers(prev => muted ? [...prev, targetUserId] : prev.filter(id => id !== targetUserId));
    });
    socket.on('admins_updated', ({ admins: a }) => setAdmins(a));
    socket.on('stream_background_changed', ({ backgroundImage }) => setCurrentBg(backgroundImage || ''));
    return () => {
      socket.off('user_joined');
      socket.off('viewer_muted');
      socket.off('admins_updated');
      socket.off('stream_background_changed');
    };
  }, [socket]);

  // Fetch current moderation state
  useEffect(() => {
    if (!canModerate || !streamId) return;
    api.get(`/moderation/${streamId}/moderation`)
      .then(res => {
        setAdmins(res.data.admins || []);
        setMutedUsers((res.data.mutedUsers || []).map(u => u._id || u));
        setCurrentBg(res.data.backgroundImage || '');
      })
      .catch(() => {});
  }, [streamId, canModerate]);

  const doAction = async (action, viewer) => {
    try {
      if (action === 'mute')        await api.post(`/moderation/${streamId}/mute-viewer`, { targetUserId: viewer.userId, muted: true });
      if (action === 'unmute')      await api.post(`/moderation/${streamId}/mute-viewer`, { targetUserId: viewer.userId, muted: false });
      if (action === 'kick')        await api.post(`/moderation/${streamId}/kick-viewer`, { targetUserId: viewer.userId, block: false });
      if (action === 'block')       await api.post(`/moderation/${streamId}/kick-viewer`, { targetUserId: viewer.userId, block: true });
      if (action === 'addAdmin')    await api.post(`/moderation/${streamId}/admin`, { targetUserId: viewer.userId, add: true });
      if (action === 'removeAdmin') await api.post(`/moderation/${streamId}/admin`, { targetUserId: viewer.userId, add: false });

      if (action === 'kick' || action === 'block') {
        setViewers(prev => prev.filter(v => v.userId !== viewer.userId));
      }
      toast.success('Done');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const applyBackground = async (bgValue) => {
    try {
      await api.post(`/moderation/${streamId}/background`, { imageUrl: bgValue });
      setCurrentBg(bgValue);
      // Notify the parent immediately so the host's own view updates without
      // having to wait on the socket round-trip.
      if (typeof onBackgroundChange === 'function') onBackgroundChange(bgValue || '');
      toast.success(bgValue ? 'Background updated' : 'Background removed');
    } catch { toast.error('Failed'); }
  };

  const playSound = async (sound) => {
    // Play locally immediately for instant feedback (the click is the user
    // gesture browsers require to unblock the AudioContext).
    primeAudio();
    try { playSoundEffect(sound.id); } catch (_) {}
    setPlayingSound(sound.id);
    setTimeout(() => setPlayingSound(null), 3000);
    // Broadcast to viewers
    try {
      await api.post(`/moderation/${streamId}/sound`, { soundId: sound.id });
    } catch { toast.error('Failed to broadcast sound to viewers'); }
  };

  if (!canModerate) return null;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold ${open ? 'bg-brand-500 text-white' : 'bg-dark-700 text-white/60 hover:text-white'}`}
        title="Moderation controls"
      >
        <FiShield className="text-base" />
        <span className="hidden sm:inline">Moderate</span>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full mb-2 right-0 w-80 glass-card shadow-2xl z-50 overflow-hidden"
            style={{ maxHeight: '70vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-white/10 sticky top-0 bg-dark-800 z-10">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <FiShield className="text-brand-400" /> Moderation
              </h3>
              <button onClick={() => setOpen(false)} className="p-1 text-white/40 hover:text-white"><FiX size={14} /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {[
                { id: 'viewers',    icon: FiUserCheck, label: 'Viewers' },
                { id: 'background', icon: FiImage,     label: 'Background' },
                { id: 'sounds',     icon: FiMusic,     label: 'Sounds' },
                ...(isHost ? [{ id: 'admins', icon: FiShield, label: 'Admins' }] : []),
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-all ${tab === t.id ? 'text-brand-400 border-b-2 border-brand-400' : 'text-white/40 hover:text-white'}`}>
                  <t.icon size={14} />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: '55vh' }}>

              {/* ── Viewers tab ── */}
              {tab === 'viewers' && (
                <div className="p-3 space-y-2">
                  <p className="text-white/30 text-xs">{viewers.length} connected viewers</p>
                  {viewers.length === 0 ? (
                    <div className="text-center py-8 text-white/20 text-xs">No viewers connected yet</div>
                  ) : viewers.map(v => (
                    <ViewerRow
                      key={v.userId}
                      viewer={v}
                      streamId={streamId}
                      isMuted={mutedUsers.includes(v.userId)}
                      isAdmin={admins.some(a => (a._id || a) === v.userId)}
                      isHost={isHost}
                      onAction={doAction}
                    />
                  ))}
                </div>
              )}

              {/* ── Background tab ── */}
              {tab === 'background' && (
                <div className="p-3 space-y-4">
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Preset Backgrounds</p>
                    <div className="grid grid-cols-3 gap-2">
                      {BG_PRESETS.map(bg => {
                        const previewStyle = bg.thumbUrl
                          ? { backgroundImage: `url(${bg.thumbUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                          : bg.style;
                        return (
                          <button key={bg.id || 'none'} onClick={() => applyBackground(bg.id)}
                            className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all hover:scale-105 bg-dark-700 ${currentBg === bg.id ? 'border-brand-400' : 'border-transparent'}`}
                            style={previewStyle}
                            title={bg.label}>
                            <span className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[9px] font-bold drop-shadow">{bg.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-widest mb-2">Custom Image URL</p>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={customBg}
                        onChange={e => setCustomBg(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="flex-1 bg-dark-700 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder-white/30 focus:outline-none focus:border-brand-500"
                      />
                      <button onClick={() => { applyBackground(customBg); setCustomBg(''); }}
                        className="btn-primary text-xs py-2 px-3 shrink-0">Apply</button>
                    </div>
                    {currentBg && (
                      <button onClick={() => applyBackground('')}
                        className="mt-2 text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                        <FiTrash2 size={10} /> Remove background
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── Sounds tab ── */}
              {tab === 'sounds' && (
                <div className="p-3">
                  <p className="text-white/50 text-xs uppercase tracking-widest mb-3">Play for all viewers</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SOUNDS.map(sound => (
                      <button key={sound.id} onClick={() => playSound(sound)}
                        className={`flex items-center gap-2 px-3 py-3 rounded-xl border transition-all hover:scale-105 active:scale-95 ${
                          playingSound === sound.id
                            ? 'bg-brand-500/30 border-brand-500/50 text-white'
                            : 'bg-dark-700/50 border-white/10 text-white/70 hover:text-white hover:border-brand-500/30'
                        }`}>
                        <span className="text-2xl">{sound.emoji}</span>
                        <div className="text-left">
                          <p className="text-xs font-semibold">{sound.label}</p>
                          {playingSound === sound.id && <p className="text-[9px] text-brand-400">Playing...</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Admins tab ── */}
              {tab === 'admins' && isHost && (
                <div className="p-3 space-y-2">
                  <p className="text-white/30 text-xs mb-3">Up to 10 admins can mute &amp; kick viewers</p>
                  {admins.length === 0
                    ? <div className="text-center py-6 text-white/20 text-xs">No admins assigned yet. Go to Viewers tab to add admins.</div>
                    : admins.map(a => (
                        <div key={a._id || a} className="flex items-center gap-2 bg-dark-700/50 rounded-xl px-3 py-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                            {a.avatar ? <img src={a.avatar} alt="" className="w-full h-full object-cover" /> : (a.displayName?.[0] || '?').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-medium truncate">{a.displayName || a.username}</p>
                            <p className="text-brand-400 text-[9px]">Admin</p>
                          </div>
                          <button onClick={() => doAction('removeAdmin', { userId: a._id || a, displayName: a.displayName, username: a.username })}
                            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-all">
                            <FiTrash2 size={12} />
                          </button>
                        </div>
                      ))
                  }
                  <p className="text-white/20 text-[10px] text-center">{admins.length}/10 admins</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
