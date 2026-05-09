import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FiClock, FiUsers, FiGift, FiBarChart2, FiX, FiHome } from 'react-icons/fi';
import { BsCameraVideoFill } from 'react-icons/bs';

function formatDuration(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function StreamSummaryModal({ summary, onClose }) {
  if (!summary) return null;

  const COINS_PER = 210, NAIRA_PER = 1300;
  const hostCoins = Math.floor((summary.totalGifts || 0) * 0.65);
  const nairaValue = Math.floor((hostCoins / COINS_PER) * NAIRA_PER);

  const stats = [
    { icon: FiClock,    label: 'Duration',      value: formatDuration(summary.duration),     color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
    { icon: FiUsers,    label: 'Peak Viewers',   value: (summary.peakViewers || 0).toLocaleString(), color: 'text-green-400',  bg: 'bg-green-500/10'  },
    { icon: FiGift,     label: 'Coins Earned',   value: `🪙 ${hostCoins.toLocaleString()}`,  color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { icon: FiBarChart2,label: 'Naira Value',    value: `₦${nairaValue.toLocaleString()}`,   color: 'text-brand-400',  bg: 'bg-brand-500/10'  },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[400] p-4">
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="glass-card w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-brand-900 to-dark-800 p-6 text-center border-b border-white/10">
          <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <BsCameraVideoFill className="text-white text-2xl" />
          </div>
          <h2 className="text-white font-display font-bold text-xl">Stream Ended</h2>
          <p className="text-white/50 text-sm mt-1 truncate px-4">{summary.title}</p>
          <p className="text-white/30 text-xs mt-0.5">{summary.category}</p>
          <button onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-white/40 hover:text-white transition-colors">
            <FiX />
          </button>
        </div>

        {/* Stats grid */}
        <div className="p-6">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-4 text-center">Session Summary</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {stats.map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-2xl p-4 border border-white/5`}>
                <Icon className={`${color} text-xl mb-2`} />
                <p className="text-white/40 text-xs mb-1">{label}</p>
                <p className={`${color} font-bold text-lg font-display`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Time info */}
          <div className="bg-dark-700/50 rounded-xl px-4 py-3 space-y-1.5 text-sm mb-5">
            {summary.startedAt && (
              <div className="flex justify-between">
                <span className="text-white/40">Started</span>
                <span className="text-white">{new Date(summary.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
            {summary.endedAt && (
              <div className="flex justify-between">
                <span className="text-white/40">Ended</span>
                <span className="text-white">{new Date(summary.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Link to="/host-dashboard" onClick={onClose}
              className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 text-sm">
              <FiBarChart2 /> Dashboard
            </Link>
            <button onClick={onClose}
              className="flex-1 btn-ghost py-3 flex items-center justify-center gap-2 text-sm">
              <FiHome /> Home
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
