const router = require('express').Router();
const User   = require('../models/User');
const Stream = require('../models/Stream');
const { authenticateToken } = require('../middleware/auth');

// Revenue split constants
const HOST_SHARE   = 0.65;  // host gets 65%
const HOUSE_SHARE  = 0.35;  // platform keeps 35%

const GIFTS = [
  // ── BASIC (1–15 coins) ────────────────────────────────────────────────────
  { id: 'like',         name: 'Like',          emoji: '❤️',  coins: 1,      rarity: 'common',    effect: 'hearts',           category: 'basic',     color: '#ff4d6d', description: 'Show some love!' },
  { id: 'thumbs_up',    name: 'Thumbs Up',     emoji: '👍',  coins: 1,      rarity: 'common',    effect: 'thumbs_burst',     category: 'basic',     color: '#ffd60a', description: 'Great content!' },
  { id: 'clap',         name: 'Applause',      emoji: '👏',  coins: 2,      rarity: 'common',    effect: 'clap_wave',        category: 'basic',     color: '#ffb703', description: 'Standing ovation!' },
  { id: 'lollipop',     name: 'Lollipop',      emoji: '🍭',  coins: 3,      rarity: 'common',    effect: 'candy_burst',      category: 'basic',     color: '#ff70a6', description: 'Sweet vibes!' },
  { id: 'coffee',       name: 'Coffee',        emoji: '☕',  coins: 5,      rarity: 'common',    effect: 'steam_rise',       category: 'basic',     color: '#a0522d', description: 'Keep streaming!' },
  { id: 'rose',         name: 'Rose',          emoji: '🌹',  coins: 5,      rarity: 'common',    effect: 'petals',           category: 'basic',     color: '#e63946', description: 'A beautiful rose' },
  { id: 'kiss',         name: 'Kiss',          emoji: '💋',  coins: 5,      rarity: 'common',    effect: 'lips',             category: 'basic',     color: '#ff006e', description: 'Send a kiss' },
  { id: 'star',         name: 'Star',          emoji: '⭐',  coins: 5,      rarity: 'common',    effect: 'stars',            category: 'basic',     color: '#ffd60a', description: 'You are a star!' },
  { id: 'balloon',      name: 'Balloon',       emoji: '🎈',  coins: 8,      rarity: 'common',    effect: 'balloon_float',    category: 'basic',     color: '#ff595e', description: 'Float on up!' },
  { id: 'cake',         name: 'Cake',          emoji: '🎂',  coins: 10,     rarity: 'common',    effect: 'confetti',         category: 'basic',     color: '#fb8b24', description: 'Celebrate!' },
  { id: 'ice_cream',    name: 'Ice Cream',     emoji: '🍦',  coins: 10,     rarity: 'common',    effect: 'sparkle',          category: 'basic',     color: '#90e0ef', description: 'Sweet treat' },
  { id: 'sunflower',    name: 'Sunflower',     emoji: '🌻',  coins: 10,     rarity: 'common',    effect: 'petals_yellow',    category: 'basic',     color: '#ffd166', description: 'Bright like you!' },
  { id: 'rainbow_heart',name: 'Rainbow Heart', emoji: '🌈',  coins: 15,     rarity: 'common',    effect: 'rainbow_hearts',   category: 'basic',     color: '#06d6a0', description: 'Colorful love!' },
  { id: 'butterfly',    name: 'Butterfly',     emoji: '🦋',  coins: 15,     rarity: 'common',    effect: 'butterfly_fly',    category: 'basic',     color: '#4cc9f0', description: 'Flutter away!' },

  // ── PREMIUM (50–299 coins) ────────────────────────────────────────────────
  { id: 'bouquet',      name: 'Bouquet',       emoji: '💐',  coins: 50,     rarity: 'rare',      effect: 'flowers',          category: 'premium',   color: '#f72585', description: 'Bouquet of flowers' },
  { id: 'neon_heart',   name: 'Neon Heart',    emoji: '💗',  coins: 59,     rarity: 'rare',      effect: 'neon_pulse',       category: 'premium',   color: '#ff006e', description: 'Glowing with love' },
  { id: 'crystal_ball', name: 'Crystal Ball',  emoji: '🔮',  coins: 75,     rarity: 'rare',      effect: 'crystal_glow',     category: 'premium',   color: '#7b2d8b', description: 'See the future!' },
  { id: 'guitar',       name: 'Guitar',        emoji: '🎸',  coins: 80,     rarity: 'rare',      effect: 'music_notes',      category: 'premium',   color: '#8338ec', description: 'Rock on!' },
  { id: 'teddy',        name: 'Teddy Bear',    emoji: '🧸',  coins: 99,     rarity: 'rare',      effect: 'hearts_big',       category: 'premium',   color: '#c77dff', description: 'Adorable teddy bear' },
  { id: 'ring',         name: 'Diamond Ring',  emoji: '💍',  coins: 100,    rarity: 'rare',      effect: 'sparkles',         category: 'premium',   color: '#a8dadc', description: 'A precious ring' },
  { id: 'pixel_heart',  name: 'Pixel Heart',   emoji: '💝',  coins: 120,    rarity: 'rare',      effect: 'pixel_burst',      category: 'premium',   color: '#ff4d6d', description: 'Retro love!' },
  { id: 'violin',       name: 'Violin',        emoji: '🎻',  coins: 150,    rarity: 'rare',      effect: 'music_wave',       category: 'premium',   color: '#c77dff', description: 'Play me a tune!' },
  { id: 'crown',        name: 'Crown',         emoji: '👑',  coins: 199,    rarity: 'rare',      effect: 'golden_sparkle',   category: 'premium',   color: '#ffd60a', description: 'You are royalty' },
  { id: 'fireworks',    name: 'Fireworks',     emoji: '🎆',  coins: 199,    rarity: 'rare',      effect: 'fireworks',        category: 'premium',   color: '#ff595e', description: 'Celebrate big!' },
  { id: 'rainbow',      name: 'Rainbow',       emoji: '🌈',  coins: 299,    rarity: 'rare',      effect: 'rainbow_arc',      category: 'premium',   color: '#06d6a0', description: 'A colorful rainbow' },
  { id: 'trophy',       name: 'Trophy',        emoji: '🏆',  coins: 299,    rarity: 'rare',      effect: 'trophy_shine',     category: 'premium',   color: '#ffd60a', description: 'You are a champion!' },

  // ── SUPER (500–4999 coins) ────────────────────────────────────────────────
  { id: 'shooting_star',name: 'Shooting Star', emoji: '🌠',  coins: 499,    rarity: 'epic',      effect: 'shooting_star',    category: 'super',     color: '#4361ee', description: 'Make a wish!' },
  { id: 'sports_car',   name: 'Sports Car',    emoji: '🏎️', coins: 500,    rarity: 'epic',      effect: 'zoom',             category: 'super',     color: '#e63946', description: 'Vroom vroom!' },
  { id: 'phoenix',      name: 'Phoenix',       emoji: '🦅',  coins: 599,    rarity: 'epic',      effect: 'phoenix_rise',     category: 'super',     color: '#f77f00', description: 'Rise from the ashes!' },
  { id: 'supernova',    name: 'Supernova',     emoji: '💥',  coins: 699,    rarity: 'epic',      effect: 'supernova_blast',  category: 'super',     color: '#ff9f1c', description: 'Explode with energy!' },
  { id: 'unicorn',      name: 'Unicorn',       emoji: '🦄',  coins: 799,    rarity: 'epic',      effect: 'unicorn_magic',    category: 'super',     color: '#c77dff', description: 'Pure magic!' },
  { id: 'lion',         name: 'Lion',          emoji: '🦁',  coins: 999,    rarity: 'epic',      effect: 'roar',             category: 'super',     color: '#f4a261', description: 'King of the jungle' },
  { id: 'aurora',       name: 'Aurora',        emoji: '🌌',  coins: 1000,   rarity: 'epic',      effect: 'aurora_lights',    category: 'super',     color: '#4cc9f0', description: 'Northern lights!' },
  { id: 'yacht',        name: 'Yacht',         emoji: '🛥️', coins: 1000,   rarity: 'epic',      effect: 'waves',            category: 'super',     color: '#0077b6', description: 'Luxury yacht' },
  { id: 'diamond',      name: 'Diamond',       emoji: '💎',  coins: 1000,   rarity: 'epic',      effect: 'diamond_rain',     category: 'super',     color: '#90e0ef', description: 'Diamonds are forever' },
  { id: 'wizard',       name: 'Wizard',        emoji: '🧙',  coins: 1200,   rarity: 'epic',      effect: 'magic_spell',      category: 'super',     color: '#7b2d8b', description: 'Cast a spell!' },
  { id: 'volcano',      name: 'Volcano',       emoji: '🌋',  coins: 1500,   rarity: 'epic',      effect: 'eruption',         category: 'super',     color: '#e63946', description: 'Ready to erupt!' },
  { id: 'castle',       name: 'Castle',        emoji: '🏰',  coins: 1500,   rarity: 'epic',      effect: 'medieval',         category: 'super',     color: '#6d6875', description: 'A royal castle' },
  { id: 'spaceship',    name: 'Spaceship',     emoji: '🛸',  coins: 1800,   rarity: 'epic',      effect: 'ufo_beam',         category: 'super',     color: '#4cc9f0', description: 'Take me away!' },
  { id: 'rocket',       name: 'Rocket',        emoji: '🚀',  coins: 2000,   rarity: 'epic',      effect: 'launch',           category: 'super',     color: '#ff595e', description: 'To the moon!' },
  { id: 'dragon',       name: 'Dragon',        emoji: '🐉',  coins: 2999,   rarity: 'epic',      effect: 'dragon_fire',      category: 'super',     color: '#d62828', description: 'Breathe fire!' },
  { id: 'thunder_god',  name: 'Thunder God',   emoji: '⚡',  coins: 3500,   rarity: 'epic',      effect: 'lightning_storm',  category: 'super',     color: '#ffd60a', description: 'Wield the thunder!' },
  { id: 'black_hole',   name: 'Black Hole',    emoji: '🌑',  coins: 4500,   rarity: 'epic',      effect: 'black_hole_pull',  category: 'super',     color: '#240046', description: 'Consume everything!' },

  // ── LEGENDARY (5000–100000 coins) ────────────────────────────────────────
  { id: 'private_jet',  name: 'Private Jet',   emoji: '✈️',  coins: 5000,   rarity: 'legendary', effect: 'fly',              category: 'legendary', color: '#4361ee', description: 'Fly in luxury' },
  { id: 'neon_city',    name: 'Neon City',     emoji: '🌃',  coins: 6000,   rarity: 'legendary', effect: 'neon_city_glow',   category: 'legendary', color: '#f72585', description: 'City never sleeps!' },
  { id: 'time_machine', name: 'Time Machine',  emoji: '⏳',  coins: 7500,   rarity: 'legendary', effect: 'time_warp',        category: 'legendary', color: '#7b2d8b', description: 'Bend time itself!' },
  { id: 'island',       name: 'Island',        emoji: '🏝️', coins: 10000,  rarity: 'legendary', effect: 'tropical',         category: 'legendary', color: '#06d6a0', description: 'Your own island' },
  { id: 'deity',        name: 'Deity',         emoji: '🌟',  coins: 12000,  rarity: 'legendary', effect: 'deity_aura',       category: 'legendary', color: '#ffd60a', description: 'Ascend to godhood!' },
  { id: 'galaxy',       name: 'Galaxy',        emoji: '🌌',  coins: 20000,  rarity: 'legendary', effect: 'galaxy_explosion', category: 'legendary', color: '#4cc9f0', description: 'Out of this world' },
  { id: 'angel',        name: 'Angel',         emoji: '👼',  coins: 25000,  rarity: 'legendary', effect: 'angel_wings',      category: 'legendary', color: '#ffffff', description: 'Heavenly gift!' },
  { id: 'universe',     name: 'Universe',      emoji: '🌍',  coins: 50000,  rarity: 'legendary', effect: 'universe_blast',   category: 'legendary', color: '#7400b8', description: 'The ultimate gift!' },
  { id: 'god_mode',     name: 'God Mode',      emoji: '✨',  coins: 100000, rarity: 'legendary', effect: 'godmode_explosion', category: 'legendary', color: '#ffd60a', description: 'Absolute power!' },
];

router.get('/', (req, res) => res.json(GIFTS));

router.get('/categories', (req, res) => {
  const categories = ['basic', 'premium', 'super', 'legendary'];
  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = GIFTS.filter(g => g.category === cat);
    return acc;
  }, {});
  res.json(grouped);
});

// Send a gift — deduct coins from sender + credit host atomically
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { giftId, streamId, quantity = 1 } = req.body;
    const gift = GIFTS.find(g => g.id === giftId);
    if (!gift) return res.status(404).json({ error: 'Gift not found' });

    const qty = Math.max(1, Math.min(99, parseInt(quantity) || 1));
    const totalCost   = gift.coins * qty;
    const hostEarning = Math.floor(totalCost * HOST_SHARE);

    // Validate target stream + recipient host
    if (!streamId) return res.status(400).json({ error: 'streamId required' });
    const stream = await Stream.findById(streamId).select('streamerId');
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    if (stream.streamerId.toString() === req.user.userId) {
      return res.status(400).json({ error: 'Cannot gift yourself' });
    }

    // Atomic deduct: only succeeds if user has enough coins
    const debited = await User.findOneAndUpdate(
      { _id: req.user.userId, coins: { $gte: totalCost } },
      { $inc: { coins: -totalCost } },
      { new: true }
    );
    if (!debited) return res.status(400).json({ error: 'Insufficient coins' });

    // Credit host's earning wallet
    await User.findByIdAndUpdate(stream.streamerId, {
      $inc: {
        earningCoins:        hostEarning,
        totalEarningsCoins:  hostEarning,
        totalLikes:          1,
      },
    });

    res.json({
      success: true,
      coinsDeducted: totalCost,
      remainingCoins: debited.coins,
      hostEarning,
      houseCut: totalCost - hostEarning,
      gift,
    });
  } catch (error) {
    console.error('Gift send error:', error);
    res.status(500).json({ error: 'Failed to send gift' });
  }
});

module.exports = router;
module.exports.GIFTS = GIFTS;
module.exports.HOST_SHARE = HOST_SHARE;
module.exports.HOUSE_SHARE = HOUSE_SHARE;
