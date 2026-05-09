import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Effect configs — defines particle emoji, count, color, behaviour
const EFFECTS = {
  // Basic
  hearts:           { particles: ['❤️','💕','💖'], count: 10, spread: true,  size: 'sm', bg: null },
  thumbs_burst:     { particles: ['👍'],           count: 8,  spread: true,  size: 'sm', bg: null },
  clap_wave:        { particles: ['👏','⭐'],       count: 8,  spread: true,  size: 'sm', bg: null },
  candy_burst:      { particles: ['🍭','🍬','🎀'], count: 12, spread: true,  size: 'sm', bg: null },
  steam_rise:       { particles: ['☕','💨'],       count: 6,  spread: false, size: 'sm', bg: null },
  petals:           { particles: ['🌸','🌹','🌺'], count: 12, spread: true,  size: 'sm', bg: null },
  lips:             { particles: ['💋','❤️'],       count: 8,  spread: true,  size: 'sm', bg: null },
  stars:            { particles: ['⭐','✨','🌟'],  count: 12, spread: true,  size: 'sm', bg: null },
  balloon_float:    { particles: ['🎈','🎀'],       count: 8,  spread: true,  size: 'md', bg: null },
  confetti:         { particles: ['🎊','🎉','🎈'], count: 15, spread: true,  size: 'sm', bg: null },
  sparkle:          { particles: ['✨','💫','⭐'],  count: 12, spread: true,  size: 'sm', bg: null },
  petals_yellow:    { particles: ['🌻','🌼','⭐'],  count: 10, spread: true,  size: 'sm', bg: null },
  rainbow_hearts:   { particles: ['❤️','🧡','💛','💚','💙','💜'], count: 14, spread: true, size: 'sm', bg: 'rainbow' },
  butterfly_fly:    { particles: ['🦋'],            count: 8,  spread: true,  size: 'md', bg: null },

  // Premium
  flowers:          { particles: ['🌸','🌺','🌹','💐'], count: 14, spread: true, size: 'md', bg: null },
  neon_pulse:       { particles: ['💗','💓','💝'],  count: 10, spread: true,  size: 'md', bg: 'neon_pink' },
  crystal_glow:     { particles: ['🔮','✨','💫'],  count: 10, spread: true,  size: 'md', bg: 'purple_glow' },
  music_notes:      { particles: ['🎵','🎶','🎸'],  count: 10, spread: true,  size: 'md', bg: null },
  hearts_big:       { particles: ['💖','💝','💗'],  count: 12, spread: true,  size: 'lg', bg: null },
  sparkles:         { particles: ['💎','✨','💫'],  count: 14, spread: true,  size: 'md', bg: 'diamond_bg' },
  pixel_burst:      { particles: ['💝','⭐','🌟'],  count: 12, spread: true,  size: 'md', bg: 'pixel_bg' },
  music_wave:       { particles: ['🎻','🎵','🎶'],  count: 10, spread: true,  size: 'md', bg: null },
  golden_sparkle:   { particles: ['👑','✨','⭐'],  count: 14, spread: true,  size: 'lg', bg: 'gold_bg' },
  fireworks:        { particles: ['🎆','🎇','✨'],  count: 12, spread: true,  size: 'lg', bg: 'dark_flash' },
  rainbow_arc:      { particles: ['🌈','✨','🦄'],  count: 10, spread: true,  size: 'lg', bg: 'rainbow' },
  trophy_shine:     { particles: ['🏆','⭐','🌟'],  count: 10, spread: true,  size: 'lg', bg: 'gold_bg' },

  // Super / Epic
  shooting_star:    { particles: ['🌠','⭐','✨'],  count: 8,  spread: false, size: 'xl', bg: 'space_bg' },
  zoom:             { particles: ['🏎️','💨','⚡'], count: 6,  spread: false, size: 'xl', bg: null },
  phoenix_rise:     { particles: ['🦅','🔥','✨'],  count: 10, spread: true,  size: 'xl', bg: 'fire_bg' },
  supernova_blast:  { particles: ['💥','⭐','🌟'],  count: 16, spread: true,  size: 'xl', bg: 'orange_flash' },
  unicorn_magic:    { particles: ['🦄','🌈','✨','💫'], count: 14, spread: true, size: 'xl', bg: 'rainbow' },
  roar:             { particles: ['🦁','👑','⚡'],  count: 8,  spread: true,  size: 'xl', bg: 'golden_flash' },
  aurora_lights:    { particles: ['🌌','✨','💫'],  count: 12, spread: true,  size: 'xl', bg: 'aurora_bg' },
  waves:            { particles: ['🌊','🛥️','💦'], count: 8,  spread: true,  size: 'xl', bg: 'ocean_bg' },
  diamond_rain:     { particles: ['💎','💍','✨'],  count: 14, spread: true,  size: 'xl', bg: 'diamond_bg' },
  magic_spell:      { particles: ['🧙','🔮','✨','⭐'], count: 12, spread: true, size: 'xl', bg: 'purple_glow' },
  eruption:         { particles: ['🌋','🔥','💥'],  count: 12, spread: true,  size: 'xl', bg: 'fire_bg' },
  medieval:         { particles: ['🏰','⚔️','🛡️'], count: 8,  spread: true,  size: 'xl', bg: null },
  ufo_beam:         { particles: ['🛸','👽','⭐'],  count: 8,  spread: true,  size: 'xl', bg: 'space_bg' },
  launch:           { particles: ['🚀','🌟','💥'],  count: 10, spread: true,  size: 'xl', bg: 'space_bg' },
  dragon_fire:      { particles: ['🐉','🔥','💥'],  count: 12, spread: true,  size: 'xl', bg: 'fire_bg' },
  lightning_storm:  { particles: ['⚡','🌩️','💥'], count: 14, spread: true,  size: 'xl', bg: 'storm_bg' },
  black_hole_pull:  { particles: ['🌑','💫','⭐'],  count: 12, spread: true,  size: 'xl', bg: 'dark_vortex' },

  // Legendary
  fly:              { particles: ['✈️','🌟','☁️'], count: 8,  spread: false, size: 'xxl', bg: 'sky_bg' },
  neon_city_glow:   { particles: ['🌃','✨','💫'],  count: 12, spread: true,  size: 'xxl', bg: 'neon_city_bg' },
  time_warp:        { particles: ['⏳','🌀','✨'],  count: 12, spread: true,  size: 'xxl', bg: 'vortex_bg' },
  tropical:         { particles: ['🏝️','🌴','🌊'], count: 10, spread: true,  size: 'xxl', bg: 'tropical_bg' },
  deity_aura:       { particles: ['🌟','✨','👼','💫'], count: 16, spread: true, size: 'xxl', bg: 'gold_aura' },
  galaxy_explosion: { particles: ['🌌','💫','⭐','✨'], count: 20, spread: true, size: 'xxl', bg: 'galaxy_bg' },
  angel_wings:      { particles: ['👼','✨','🌟','💫'], count: 14, spread: true, size: 'xxl', bg: 'heavenly_bg' },
  universe_blast:   { particles: ['🌍','🌌','💥','⭐'], count: 20, spread: true, size: 'xxl', bg: 'universe_bg' },
  godmode_explosion:{ particles: ['✨','💥','🌟','👑','⚡'], count: 30, spread: true, size: 'xxl', bg: 'godmode_bg' },
};

// Background flash configs
const BG_EFFECTS = {
  neon_pink:      'radial-gradient(ellipse at center, rgba(247,37,133,0.6) 0%, transparent 70%)',
  purple_glow:    'radial-gradient(ellipse at center, rgba(123,45,139,0.7) 0%, transparent 70%)',
  diamond_bg:     'radial-gradient(ellipse at center, rgba(144,224,239,0.5) 0%, transparent 70%)',
  gold_bg:        'radial-gradient(ellipse at center, rgba(255,214,10,0.5) 0%, transparent 70%)',
  gold_aura:      'radial-gradient(ellipse at center, rgba(255,214,10,0.7) 0%, rgba(255,150,0,0.4) 40%, transparent 70%)',
  dark_flash:     'radial-gradient(ellipse at center, rgba(255,89,94,0.5) 0%, transparent 70%)',
  rainbow:        'linear-gradient(135deg, rgba(255,0,128,0.3), rgba(255,140,0,0.3), rgba(0,200,100,0.3), rgba(0,140,255,0.3))',
  fire_bg:        'radial-gradient(ellipse at center, rgba(214,40,40,0.6) 0%, rgba(255,150,0,0.3) 50%, transparent 70%)',
  orange_flash:   'radial-gradient(ellipse at center, rgba(255,159,28,0.7) 0%, transparent 70%)',
  golden_flash:   'radial-gradient(ellipse at center, rgba(255,214,10,0.6) 0%, transparent 70%)',
  aurora_bg:      'linear-gradient(180deg, rgba(0,200,150,0.4), rgba(76,201,240,0.4), rgba(123,45,139,0.4))',
  ocean_bg:       'radial-gradient(ellipse at center, rgba(0,119,182,0.5) 0%, transparent 70%)',
  space_bg:       'radial-gradient(ellipse at center, rgba(36,0,70,0.8) 0%, rgba(67,97,238,0.4) 50%, transparent 70%)',
  storm_bg:       'radial-gradient(ellipse at center, rgba(50,50,80,0.8) 0%, rgba(255,214,10,0.2) 50%, transparent 70%)',
  dark_vortex:    'radial-gradient(ellipse at center, rgba(0,0,0,0.9) 0%, rgba(36,0,70,0.6) 50%, transparent 70%)',
  sky_bg:         'linear-gradient(180deg, rgba(100,180,255,0.4), rgba(200,230,255,0.2))',
  neon_city_bg:   'radial-gradient(ellipse at center, rgba(247,37,133,0.5) 0%, rgba(67,97,238,0.4) 50%, transparent 70%)',
  vortex_bg:      'radial-gradient(ellipse at center, rgba(123,45,139,0.7) 0%, rgba(67,97,238,0.4) 50%, transparent 70%)',
  tropical_bg:    'radial-gradient(ellipse at center, rgba(6,214,160,0.5) 0%, rgba(255,214,10,0.3) 50%, transparent 70%)',
  galaxy_bg:      'radial-gradient(ellipse at center, rgba(36,0,70,0.9) 0%, rgba(67,97,238,0.5) 50%, transparent 70%)',
  heavenly_bg:    'radial-gradient(ellipse at center, rgba(255,255,255,0.7) 0%, rgba(200,220,255,0.4) 50%, transparent 70%)',
  universe_bg:    'radial-gradient(ellipse at center, rgba(116,0,184,0.8) 0%, rgba(36,0,70,0.6) 50%, transparent 70%)',
  godmode_bg:     'radial-gradient(ellipse at center, rgba(255,214,10,0.9) 0%, rgba(255,0,128,0.5) 40%, rgba(116,0,184,0.4) 70%, transparent 90%)',
  pixel_bg:       'radial-gradient(ellipse at center, rgba(255,77,109,0.5) 0%, transparent 70%)',
};

const SIZES = { sm: 'text-2xl', md: 'text-3xl', lg: 'text-4xl', xl: 'text-5xl', xxl: 'text-7xl' };
const RARITY_COLORS = {
  common:    'text-gray-300 bg-dark-700/80',
  rare:      'text-blue-300 bg-blue-900/60 border border-blue-400/30',
  epic:      'text-purple-300 bg-purple-900/60 border border-purple-400/40',
  legendary: 'text-yellow-300 bg-yellow-900/60 border border-yellow-400/50',
};

function Particle({ emoji, index, total, spread, sizeClass, color, rarity }) {
  const angle  = spread ? (index / total) * 360 : (index * 30) - 60;
  const dist   = rarity === 'legendary' ? 180 : rarity === 'epic' ? 130 : 90;
  const x      = Math.cos((angle * Math.PI) / 180) * (dist + Math.random() * 40);
  const y      = Math.sin((angle * Math.PI) / 180) * (dist + Math.random() * 40);
  const delay  = index * 0.04;
  const rotate = Math.random() * 720 - 360;

  return (
    <motion.span
      className={`absolute ${sizeClass} pointer-events-none select-none`}
      style={{ filter: color ? `drop-shadow(0 0 6px ${color})` : undefined }}
      initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
      animate={{ x, y: y - 80, scale: [0, 1.4, 1], opacity: [0, 1, 1, 0], rotate }}
      transition={{ duration: rarity === 'legendary' ? 1.8 : 1.3, delay, ease: 'easeOut' }}
    >
      {emoji}
    </motion.span>
  );
}

export default function GiftEffect({ gift, onDone }) {
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef(null);

  const cfg     = EFFECTS[gift?.giftEffect] || { particles: [gift?.giftEmoji || '🎁'], count: 6, spread: true, size: 'md', bg: null };
  const bgStyle = cfg.bg && BG_EFFECTS[cfg.bg] ? BG_EFFECTS[cfg.bg] : null;
  const sizeClass = SIZES[cfg.size] || SIZES.md;
  const rarity  = gift?.giftRarity || 'common';
  const isLegendary = rarity === 'legendary';
  const isEpic = rarity === 'epic';
  const duration = isLegendary ? 3500 : isEpic ? 2800 : 2200;

  useEffect(() => {
    timeoutRef.current = setTimeout(() => { setVisible(false); setTimeout(onDone, 400); }, duration);
    return () => clearTimeout(timeoutRef.current);
  }, []);

  // Build particle array — mix emojis
  const particles = Array.from({ length: cfg.count }, (_, i) => ({
    emoji: cfg.particles[i % cfg.particles.length],
    id: i,
  }));

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden flex items-center justify-center">
          {/* Background flash */}
          {bgStyle && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6, 0] }}
              transition={{ duration: duration / 1000, ease: 'easeInOut' }}
              style={{ background: bgStyle }}
            />
          )}

          {/* Screen edge glow for legendary */}
          {isLegendary && (
            <motion.div
              className="absolute inset-0 rounded-none"
              initial={{ boxShadow: 'inset 0 0 0px transparent' }}
              animate={{ boxShadow: ['inset 0 0 0px transparent', `inset 0 0 120px ${gift?.color || '#ffd60a'}88`, 'inset 0 0 0px transparent'] }}
              transition={{ duration: duration / 1000 }}
            />
          )}

          {/* Central gift burst */}
          <div className="relative flex flex-col items-center">
            {/* Particles */}
            {particles.map((p) => (
              <Particle
                key={p.id}
                emoji={p.emoji}
                index={p.id}
                total={cfg.count}
                spread={cfg.spread}
                sizeClass={sizeClass}
                color={gift?.color}
                rarity={rarity}
              />
            ))}

            {/* Main gift emoji */}
            <motion.div
              className="relative flex flex-col items-center gap-3"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: [0, 1.6, 1.3, 1.4], rotate: [- 20, 10, -5, 0] }}
              transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {/* Outer glow ring */}
              {(isEpic || isLegendary) && (
                <motion.div
                  className="absolute rounded-full"
                  style={{ width: '110%', height: '110%', top: '-5%', left: '-5%',
                    background: `radial-gradient(circle, ${gift?.color || '#ffd60a'}44 0%, transparent 70%)` }}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0.3, 0.8] }}
                  transition={{ duration: 1, repeat: 3 }}
                />
              )}

              <span className={`${
                isLegendary ? 'text-[100px]' : isEpic ? 'text-[80px]' : 'text-[60px]'
              } select-none`}
                style={{ filter: gift?.color ? `drop-shadow(0 0 20px ${gift.color})` : undefined }}>
                {gift?.giftEmoji || '🎁'}
              </span>
            </motion.div>

            {/* Name + sender label */}
            <motion.div
              className="mt-4 text-center px-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: duration / 1000, delay: 0.3 }}
            >
              <div className={`text-sm font-bold font-display px-4 py-1.5 rounded-full ${RARITY_COLORS[rarity]}`}>
                <span className="opacity-70 font-normal">{gift?.senderName}</span>
                {' '}sent{' '}
                <span className="font-extrabold">{gift?.giftName}</span>
              </div>
              <div className="text-white/50 text-xs mt-1.5 flex items-center justify-center gap-1">
                🪙 <span className="font-semibold text-yellow-400">{(gift?.giftValue || 0).toLocaleString()}</span>
                {rarity !== 'common' && (
                  <span className={`ml-1 uppercase text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded-full ${RARITY_COLORS[rarity]}`}>
                    {rarity}
                  </span>
                )}
              </div>
            </motion.div>
          </div>

          {/* Extra burst for legendary — scattered big emojis across screen */}
          {isLegendary && particles.slice(0, 8).map((p, i) => (
            <motion.span key={`corner_${i}`}
              className="absolute text-4xl select-none"
              style={{
                left: `${10 + (i % 4) * 25}%`,
                top: `${15 + Math.floor(i / 4) * 60}%`,
                filter: `drop-shadow(0 0 12px ${gift?.color || '#ffd60a'})`,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0], rotate: [0, 360] }}
              transition={{ duration: 2, delay: 0.2 + i * 0.15, ease: 'easeInOut' }}
            >
              {p.emoji}
            </motion.span>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
