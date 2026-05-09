const router = require('express').Router();
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const { authenticateToken } = require('../middleware/auth');

// Constants
const COINS_PER_CONVERSION = 210;
const NAIRA_PER_CONVERSION = 1300;
const FIRST_WITHDRAWAL_MIN = 2500;
const SUBSEQUENT_WITHDRAWAL_MIN = 5000;
const MONTHLY_HOURS_MIN = 30;
const MONTHLY_MINUTES_MIN = MONTHLY_HOURS_MIN * 60;

function coinsToNaira(coins) {
  return Math.floor((coins / COINS_PER_CONVERSION) * NAIRA_PER_CONVERSION);
}

function resetMonthlyMinutesIfNeeded(user) {
  const now = new Date();
  const lastReset = new Date(user.lastMonthlyReset);
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    user.monthlyStreamMinutes = 0;
    user.lastMonthlyReset = now;
    return true;
  }
  return false;
}

// Get withdrawal eligibility + dashboard data
router.get('/eligibility', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    resetMonthlyMinutesIfNeeded(user);
    await user.save();

    const isFirstWithdrawal = user.withdrawalCount === 0;
    const minCoins = isFirstWithdrawal ? FIRST_WITHDRAWAL_MIN : SUBSEQUENT_WITHDRAWAL_MIN;
    const monthlyHoursDone = +(user.monthlyStreamMinutes / 60).toFixed(2);
    const monthlyHoursRequired = MONTHLY_HOURS_MIN;
    const coinsEarned = user.earningCoins;
    const nairaValue = coinsToNaira(coinsEarned);

    const canWithdraw =
      coinsEarned >= minCoins &&
      user.monthlyStreamMinutes >= MONTHLY_MINUTES_MIN;

    const reasons = [];
    if (coinsEarned < minCoins) {
      reasons.push(`Need ${minCoins.toLocaleString()} coins minimum (you have ${coinsEarned.toLocaleString()})`);
    }
    if (user.monthlyStreamMinutes < MONTHLY_MINUTES_MIN) {
      const hoursLeft = +(( MONTHLY_MINUTES_MIN - user.monthlyStreamMinutes) / 60).toFixed(1);
      reasons.push(`Need ${monthlyHoursRequired}h streaming this month (${hoursLeft}h remaining)`);
    }

    res.json({
      canWithdraw,
      reasons,
      isFirstWithdrawal,
      minCoins,
      coinsEarned,
      nairaValue,
      monthlyHoursDone,
      monthlyHoursRequired,
      totalStreamMinutes: user.totalStreamMinutes,
      withdrawalCount: user.withdrawalCount,
      totalWithdrawnCoins: user.totalWithdrawnCoins,
      totalWithdrawnNaira: coinsToNaira(user.totalWithdrawnCoins),
      conversionRate: `${COINS_PER_CONVERSION} coins = ₦${NAIRA_PER_CONVERSION.toLocaleString()}`,
      bankDetails: user.bankDetails,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch eligibility' });
  }
});

// Save bank details
router.put('/bank-details', authenticateToken, async (req, res) => {
  try {
    const { accountName, accountNumber, bankName, bankCode } = req.body;
    if (!accountName || !accountNumber || !bankName) {
      return res.status(400).json({ error: 'All bank fields required' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { bankDetails: { accountName, accountNumber, bankName, bankCode } },
      { new: true }
    ).select('bankDetails');
    res.json({ message: 'Bank details saved', bankDetails: user.bankDetails });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save bank details' });
  }
});

// Request withdrawal
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const coinsToWithdraw = parseInt(req.body?.coinsToWithdraw);
    if (!Number.isFinite(coinsToWithdraw) || coinsToWithdraw <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    resetMonthlyMinutesIfNeeded(user);

    const isFirstWithdrawal = user.withdrawalCount === 0;
    const minCoins = isFirstWithdrawal ? FIRST_WITHDRAWAL_MIN : SUBSEQUENT_WITHDRAWAL_MIN;

    // Validations
    if (!user.bankDetails?.accountNumber) {
      return res.status(400).json({ error: 'Please save your bank details first' });
    }
    if (user.monthlyStreamMinutes < MONTHLY_MINUTES_MIN) {
      const hoursLeft = +((MONTHLY_MINUTES_MIN - user.monthlyStreamMinutes) / 60).toFixed(1);
      return res.status(400).json({ error: `You need ${hoursLeft}h more streaming this month to be eligible` });
    }
    if (coinsToWithdraw < minCoins) {
      return res.status(400).json({ error: `Minimum withdrawal is ${minCoins.toLocaleString()} coins` });
    }

    const nairaAmount = coinsToNaira(coinsToWithdraw);

    // Atomic deduct: only succeeds if balance is sufficient — protects against
    // concurrent withdrawal requests that would otherwise race on the read.
    const debited = await User.findOneAndUpdate(
      { _id: user._id, earningCoins: { $gte: coinsToWithdraw } },
      {
        $inc: {
          earningCoins:        -coinsToWithdraw,
          totalWithdrawnCoins:  coinsToWithdraw,
          withdrawalCount:      1,
        },
      },
      { new: true }
    );
    if (!debited) {
      return res.status(400).json({ error: 'Insufficient earning coins' });
    }

    const withdrawal = await new Withdrawal({
      userId: user._id,
      coinsRequested: coinsToWithdraw,
      nairaAmount,
      status: 'pending',
      bankDetails: { ...user.bankDetails.toObject() },
      isFirstWithdrawal,
      monthlyMinutesMet: user.monthlyStreamMinutes,
    }).save();

    res.json({
      message: 'Withdrawal request submitted successfully!',
      withdrawal: {
        id: withdrawal._id,
        coinsRequested: withdrawal.coinsRequested,
        nairaAmount: withdrawal.nairaAmount,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
      },
      remainingCoins: debited.earningCoins,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Withdrawal request failed' });
  }
});

// Get withdrawal history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(withdrawals);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
module.exports.coinsToNaira = coinsToNaira;
