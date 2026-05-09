const router = require('express').Router();
const User = require('../models/User');
const Stream = require('../models/Stream');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// Get user profile
router.get('/:username', optionalAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('-password -email');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const streams = await Stream.find({ streamerId: user._id }).sort({ createdAt: -1 }).limit(10);
    const isFollowing = req.user ? user.followers.includes(req.user.userId) : false;

    res.json({ ...user.toObject(), streams, isFollowing });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update profile
router.put('/profile/update', authenticateToken, async (req, res) => {
  try {
    const { displayName, bio, avatar, coverImage } = req.body;
    const updated = await User.findByIdAndUpdate(
      req.user.userId,
      { displayName, bio, avatar, coverImage },
      { new: true }
    ).select('-password');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Follow / unfollow
router.post('/:userId/follow', authenticateToken, async (req, res) => {
  try {
    const targetId = req.params.userId;
    const myId = req.user.userId;
    if (targetId === myId) return res.status(400).json({ error: 'Cannot follow yourself' });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const isFollowing = target.followers.includes(myId);

    if (isFollowing) {
      await User.findByIdAndUpdate(targetId, { $pull: { followers: myId }, $inc: { totalFollowers: -1 } });
      await User.findByIdAndUpdate(myId, { $pull: { following: targetId }, $inc: { totalFollowing: -1 } });
      res.json({ following: false, message: 'Unfollowed' });
    } else {
      await User.findByIdAndUpdate(targetId, { $addToSet: { followers: myId }, $inc: { totalFollowers: 1 } });
      await User.findByIdAndUpdate(myId, { $addToSet: { following: targetId }, $inc: { totalFollowing: 1 } });
      res.json({ following: true, message: 'Followed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Follow action failed' });
  }
});

// Search users
router.get('/search/users', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const users = await User.find({
      $or: [
        { username: new RegExp(q, 'i') },
        { displayName: new RegExp(q, 'i') },
      ],
    }).select('-password -email').limit(20);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get user coins
router.get('/me/coins', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('coins');
    res.json({ coins: user.coins });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch coins' });
  }
});

// Leaderboard
router.get('/leaderboard/top', async (req, res) => {
  try {
    const streamers = await User.find({ isStreamer: true })
      .sort({ totalLikes: -1 })
      .limit(20)
      .select('-password -email');
    res.json(streamers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;

// ── Delete account ────────────────────────────────────────────────────────────
router.delete('/account/delete', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    const bcrypt = require('bcryptjs');
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify password before deletion
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Incorrect password' });

    // End any live streams
    const Stream = require('../models/Stream');
    const live = await Stream.find({ streamerId: user._id, isLive: true });
    for (const s of live) {
      await Stream.findByIdAndUpdate(s._id, { isLive: false, endedAt: new Date(), viewerCount: 0 });
      req.app.get('io')?.to(`stream_${s._id}`).emit('stream_ended', { streamId: s._id, reason: 'account_deleted' });
    }

    // Delete all streams
    await Stream.deleteMany({ streamerId: user._id });

    // Delete user
    await User.findByIdAndDelete(user._id);

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});
