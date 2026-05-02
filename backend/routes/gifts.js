const router = require('express').Router();
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Gift catalog - all BIGO-style gifts with effects
const GIFTS = [
  // Common (1-10 coins)
  { id: 'like', name: 'Like', emoji: '❤️', coins: 1, rarity: 'common', effect: 'hearts', category: 'basic', description: 'Show some love!' },
  { id: 'rose', name: 'Rose', emoji: '🌹', coins: 5, rarity: 'common', effect: 'petals', category: 'basic', description: 'A beautiful rose' },
  { id: 'kiss', name: 'Kiss', emoji: '💋', coins: 5, rarity: 'common', effect: 'lips', category: 'basic', description: 'Send a kiss' },
  { id: 'star', name: 'Star', emoji: '⭐', coins: 5, rarity: 'common', effect: 'stars', category: 'basic', description: 'You are a star!' },
  { id: 'cake', name: 'Cake', emoji: '🎂', coins: 10, rarity: 'common', effect: 'confetti', category: 'basic', description: 'Celebrate!' },
  { id: 'ice_cream', name: 'Ice Cream', emoji: '🍦', coins: 10, rarity: 'common', effect: 'sparkle', category: 'basic', description: 'Sweet treat' },

  // Rare (50-200 coins)
  { id: 'bouquet', name: 'Bouquet', emoji: '💐', coins: 50, rarity: 'rare', effect: 'flowers', category: 'premium', description: 'Bouquet of flowers' },
  { id: 'teddy', name: 'Teddy Bear', emoji: '🧸', coins: 99, rarity: 'rare', effect: 'hearts_big', category: 'premium', description: 'Adorable teddy bear' },
  { id: 'ring', name: 'Ring', emoji: '💍', coins: 100, rarity: 'rare', effect: 'sparkles', category: 'premium', description: 'A precious ring' },
  { id: 'guitar', name: 'Guitar', emoji: '🎸', coins: 100, rarity: 'rare', effect: 'music_notes', category: 'premium', description: 'Rock on!' },
  { id: 'crown', name: 'Crown', emoji: '👑', coins: 199, rarity: 'rare', effect: 'golden_sparkle', category: 'premium', description: 'You are royalty' },

  // Epic (500-2000 coins)
  { id: 'sports_car', name: 'Sports Car', emoji: '🏎️', coins: 500, rarity: 'epic', effect: 'zoom', category: 'super', description: 'Vroom vroom!' },
  { id: 'yacht', name: 'Yacht', emoji: '🛥️', coins: 1000, rarity: 'epic', effect: 'waves', category: 'super', description: 'Luxury yacht' },
  { id: 'diamond', name: 'Diamond', emoji: '💎', coins: 1000, rarity: 'epic', effect: 'diamond_rain', category: 'super', description: 'Diamonds are forever' },
  { id: 'castle', name: 'Castle', emoji: '🏰', coins: 1500, rarity: 'epic', effect: 'medieval', category: 'super', description: 'A royal castle' },
  { id: 'rocket', name: 'Rocket', emoji: '🚀', coins: 2000, rarity: 'epic', effect: 'launch', category: 'super', description: 'To the moon!' },

  // Legendary (5000-50000 coins)
  { id: 'private_jet', name: 'Private Jet', emoji: '✈️', coins: 5000, rarity: 'legendary', effect: 'fly', category: 'legendary', description: 'Fly in luxury' },
  { id: 'island', name: 'Island', emoji: '🏝️', coins: 10000, rarity: 'legendary', effect: 'tropical', category: 'legendary', description: 'Your own island' },
  { id: 'galaxy', name: 'Galaxy', emoji: '🌌', coins: 20000, rarity: 'legendary', effect: 'galaxy_explosion', category: 'legendary', description: 'Out of this world' },
  { id: 'universe', name: 'Universe', emoji: '🌍', coins: 50000, rarity: 'legendary', effect: 'universe_blast', category: 'legendary', description: 'The ultimate gift!' },

  // Special
  { id: 'fireworks', name: 'Fireworks', emoji: '🎆', coins: 199, rarity: 'rare', effect: 'fireworks', category: 'special', description: 'Celebrate big!' },
  { id: 'rainbow', name: 'Rainbow', emoji: '🌈', coins: 299, rarity: 'rare', effect: 'rainbow_arc', category: 'special', description: 'A colorful rainbow' },
  { id: 'shooting_star', name: 'Shooting Star', emoji: '🌠', coins: 499, rarity: 'epic', effect: 'shooting_star', category: 'special', description: 'Make a wish!' },
  { id: 'lion', name: 'Lion', emoji: '🦁', coins: 999, rarity: 'epic', effect: 'roar', category: 'special', description: 'King of the jungle' },
  { id: 'dragon', name: 'Dragon', emoji: '🐉', coins: 2999, rarity: 'legendary', effect: 'dragon_fire', category: 'special', description: 'Breathe fire!' },
];

router.get('/', (req, res) => {
  res.json(GIFTS);
});

router.get('/categories', (req, res) => {
  const categories = ['basic', 'premium', 'super', 'legendary', 'special'];
  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = GIFTS.filter(g => g.category === cat);
    return acc;
  }, {});
  res.json(grouped);
});

// Send a gift (deduct coins)
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { giftId, streamId, quantity = 1 } = req.body;
    const gift = GIFTS.find(g => g.id === giftId);
    if (!gift) return res.status(404).json({ error: 'Gift not found' });

    const totalCost = gift.coins * quantity;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.coins < totalCost) return res.status(400).json({ error: 'Insufficient coins' });

    await User.findByIdAndUpdate(req.user.userId, { $inc: { coins: -totalCost } });

    res.json({ success: true, coinsDeducted: totalCost, remainingCoins: user.coins - totalCost, gift });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send gift' });
  }
});

module.exports = router;
module.exports.GIFTS = GIFTS;
