const router = require('express').Router();
const Stream = require('../models/Stream');
const User   = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Helper — check if requester is host or stream admin
async function isHostOrAdmin(streamId, userId) {
  const stream = await Stream.findById(streamId);
  if (!stream) return { ok: false, stream: null };
  const isHost  = stream.streamerId.toString() === userId;
  const isAdmin = stream.admins.map(a => a.toString()).includes(userId);
  return { ok: isHost || isAdmin, stream, isHost };
}

// ── Background image ──────────────────────────────────────────────────────────
router.post('/:streamId/background', authenticateToken, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    const stream = await Stream.findOne({ _id: req.params.streamId, streamerId: req.user.userId });
    if (!stream) return res.status(403).json({ error: 'Not your stream' });
    stream.backgroundImage = imageUrl || '';
    await stream.save();
    req.app.get('io').to(`stream_${stream._id}`).emit('stream_background_changed', { backgroundImage: imageUrl || '' });
    res.json({ success: true, backgroundImage: imageUrl || '' });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── Mute viewer in chat ───────────────────────────────────────────────────────
router.post('/:streamId/mute-viewer', authenticateToken, async (req, res) => {
  try {
    const { targetUserId, muted } = req.body;
    const { ok, stream } = await isHostOrAdmin(req.params.streamId, req.user.userId);
    if (!ok) return res.status(403).json({ error: 'Not authorized' });

    if (muted) {
      await Stream.findByIdAndUpdate(stream._id, { $addToSet: { mutedUsers: targetUserId } });
    } else {
      await Stream.findByIdAndUpdate(stream._id, { $pull: { mutedUsers: targetUserId } });
    }

    const targetUser = await User.findById(targetUserId).select('username displayName');
    const io = req.app.get('io');
    io.to(`user_${targetUserId}`).emit('you_are_muted', { streamId: stream._id, muted });
    io.to(`stream_${stream._id}`).emit('viewer_muted', { targetUserId, muted, targetName: targetUser?.displayName || targetUser?.username });
    res.json({ success: true, muted });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── Kick viewer ───────────────────────────────────────────────────────────────
router.post('/:streamId/kick-viewer', authenticateToken, async (req, res) => {
  try {
    const { targetUserId, block } = req.body;
    const { ok, stream } = await isHostOrAdmin(req.params.streamId, req.user.userId);
    if (!ok) return res.status(403).json({ error: 'Not authorized' });

    await Stream.findByIdAndUpdate(stream._id, { $addToSet: { kickedUsers: targetUserId } });
    if (block) {
      await Stream.findByIdAndUpdate(stream._id, { $addToSet: { blockedUsers: targetUserId } });
    }

    const targetUser = await User.findById(targetUserId).select('username displayName');
    const io = req.app.get('io');
    io.to(`user_${targetUserId}`).emit('you_are_kicked', { streamId: stream._id, blocked: !!block });
    io.to(`stream_${stream._id}`).emit('viewer_kicked', {
      targetUserId,
      blocked: !!block,
      targetName: targetUser?.displayName || targetUser?.username,
    });
    res.json({ success: true, kicked: true, blocked: !!block });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── Add / remove stream admin ─────────────────────────────────────────────────
router.post('/:streamId/admin', authenticateToken, async (req, res) => {
  try {
    const { targetUserId, add } = req.body;
    const stream = await Stream.findOne({ _id: req.params.streamId, streamerId: req.user.userId });
    if (!stream) return res.status(403).json({ error: 'Only host can manage admins' });

    if (add) {
      if (stream.admins.length >= 10) return res.status(400).json({ error: 'Maximum 10 admins allowed' });
      await Stream.findByIdAndUpdate(stream._id, { $addToSet: { admins: targetUserId } });
      req.app.get('io').to(`user_${targetUserId}`).emit('you_are_admin', { streamId: stream._id, isAdmin: true });
    } else {
      await Stream.findByIdAndUpdate(stream._id, { $pull: { admins: targetUserId } });
      req.app.get('io').to(`user_${targetUserId}`).emit('you_are_admin', { streamId: stream._id, isAdmin: false });
    }

    const updated = await Stream.findById(stream._id).populate('admins', 'username displayName avatar');
    req.app.get('io').to(`stream_${stream._id}`).emit('admins_updated', { admins: updated.admins });
    res.json({ success: true, admins: updated.admins });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── Get stream moderation state ───────────────────────────────────────────────
router.get('/:streamId/moderation', authenticateToken, async (req, res) => {
  try {
    const { ok, stream } = await isHostOrAdmin(req.params.streamId, req.user.userId);
    if (!ok) return res.status(403).json({ error: 'Not authorized' });
    const populated = await Stream.findById(stream._id)
      .populate('admins', 'username displayName avatar')
      .populate('mutedUsers', 'username displayName avatar')
      .populate('kickedUsers', 'username displayName avatar')
      .populate('blockedUsers', 'username displayName avatar');
    res.json({
      admins: populated.admins,
      mutedUsers: populated.mutedUsers,
      kickedUsers: populated.kickedUsers,
      blockedUsers: populated.blockedUsers,
      backgroundImage: populated.backgroundImage,
    });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── Play sound effect for all viewers ────────────────────────────────────────
router.post('/:streamId/sound', authenticateToken, async (req, res) => {
  try {
    const { soundId } = req.body;
    const { ok } = await isHostOrAdmin(req.params.streamId, req.user.userId);
    if (!ok) return res.status(403).json({ error: 'Not authorized' });
    req.app.get('io').to(`stream_${req.params.streamId}`).emit('play_sound', { soundId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── End all abandoned streams (admin / cron endpoint) ────────────────────────
router.post('/cleanup/abandoned', async (req, res) => {
  try {
    const TIMEOUT_MINUTES = 10; // streams with no heartbeat for 10+ min
    const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);

    // Find streams that are "live" but either:
    // a) no heartbeat ever AND started more than 10 min ago, OR
    // b) lastHeartbeat is older than cutoff
    const abandoned = await Stream.find({
      isLive: true,
      $or: [
        { lastHeartbeat: { $lt: cutoff } },
        { lastHeartbeat: null, startedAt: { $lt: cutoff } },
      ],
    });

    let count = 0;
    for (const stream of abandoned) {
      const durationSec = stream.startedAt
        ? Math.floor((new Date() - new Date(stream.startedAt)) / 1000)
        : 0;
      const durationMin = Math.floor(durationSec / 60);

      stream.isLive      = false;
      stream.endedAt     = new Date();
      stream.duration    = durationSec;
      await stream.save();

      // Credit streaming minutes to host
      await User.findByIdAndUpdate(stream.streamerId, {
        $inc: { totalStreamMinutes: durationMin, monthlyStreamMinutes: durationMin },
      });

      req.app?.get('io')?.to(`stream_${stream._id}`).emit('stream_ended', { streamId: stream._id, reason: 'abandoned' });
      count++;
    }

    res.json({ success: true, ended: count, streams: abandoned.map(s => s._id) });
  } catch (err) {
    console.error('Cleanup error:', err);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

module.exports = router;
