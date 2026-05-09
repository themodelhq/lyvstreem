import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiX, FiInfo } from 'react-icons/fi';

const RARITY_BORDER = {
  common:    'border-white/10 bg-dark-700/50',
  rare:      'border-blue-500/30 bg-blue-900/20',
  epic:      'border-purple-500/30 bg-purple-900/20',
  legendary: 'border-yellow-500/40 bg-yellow-900/20',
};
const RARITY_LABEL = {
  common:    'text-gray-400',
  rare:      'text-blue-400',
  epic:      'text-purple-400',
  legendary: 'text-yellow-400',
};
const RARITY_GLOW = {
  common:    '',
  rare:      'hover:shadow-lg hover:shadow-blue-500/20',
  epic:      'hover:shadow-xl hover:shadow-purple-500/30',
  legendary: 'hover:shadow-2xl hover:shadow-yellow-500/40',
};
const CATEGORIES = ['All', 'basic', 'premium', 'super', 'legendary'];
const CATEGORY_LABELS = { All: '🌟 All', basic: '💝 Basic', premium: '💎 Premium', super: '🔥 Super', legendary: '👑 Legendary' };

export default function GiftPanel({ streamId, onClose }) {
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [sending, setSending] = useState(null);
  const [flyingGifts, setFlyingGifts] = useState([]);
  const [hoveredGift, setHoveredGift] = useState(null);

  useEffect(() => {
    api.get('/gifts').then(res => { setGifts(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = activeCategory === 'All' ? gifts : gifts.filter(g => g.category === activeCategory);

  const sendGift = async (gift) => {
    if (!user) { toast.error('Sign in to send gifts'); return; }
    if ((user.coins || 0) < gift.coins) { toast.error('Not enough coins!'); return; }
    setSending(gift.id);
    try {
      const res = await api.post('/gifts/send', { giftId: gift.id, streamId });
      updateUser({ coins: res.data.remainingCoins });

      // Flying animation
      const flyId = Date.now() + Math.random();
      setFlyingGifts(prev => [...prev, { ...gift, flyId }]);
      setTimeout(() => setFlyingGifts(prev => prev.filter(f => f.flyId !== flyId)), 2500);

      socket?.emit('send_gift', {
        streamId,
        giftId: gift.id,
        giftName: gift.name,
        giftEmoji: gift.emoji,
        giftValue: gift.coins,
        giftRarity: gift.rarity,
        giftEffect: gift.effect,
        giftColor: gift.color,
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
      className="absolute bottom-0 left-0 right-0 bg-dark-800/97 backdrop-blur-xl border-t border-white/10 rounded-t-2xl z-50"
      style={{ maxHeight: '65vh' }}
    >
      {/* Flying gifts overlay */}
      <div className="fixed bottom-0 left-0 right-0 pointer-events-none overflow-hidden z-[100]" style={{ height: '65vh' }}>
        <AnimatePresence>
          {flyingGifts.map(g => (
            <motion.div key={g.flyId}
              initial={{ bottom: '35%', opacity: 0, scale: 0.5 }}
              animate={{ bottom: '90%', scale: [0.5, 1.8, 1.2], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2.2, ease: 'easeOut' }}
              className="absolute text-5xl"
              style={{ position: 'fixed', left: `${35 + Math.random() * 30}vw`, filter: g.color ? `drop-shadow(0 0 12px ${g.color})` : undefined }}
            >
              {g.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div>
          <h3 className="text-white font-semibold font-display">Send a Gift</h3>
          <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
            Balance: <span className="text-yellow-400 font-semibold">🪙 {(user?.coins || 0).toLocaleString()}</span>
          </p>
        </div>
        <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition-colors"><FiX /></button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto scrollbar-none shrink-0">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              activeCategory === cat ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30' : 'bg-dark-700 text-white/50 hover:text-white'
            }`}>
            {CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Gift grid */}
      <div className="overflow-y-auto px-3 pb-4" style={{ maxHeight: '45vh' }}>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2 py-1">
            {filtered.map(gift => {
              const canAfford = (user?.coins || 0) >= gift.coins;
              return (
                <button
                  key={gift.id}
                  onClick={() => sendGift(gift)}
                  onMouseEnter={() => setHoveredGift(gift.id)}
                  onMouseLeave={() => setHoveredGift(null)}
                  disabled={sending === gift.id}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all
                    hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed
                    relative overflow-hidden group
                    ${RARITY_BORDER[gift.rarity]} ${RARITY_GLOW[gift.rarity]}
                    ${!canAfford ? 'opacity-50' : ''}
                  `}
                >
                  {/* Color glow bg on hover */}
                  {gift.color && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity rounded-xl"
                      style={{ background: `radial-gradient(circle, ${gift.color}, transparent)` }} />
                  )}

                  {/* Sending spinner */}
                  {sending === gift.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl z-10">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {/* Emoji */}
                  <span className="text-2xl sm:text-3xl relative z-10 transition-transform group-hover:scale-110"
                    style={{ filter: gift.color ? `drop-shadow(0 0 4px ${gift.color}88)` : undefined }}>
                    {gift.emoji}
                  </span>

                  {/* Name */}
                  <span className="text-white/70 text-[9px] font-medium leading-tight text-center truncate w-full relative z-10">
                    {gift.name}
                  </span>

                  {/* Price */}
                  <span className={`text-[9px] font-bold relative z-10 ${RARITY_LABEL[gift.rarity]}`}>
                    🪙 {gift.coins.toLocaleString()}
                  </span>

                  {/* Rarity badge for non-common */}
                  {gift.rarity !== 'common' && (
                    <span className={`text-[8px] uppercase tracking-wide font-bold ${RARITY_LABEL[gift.rarity]} relative z-10`}>
                      {gift.rarity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
