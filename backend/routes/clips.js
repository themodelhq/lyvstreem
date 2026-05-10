const router = require('express').Router();
const Clip   = require('../models/Clip');
const User   = require('../models/User');
const Stream = require('../models/Stream');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const MAX_CLIPS_PER_USER = 30;          // keep wall trim
const MAX_VIDEO_BYTES    = 5 * 1024 * 1024; // ~5 MB cap on inline data URLs

// ── Upload a captured clip (host only) ────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { streamId, title, category, videoData, thumbnail, duration } = req.body;
    if (!videoData || typeof videoData !== 'string' || !videoData.startsWith('data:video/')) {
      return res.status(400).json({ error: 'Invalid video payload' });
    }
    if (videoData.length > MAX_VIDEO_BYTES * 1.4) {
      return res.status(413).json({ error: 'Clip too large' });
    }

    // Respect the user's Wall preference at upload-time
    const user = await User.findById(req.user.userId).select('wallEnabled');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.wallEnabled === false) {
      return res.status(403).json({ error: 'Wall is disabled' });
    }

    // Wall clips must come from one of the user's own streams
    if (!streamId) return res.status(400).json({ error: 'streamId required' });
    const owns = await Stream.exists({ _id: streamId, streamerId: req.user.userId });
    if (!owns) return res.status(403).json({ error: 'Not your stream' });

    const clip = await Clip.create({
      userId:     req.user.userId,
      streamId,
      title:      (title || '').toString().slice(0, 120),
      category:   (category || 'Entertainment').toString().slice(0, 40),
      videoData,
      thumbnail:  thumbnail || '',
      duration:   Math.max(0, Math.min(60, parseInt(duration) || 0)),
      capturedAt: new Date(),
    });

    // Trim oldest clips beyond the cap
    const all = await Clip.find({ userId: req.user.userId }).sort({ capturedAt: -1 }).select('_id');
    if (all.length > MAX_CLIPS_PER_USER) {
      const toDelete = all.slice(MAX_CLIPS_PER_USER).map(c => c._id);
      await Clip.deleteMany({ _id: { $in: toDelete } });
    }

    res.status(201).json({ success: true, clipId: clip._id });
  } catch (err) {
    console.error('Clip upload error:', err);
    res.status(500).json({ error: 'Failed to save clip' });
  }
});

// ── List a user's clips (respects wall toggle) ────────────────────────────────
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const owner = await User.findById(req.params.userId).select('wallEnabled');
    if (!owner) return res.status(404).json({ error: 'User not found' });
    if (owner.wallEnabled === false) return res.json({ wallEnabled: false, clips: [] });

    const clips = await Clip.find({ userId: req.params.userId })
      .sort({ capturedAt: -1 })
      .limit(50);
    res.json({ wallEnabled: true, clips });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clips' });
  }
});

// ── Delete a single clip (owner only) ─────────────────────────────────────────
router.delete('/:clipId', authenticateToken, async (req, res) => {
  try {
    const clip = await Clip.findById(req.params.clipId);
    if (!clip) return res.status(404).json({ error: 'Clip not found' });
    if (clip.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not your clip' });
    }
    await Clip.findByIdAndDelete(clip._id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete clip' });
  }
});

// ── Clear all of my clips ─────────────────────────────────────────────────────
router.delete('/me/all', authenticateToken, async (req, res) => {
  try {
    const r = await Clip.deleteMany({ userId: req.user.userId });
    res.json({ success: true, deleted: r.deletedCount || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear clips' });
  }
});

module.exports = router;
