const router = require('express').Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authenticateToken } = require('../middleware/auth');

// Coin packages
const COIN_PACKAGES = [
  { id: 'starter', coins: 100, amount: 50000, label: '100 Coins', bonus: 0, popular: false },       // ₦500
  { id: 'basic', coins: 270, amount: 100000, label: '250 + 20 Bonus', bonus: 20, popular: false },    // ₦1,000
  { id: 'popular', coins: 580, amount: 200000, label: '500 + 80 Bonus', bonus: 80, popular: true },   // ₦2,000
  { id: 'value', coins: 1200, amount: 400000, label: '1000 + 200 Bonus', bonus: 200, popular: false }, // ₦4,000
  { id: 'premium', coins: 3200, amount: 1000000, label: '2500 + 700 Bonus', bonus: 700, popular: false }, // ₦10,000
  { id: 'elite', coins: 7000, amount: 2000000, label: '5000 + 2000 Bonus', bonus: 2000, popular: false }, // ₦20,000
];

router.get('/packages', (req, res) => {
  res.json(COIN_PACKAGES);
});

// Initialize Paystack transaction
router.post('/initialize', authenticateToken, async (req, res) => {
  try {
    const { packageId } = req.body;
    const pkg = COIN_PACKAGES.find(p => p.id === packageId);
    if (!pkg) return res.status(400).json({ error: 'Invalid package' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const reference = `LYVSTREEM-${uuidv4()}`;

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.email,
        amount: pkg.amount,
        reference,
        currency: 'NGN',
        metadata: {
          userId: user._id.toString(),
          packageId,
          coins: pkg.coins,
          username: user.username,
        },
        callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Save pending transaction
    await new Transaction({
      userId: user._id,
      reference,
      amount: pkg.amount,
      coins: pkg.coins,
      status: 'pending',
      metadata: { packageId, label: pkg.label },
    }).save();

    res.json({
      authorization_url: response.data.data.authorization_url,
      reference,
      access_code: response.data.data.access_code,
    });
  } catch (error) {
    console.error('Paystack init error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// Verify transaction
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) return res.status(400).json({ error: 'Reference required' });

    const transaction = await Transaction.findOne({ reference, userId: req.user.userId });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    if (transaction.status === 'success') return res.json({ message: 'Already credited', coins: transaction.coins });

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const data = response.data.data;
    if (data.status === 'success' && data.amount === transaction.amount) {
      transaction.status = 'success';
      transaction.paystackId = data.id.toString();
      await transaction.save();

      const user = await User.findByIdAndUpdate(
        req.user.userId,
        { $inc: { coins: transaction.coins } },
        { new: true }
      );

      res.json({ success: true, coinsAdded: transaction.coins, totalCoins: user.coins });
    } else {
      transaction.status = 'failed';
      await transaction.save();
      res.status(400).json({ error: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Verify error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Transaction history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
