import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EFFECT_CONFIGS = {
  hearts: { particles: '❤️', count: 8, spread: true },
  petals: { particles: '🌸', count: 10, spread: true },
  stars: { particles: '⭐', count: 12, spread: true },
  confetti: { particles: '🎊', count: 15, spread: true },
  sparkle: { particles: '✨', count: 12, spread: true },
  flowers: { particles: '🌺', count: 10, spread: true },
  hearts_big: { particles: '💖', count: 10, spread: true },
  sparkles: { particles: '💫', count: 12, spread: true },
  music_notes: { particles: '🎵', count: 8, spread: true },
  golden_sparkle: { particles: '✨', count: 15, spread: true, color: '#FFD700' },
  zoom: { particles: '💨', count: 6, spread: false },
  waves: { particles: '🌊', count: 8, spread: true },
  diamond_rain: { particles: '💎', count: 10, spread: true },
  medieval: { particles: '⚔️', count: 6, spread: true },
  launch: { particles: '🚀', count: 4, spread: false },
  fly: { particles: '✈️', count: 3, spread: false },
  tropical: { particles: '🌴', count: 8, spread: true },
  galaxy_explosion: { particles: '🌌', count: 1, spread: false, large: true },
  universe_blast: { particles: '💥', count: 1, spread: false, large: true },
  fireworks: { particles: '🎆', count: 6, spread: true },
  rainbow_arc: { particles: '🌈', count: 1, spread: false, large: true },
  shooting_star: { particles: '🌠', count: 3, spread: false },
  roar: { particles: '🦁', count: 1, spread: false, large: true },
  dragon_fire: { particles: '🔥', count: 10, spread: true },
  lips: { particles: '💋', count: 6, spread: true },
};

function Particle({ emoji, index, count, large }) {
  const angle = (index / count) * 360;
  const distance = large ? 0 : 80 + Math.random() * 60;
  const x = Math.cos((angle * Math.PI) / 180) * distance;
  const y = Math.sin((angle * Math.PI) / 180) * distance;
  const delay = Math.random() * 0.3;
  const size = large ? 'text-7xl' : 'text-2xl';

  return (
    <motion.div
      className={`absolute ${size} pointer-events-none`}
      initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
      animate={{ x, y: y - 100, scale: large ? [0, 1.5, 1] : [0, 1.2, 1], opacity: [0, 1, 1, 0] }}
      transition={{ duration: large ? 1.5 : 1.2, delay, ease: 'easeOut' }}
    >
      {emoji}
    </motion.div>
  );
}

export default function GiftEffect({ gift, onDone }) {
  const effect = EFFECT_CONFIGS[gift?.giftEffect] || { particles: gift?.giftEmoji || '🎁', count: 6, spread: true };
  const { particles, count, large } = effect;

  useEffect(() => {
    const timer = setTimeout(onDone, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-[200]">
      {/* Dark overlay for legendary */}
      {(gift?.giftRarity === 'legendary' || gift?.giftRarity === 'epic') && (
        <motion.div
          className="absolute inset-0 bg-black/30"
          initial={{ opacity: 0 }} animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 1.5 }}
        />
      )}

      {/* Main gift display */}
      <div className="relative flex flex-col items-center">
        <motion.div
          className="relative"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: [0, 1.5, 1.2], rotate: [- 20, 10, 0] }}
          transition={{ duration: 0.6, ease: 'backOut' }}
        >
          <span className={`${large ? 'text-[120px]' : 'text-[80px]'}`}>{particles}</span>
          {/* Particles burst */}
          {Array.from({ length: count }).map((_, i) => (
            <Particle key={i} emoji={particles} index={i} count={count} large={false} />
          ))}
        </motion.div>

        {/* Gift name + sender */}
        <motion.div
          className="mt-4 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2, delay: 0.3 }}
        >
          <div className={`text-lg font-bold font-display px-4 py-1 rounded-full ${
            gift?.giftRarity === 'legendary' ? 'text-yellow-400 bg-yellow-900/40 border border-yellow-500/40' :
            gift?.giftRarity === 'epic' ? 'text-purple-300 bg-purple-900/40 border border-purple-500/40' :
            gift?.giftRarity === 'rare' ? 'text-blue-300 bg-blue-900/40' :
            'text-white bg-black/40'
          }`}>
            {gift?.senderName} sent <span className="font-bold">{gift?.giftName}</span>
          </div>
          <div className="text-white/60 text-sm mt-1">🪙 {(gift?.giftValue || 0).toLocaleString()}</div>
        </motion.div>
      </div>

      {/* Extra effects for legendary */}
      {gift?.giftRarity === 'legendary' && (
        <>
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-2xl pointer-events-none"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], y: -200 }}
              transition={{ duration: 2, delay: Math.random() * 1, ease: 'easeOut' }}
            >
              ✨
            </motion.div>
          ))}
        </>
      )}
    </div>
  );
}
