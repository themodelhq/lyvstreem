const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const Stream = require('../models/Stream');
const User = require('../models/User');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// Get live streams
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch streams' });
  }
});

// Get featured / recommended streams
router.get('/featured', async (req, res) => {
  try {
    const streams = await Stream.find({ isLive: true })
      .populate('streamerId', 'username displayName avatar isVerified')
      .sort({ viewerCount: -1 })
      .limit(6);
    res.json(streams);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch featured' });
  }
});

// Get single stream
router.get('/:streamId', optionalAuth, async (req, res) => {
  try {
    const stream = await Stream.findById(req.params.streamId)
      .populate('streamerId', 'username displayName avatar isVerified bio totalFollowers totalLikes');
    if (!stream) return res.status(404).json({ error: 'Stream not found' });
    res.json(stream);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stream' });
  }
});

// Create stream
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, tags } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    // Mark user as streamer
    await User.findByIdAndUpdate(req.user.userId, { isStreamer: true });

    const stream = new Stream({
      streamerId: req.user.userId,
      title: title.trim(),
      description,
      category: category || 'Entertainment',
      tags: tags || [],
      streamKey: uuidv4(),
    });
    await stream.save();

    const populated = await stream.populate('streamerId', 'username displayName avatar');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: 'Stream creation failed' });
  }
});

// Start stream
router.post('/:streamId/start', authenticateToken, async (req, res) => {
  try {
    const stream = await Stream.findOne({ _id: req.params.streamId, streamerId: req.user.userId });
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    stream.isLive = true;
    stream.startedAt = new Date();
    stream.viewerCount = 0;
    await stream.save();

    req.app.get('io').emit('stream_started', { streamId: stream._id, title: stream.title });
    res.json(stream);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start stream' });
  }
});

// End stream
router.post('/:streamId/end', authenticateToken, async (req, res) => {
  try {
    const stream = await Stream.findOne({ _id: req.params.streamId, streamerId: req.user.userId });
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    const duration = stream.startedAt ? Math.floor((new Date() - new Date(stream.startedAt)) / 1000) : 0;
    stream.isLive = false;
    stream.endedAt = new Date();
    stream.duration = duration;
    await stream.save();

    req.app.get('io').to(`stream_${stream._id}`).emit('stream_ended', { streamId: stream._id });
    res.json(stream);
  } catch (error) {
    res.status(500).json({ error: 'Failed to end stream' });
  }
});

// My streams
router.get('/my/streams', authenticateToken, async (req, res) => {
  try {
    const streams = await Stream.find({ streamerId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(streams);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch streams' });
  }
});

// Categories
router.get('/meta/categories', async (req, res) => {
  const categories = [
    { id: 'entertainment', name: 'Entertainment', emoji: '🎭' },
    { id: 'gaming', name: 'Gaming', emoji: '🎮' },
    { id: 'music', name: 'Music', emoji: '🎵' },
    { id: 'talk-show', name: 'Talk Show', emoji: '🎤' },
    { id: 'beauty', name: 'Beauty', emoji: '💄' },
    { id: 'fitness', name: 'Fitness', emoji: '💪' },
    { id: 'cooking', name: 'Cooking', emoji: '👨‍🍳' },
    { id: 'travel', name: 'Travel', emoji: '✈️' },
    { id: 'education', name: 'Education', emoji: '📚' },
    { id: 'sports', name: 'Sports', emoji: '⚽' },
    { id: 'comedy', name: 'Comedy', emoji: '😂' },
    { id: 'fashion', name: 'Fashion', emoji: '👗' },
  ];
  res.json(categories);
});

module.exports = router;
