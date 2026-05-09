const router  = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const Stream  = require('../models/Stream');
const User    = require('../models/User');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// ── Live streams list ─────────────────────────────────────────────────────────
router.get('/live', async (req, res) => {
  try {
    const { category, limit = 24, page = 1 } = req.query;
    const query = { isLive: true };
    if (category && category !== 'All') query.category = category;

    const streams = await Stream.find(query)
      .populate('streamerId', 'username displayName avatar isVerified')
      .sort({ viewerCount: -1, startedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Stream.countDocuments(query);
    res.json({ streams, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch streams' });
  }
});

// ── Featured ──────────────────────────────────────────────────────────────────
router.get('/featured', async (req, res) => {
  try {
    const streams = await Stream.find({ isLive: true })
      .populate('streamerId', 'username displayName avatar isVerified')
      .sort({ viewerCount: -1 })
      .limit(6);
    res.json(streams);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch featured' });
  }
});

// ── My streams ────────────────────────────────────────────────────────────────
router.get('/my/streams', authenticateToken, async (req, res) => {
  try {
    const streams = await Stream.find({ streamerId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(streams);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch streams' });
  }
});

// ── Categories metadata ───────────────────────────────────────────────────────
router.get('/meta/categories', async (req, res) => {
  res.json([
    { id: 'entertainment', name: 'Entertainment', emoji: '🎭' },
    { id: 'gaming',        name: 'Gaming',        emoji: '🎮' },
    { id: 'music',         name: 'Music',         emoji: '🎵' },
    { id: 'talk-show',     name: 'Talk Show',     emoji: '🎤' },
    { id: 'beauty',        name: 'Beauty',        emoji: '💄' },
    { id: 'fitness',       name: 'Fitness',       emoji: '💪' },
    { id: 'cooking',       name: 'Cooking',       emoji: '👨‍🍳' },
    { id: 'travel',        name: 'Travel',        emoji: '✈️'  },
    { id: 'education',     name: 'Education',     emoji: '📚' },
    { id: 'sports',        name: 'Sports',        emoji: '⚽' },
    { id: 'comedy',        name: 'Comedy',        emoji: '😂' },
    { id: 'fashion',       name: 'Fashion',       emoji: '👗' },
  ]);
});

// ── Clear all stale/ended streams for host profile ────────────────────────────
router.delete('/clear-stale', authenticateToken, async (req, res) => {
  try {
    // Force-end any still-marked-live streams
    const live = await Stream.find({ streamerId: req.user.userId, isLive: true });

// ── Single stream ─────────────────────────────────────────────────────────────
router.get('/:streamId', optionalAuth, async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.streamId)
      .populate('streamerId', 'username displayName avatar isVerified bio totalFollowers totalLikes');
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    res.json(stream);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stream' });
  }
});

// ── Go Live (atomic: end existing + create + start in one call) ───────────────
router.post('/go-live', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, tags } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title required' });
    }

    const hostId = req.user.userId;

    // 1. End ALL existing live streams for this host (prevents duplicates)
    const existingLive = await Stream.find({ streamerId: hostId, isLive: true });
    for (const old of existingLive) {
      const durSec = old.startedAt
        ? Math.floor((Date.now() - new Date(old.startedAt)) / 1000)
        : 0;
      await Stream.findByIdAndUpdate(old._id, {
        isLive: false,
        endedAt: new Date(),
        duration: durSec,
        viewerCount: 0,
      });
      req.app.get('io')?.to(`stream_${old._id}`).emit('stream_ended', {
        streamId: old._id,
        reason: 'replaced',
      });
    }

    // 2. Mark user as streamer
    await User.findByIdAndUpdate(hostId, { isStreamer: true });

    // 3. Create & immediately start the new stream (atomic)
    const stream = await Stream.create({
      streamerId:    hostId,
      title:         title.trim(),
      description:   description || '',
      category:      category || 'Entertainment',
      tags:          Array.isArray(tags) ? tags : [],
      streamKey:     uuidv4(),
      isLive:        true,
      startedAt:     new Date(),
      lastHeartbeat: new Date(),
      viewerCount:   0,
    });

    const populated = await Stream.findById(stream._id)
      .populate('streamerId', 'username displayName avatar isVerified');

    // 4. Broadcast to all connected clients
    req.app.get('io')?.emit('stream_started', { stream: populated });

    res.status(201).json(populated);
  } catch (err) {
    console.error('Go-live error:', err);
    res.status(500).json({ error: 'Failed to go live. Please try again.' });
  }
});

// ── End stream ────────────────────────────────────────────────────────────────
router.post('/:streamId/end', authenticateToken, async (req, res) => {
  try {
    // Find stream - allow ending if host OR if the stream exists (for cleanup)
    let stream = await Stream.findOne({
      _id: req.params.streamId,
      streamerId: req.user.userId,
    });
    // Fallback: try finding by ID only (handles edge cases)
    if (!stream) {
      stream = await Stream.findById(req.params.streamId);
      if (!stream) return res.status(404).json({ error: 'Stream not found' });
      if (stream.streamerId.toString() !== req.user.userId) {
        return res.status(403).json({ error: 'Not your stream' });
      }
    }

    const duration = stream.startedAt
      ? Math.floor((new Date() - new Date(stream.startedAt)) / 1000)
      : 0;

    stream.isLive      = false;
    stream.endedAt     = new Date();
    stream.duration    = duration;
    stream.viewerCount = 0;
    await stream.save();

    // Credit streaming minutes to host
    const durationMin = Math.floor(duration / 60);
    if (durationMin > 0) {
      const host = await User.findById(req.user.userId);
      if (host) {
        const now = new Date(), lr = new Date(host.lastMonthlyReset || 0);
        if (now.getMonth() !== lr.getMonth() || now.getFullYear() !== lr.getFullYear()) {
          host.monthlyStreamMinutes = 0;
          host.lastMonthlyReset     = now;
        }
        host.monthlyStreamMinutes += durationMin;
        host.totalStreamMinutes   += durationMin;
        await host.save();
      }
    }

    req.app.get('io')?.to(`stream_${stream._id}`).emit('stream_ended', { streamId: stream._id });

    // Build session summary
    const summary = {
      title:        stream.title,
      category:     stream.category,
      duration:     duration,
      durationMin:  durationMin,
      peakViewers:  stream.peakViewers || 0,
      totalGifts:   stream.totalGiftsValue || 0,
      startedAt:    stream.startedAt,
      endedAt:      stream.endedAt,
    };
    res.json({ success: true, stream, summary });
  } catch (err) {
    console.error('End stream error:', err);
    res.status(500).json({ error: 'Failed to end stream' });
  }
});

// ── Force-end all live streams for this host (safety endpoint) ────────────────
router.post('/end-all', authenticateToken, async (req, res) => {
  try {
    const hostId = req.user.userId;
    const live = await Stream.find({ streamerId: hostId, isLive: true });
    for (const s of live) {
      const dur = s.startedAt ? Math.floor((Date.now() - new Date(s.startedAt)) / 1000) : 0;
      await Stream.findByIdAndUpdate(s._id, {
        isLive: false, endedAt: new Date(), duration: dur, viewerCount: 0,
      });
      req.app.get('io')?.to(`stream_${s._id}`).emit('stream_ended', { streamId: s._id });
    }
    res.json({ success: true, ended: live.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Keep legacy /create + /start routes working (backward compat) ────────────
// These now delegate to the same safe atomic logic
router.post('/create', authenticateToken, async (req, res) => {
  req.body = req.body || {};
  // Forward to go-live logic by calling it directly
  const { title, description, category, tags } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });
  try {
    const hostId = req.user.userId;
    // End any existing live streams
    const existing = await Stream.find({ streamerId: hostId, isLive: true });
    for (const old of existing) {
      const dur = old.startedAt ? Math.floor((Date.now() - new Date(old.startedAt)) / 1000) : 0;
      await Stream.findByIdAndUpdate(old._id, { isLive: false, endedAt: new Date(), duration: dur, viewerCount: 0 });
      req.app.get('io')?.to(`stream_${old._id}`).emit('stream_ended', { streamId: old._id, reason: 'replaced' });
    }
    await User.findByIdAndUpdate(hostId, { isStreamer: true });
    const stream = await Stream.create({
      streamerId: hostId,
      title: title.trim(),
      description: description || '',
      category: category || 'Entertainment',
      tags: Array.isArray(tags) ? tags : [],
      streamKey: uuidv4(),
    });
    const populated = await Stream.findById(stream._id).populate('streamerId', 'username displayName avatar');
    res.status(201).json(populated);
  } catch (err) {
    console.error('Create error:', err);
    res.status(500).json({ error: 'Stream creation failed' });
  }
});

router.post('/:streamId/start', authenticateToken, async (req, res) => {
  try {
    const stream = await Stream.findOne({ _id: req.params.streamId, streamerId: req.user.userId });
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    stream.isLive        = true;
    stream.startedAt     = new Date();
    stream.lastHeartbeat = new Date();
    stream.viewerCount   = 0;
    await stream.save();
    req.app.get('io')?.emit('stream_started', { streamId: stream._id, title: stream.title });
    res.json(stream);
  } catch (err) {
    res.status(500).json({ error: 'Failed to start stream' });
  }
});

    for (const s of live) {
      const dur = s.startedAt ? Math.floor((Date.now() - new Date(s.startedAt)) / 1000) : 0;
      await Stream.findByIdAndUpdate(s._id, { isLive: false, endedAt: new Date(), duration: dur, viewerCount: 0 });
      req.app.get('io')?.to(`stream_${s._id}`).emit('stream_ended', { streamId: s._id, reason: 'force_ended' });
    }
    res.json({ success: true, cleared: live.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear streams' });
  }
});

module.exports = router;
