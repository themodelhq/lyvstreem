import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiX } from 'react-icons/fi';

const RARITY_COLORS = {
  common: 'border-white/10 bg-dark-700/60',
  rare: 'border-blue-500/30 bg-blue-900/20',
  epic: 'border-purple-500/30 bg-purple-900/20',
  legendary: 'border-yellow-500/40 bg-yellow-900/20',
};

const RARITY_LABEL = {
  common: 'text-gray-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400',
};

const CATEGORIES = ['All', 'basic', 'premium', 'super', 'legendary', 'special'];

export default function GiftPanel({ streamId, onClose }) {
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [sending, setSending] = useState(null);
  const [flyingGifts, setFlyingGifts] = useState([]);

  useEffect(() => {
    api.get('/gifts').then(res => {
      setGifts(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = activeCategory === 'All' ? gifts : gifts.filter(g => g.category === activeCategory);

  const sendGift = async (gift) => {
    if (!user) { toast.error('Please sign in to send gifts'); return; }
    if ((user.coins || 0) < gift.coins) {
      toast.error('Not enough coins! Buy more coins to send gifts.');
      return;
    }
    setSending(gift.id);
    try {
      const res = await api.post('/gifts/send', { giftId: gift.id, streamId });
      updateUser({ coins: res.data.remainingCoins });

      // Trigger flying animation
      const flyId = Date.now();
      setFlyingGifts(prev => [...prev, { ...gift, flyId }]);
      setTimeout(() => setFlyingGifts(prev => prev.filter(f => f.flyId !== flyId)), 2500);

      // Emit to socket
      socket?.emit('send_gift', {
        streamId,
        giftId: gift.id,
        giftName: gift.name,
        giftEmoji: gift.emoji,
        giftValue: gift.coins,
        giftRarity: gift.rarity,
        giftEffect: gift.effect,
      });

      toast.success(`${gift.emoji} ${gift.name} sent!`, { duration: 1500 });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send gift');
    } finally {
      setSending(null);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute bottom-0 left-0 right-0 bg-dark-800/95 backdrop-blur-xl border-t border-white/10 rounded-t-2xl z-50"
      style={{ maxHeight: '60vh' }}
    >
      {/* Flying gifts overlay */}
      <div className="fixed bottom-0 left-0 right-0 pointer-events-none overflow-hidden" style={{ height: '60vh', zIndex: 100 }}>
        <AnimatePresence>
          {flyingGifts.map(g => (
            <motion.div
              key={g.flyId}
              initial={{ bottom: '40%', x: '50vw', scale: 0.5, opacity: 0 }}
              animate={{ bottom: '90%', scale: [0.5, 1.5, 1], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2, ease: 'easeOut' }}
              className="absolute text-6xl"
              style={{ position: 'fixed', left: `${40 + Math.random() * 20}vw` }}
            >
              {g.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div>
          <h3 className="text-white font-semibold font-display">Send a Gift</h3>
          <p className="text-white/50 text-xs mt-0.5">Your balance: <span className="text-yellow-400 font-medium">🪙 {(user?.coins || 0).toLocaleString()}</span></p>
        </div>
        <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition-colors">
          <FiX className="text-xl" />
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
              activeCategory === cat ? 'bg-brand-500 text-white' : 'bg-dark-700 text-white/50 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Gift grid */}
      <div className="overflow-y-auto px-4 pb-6" style={{ maxHeight: '40vh' }}>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 py-2">
            {filtered.map(gift => (
              <button
                key={gift.id}
                onClick={() => sendGift(gift)}
                disabled={sending === gift.id}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all hover:scale-105 active:scale-95 disabled:opacity-60 ${RARITY_COLORS[gift.rarity]}`}
              >
                <span className="text-2xl sm:text-3xl">{gift.emoji}</span>
                <span className="text-white/70 text-[10px] font-medium leading-tight text-center truncate w-full">{gift.name}</span>
                <span className={`text-[10px] font-bold ${RARITY_LABEL[gift.rarity]}`}>
                  🪙 {gift.coins.toLocaleString()}
                </span>
                {gift.rarity !== 'common' && (
                  <span className={`text-[9px] uppercase tracking-wide ${RARITY_LABEL[gift.rarity]}`}>{gift.rarity}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
