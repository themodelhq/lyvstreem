import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiSword, FiSearch, FiX } from 'react-icons/fi';

export default function PKInviteModal({ onClose, myStreamId }) {
  const [liveStreams, setLiveStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/streams/live', { params: { limit: 30 } })
      .then(res => {
        const others = (res.data.streams || []).filter(s => s._id !== myStreamId);
        setLiveStreams(others);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [myStreamId]);

  const sendInvite = async (stream) => {
    setSending(stream._id);
    try {
      await api.post('/pk/invite', { targetStreamId: stream._id });
      toast.success(`⚔️ PK invite sent to ${stream.streamerId?.displayName || stream.streamerId?.username}!`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send invite');
    } finally {
      setSending(null);
    }
  };

  const filtered = liveStreams.filter(s =>
    !search || s.title?.toLowerCase().includes(search.toLowerCase()) ||
    s.streamerId?.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[300] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="glass-card p-6 max-w-md w-full max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-display font-bold text-lg flex items-center gap-2">
            <FiSword className="text-brand-400" /> Challenge to PK
          </h2>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition-colors">
            <FiX />
          </button>
        </div>

        <p className="text-white/50 text-sm mb-4">Select a live streamer to battle. Winner is decided by most coins received in 10 minutes.</p>

        <div className="relative mb-4">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search streamers..."
            className="w-full bg-dark-700 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500" />
        </div>

        <div className="overflow-y-auto flex-1 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-white/30">
              <p className="text-3xl mb-2">📺</p>
              <p className="text-sm">No live streamers available</p>
            </div>
          ) : filtered.map(stream => (
            <div key={stream._id} className="flex items-center gap-3 bg-dark-700/50 rounded-xl px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm font-bold overflow-hidden">
                {stream.streamerId?.avatar
                  ? <img src={stream.streamerId.avatar} alt="" className="w-full h-full object-cover" />
                  : (stream.streamerId?.displayName?.[0] || 'L').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{stream.streamerId?.displayName || stream.streamerId?.username}</p>
                <p className="text-white/40 text-xs truncate">{stream.title}</p>
              </div>
              <div className="text-white/40 text-xs mr-2">{stream.viewerCount || 0} 👁️</div>
              <button
                onClick={() => sendInvite(stream)}
                disabled={sending === stream._id}
                className="shrink-0 flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-60"
              >
                {sending === stream._id
                  ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  : <><FiSword className="text-[10px]" /> Challenge</>}
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
