import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiCrosshair, FiX, FiClock, FiZap } from 'react-icons/fi';

const AVATAR_COLORS = ['from-brand-500 to-brand-700', 'from-orange-500 to-red-600'];

function Avatar({ user, size = 'md' }) {
  const sz = size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-sm';
  const gradient = 'from-brand-500 to-brand-700';
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-bold overflow-hidden border-2 border-white/20`}>
      {user?.avatar
        ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
        : (user?.displayName?.[0] || user?.username?.[0] || '?').toUpperCase()}
    </div>
  );
}

function CountdownTimer({ endsAt }) {
  const [remaining, setRemaining] = useState('');
  const [pct, setPct] = useState(100);
  const totalDuration = 10 * 60 * 1000; // 10 min in ms

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const end = new Date(endsAt).getTime();
      const diff = Math.max(0, end - now);
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
      setPct(Math.round((diff / totalDuration) * 100));
      if (diff <= 0) clearInterval(id);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const color = pct > 50 ? '#22c55e' : pct > 20 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
          <circle cx="28" cy="28" r="24" fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 24}`}
            strokeDashoffset={`${2 * Math.PI * 24 * (1 - pct / 100)}`}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-xs font-bold">{remaining}</span>
        </div>
      </div>
      <span className="text-white/40 text-[10px]">remaining</span>
    </div>
  );
}

export default function PKBattle({ streamId, currentStreamerId, onInvite }) {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [battle, setBattle] = useState(null);
  const [invite, setInvite] = useState(null); // incoming invite
  const [showInviteModal, setShowInviteModal] = useState(false);

  const isStreamerA = battle?.streamerA?._id === currentStreamerId ||
    battle?.streamerA === currentStreamerId;
  const myScore = isStreamerA ? battle?.coinsA : battle?.coinsB;
  const oppScore = isStreamerA ? battle?.coinsB : battle?.coinsA;
  const myStreamer = isStreamerA ? battle?.streamerA : battle?.streamerB;
  const oppStreamer = isStreamerA ? battle?.streamerB : battle?.streamerA;
  const leading = (battle?.coinsA || 0) >= (battle?.coinsB || 0) ? 'A' : 'B';

  useEffect(() => {
    // Check if already in a battle
    api.get(`/pk/stream/${streamId}`).then(res => {
      if (res.data) setBattle(res.data);
    }).catch(() => {});
  }, [streamId]);

  useEffect(() => {
    if (!socket) return;

    socket.on('pk_invite', (data) => {
      setInvite(data);
      setShowInviteModal(true);
    });
    socket.on('pk_started', (data) => {
      setBattle(data);
      setShowInviteModal(false);
      setInvite(null);
      toast.success('⚔️ PK Battle started!');
    });
    socket.on('pk_update', (data) => {
      setBattle(prev => prev ? { ...prev, coinsA: data.coinsA, coinsB: data.coinsB } : prev);
    });
    socket.on('pk_active', (data) => {
      if (data) setBattle(data);
    });
    socket.on('pk_ended', (data) => {
      setBattle(prev => prev ? { ...prev, ...data, status: 'ended' } : prev);
      const won = data.winnerId === currentStreamerId;
      setTimeout(() => {
        setBattle(null);
        if (won !== undefined) toast(won ? '🏆 You won the PK Battle!' : '💪 Battle ended - keep streaming!', { duration: 5000 });
      }, 5000);
    });
    socket.on('pk_declined', () => {
      toast('PK invite was declined');
    });

    return () => {
      socket.off('pk_invite');
      socket.off('pk_started');
      socket.off('pk_update');
      socket.off('pk_active');
      socket.off('pk_ended');
      socket.off('pk_declined');
    };
  }, [socket, currentStreamerId]);

  const acceptPK = async () => {
    try {
      await api.post(`/pk/${invite.battleId}/accept`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to accept');
    }
  };

  const declinePK = async () => {
    try {
      await api.post(`/pk/${invite.battleId}/decline`);
      setShowInviteModal(false);
      setInvite(null);
    } catch { }
  };

  // ── Incoming invite modal ──
  if (showInviteModal && invite) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[300] p-4"
      >
        <div className="glass-card p-6 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">⚔️</div>
          <h2 className="text-white font-display font-bold text-xl mb-1">PK Battle Invite!</h2>
          <p className="text-white/60 text-sm mb-6">
            <span className="text-brand-400 font-semibold">{invite.fromStream?.streamer?.displayName || 'A streamer'}</span>
            {' '}is challenging you to a 10-minute PK battle!
          </p>
          <div className="flex gap-3">
            <button onClick={declinePK} className="btn-ghost flex-1 py-3">Decline</button>
            <button onClick={acceptPK} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
              <FiCrosshair /> Accept Battle
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Active battle UI ──
  if (battle && battle.status !== 'ended') {
    const totalCoins = (battle.coinsA || 0) + (battle.coinsB || 0);
    const pctA = totalCoins > 0 ? Math.round((battle.coinsA / totalCoins) * 100) : 50;
    const pctB = 100 - pctA;
    const streamerAWinning = battle.coinsA >= battle.coinsB;

    return (
      <div className="bg-dark-800/95 border-b border-brand-500/30 px-4 py-3">
        {/* PK Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-brand-400 font-bold text-sm">
            <FiCrosshair className="text-xs" /> PK BATTLE
          </div>
          {battle.endsAt && <CountdownTimer endsAt={battle.endsAt} />}
        </div>

        {/* Streamers & scores */}
        <div className="flex items-center gap-3">
          {/* Streamer A */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <Avatar user={battle.streamerA} size="md" />
            <p className="text-white text-xs font-semibold truncate w-full text-center">
              {battle.streamerA?.displayName || battle.streamerA?.username}
            </p>
            <p className={`text-sm font-bold ${streamerAWinning ? 'text-yellow-400' : 'text-white/60'}`}>
              🪙 {(battle.coinsA || 0).toLocaleString()}
            </p>
            {streamerAWinning && <span className="text-yellow-400 text-[10px] font-bold">LEADING</span>}
          </div>

          {/* VS */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-red-500 flex items-center justify-center">
              <FiCrosshair className="text-white text-sm" />
            </div>
            <span className="text-white/40 text-xs font-bold">VS</span>
          </div>

          {/* Streamer B */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <Avatar user={battle.streamerB} size="md" />
            <p className="text-white text-xs font-semibold truncate w-full text-center">
              {battle.streamerB?.displayName || battle.streamerB?.username}
            </p>
            <p className={`text-sm font-bold ${!streamerAWinning ? 'text-yellow-400' : 'text-white/60'}`}>
              🪙 {(battle.coinsB || 0).toLocaleString()}
            </p>
            {!streamerAWinning && <span className="text-yellow-400 text-[10px] font-bold">LEADING</span>}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 rounded-full overflow-hidden flex bg-dark-600">
          <motion.div
            animate={{ width: `${pctA}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-l-full"
          />
          <motion.div
            animate={{ width: `${pctB}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-gradient-to-l from-orange-500 to-red-500 rounded-r-full"
          />
        </div>
        <div className="flex justify-between text-[10px] text-white/40 mt-1">
          <span>{pctA}%</span>
          <span>{pctB}%</span>
        </div>
      </div>
    );
  }

  // ── Battle ended result ──
  if (battle?.status === 'ended') {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-dark-800/95 border-b border-yellow-500/30 px-4 py-4 text-center"
      >
        <p className="text-yellow-400 font-bold text-lg mb-1">⚔️ Battle Ended!</p>
        <p className="text-white/60 text-sm">
          Winner: <span className="text-white font-semibold">
            {battle.coinsA >= battle.coinsB
              ? battle.streamerA?.displayName || 'Streamer A'
              : battle.streamerB?.displayName || 'Streamer B'}
          </span>
        </p>
        <p className="text-white/40 text-xs mt-1">
          {battle.coinsA.toLocaleString()} 🪙 vs {battle.coinsB.toLocaleString()} 🪙
        </p>
      </motion.div>
    );
  }

  return null;
}
