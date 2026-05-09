const router = require('express').Router();
const PKBattle = require('../models/PKBattle');
const Stream = require('../models/Stream');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const PK_DURATION_MINUTES = 10;

// Send PK invite to another streamer
router.post('/invite', authenticateToken, async (req, res) => {
  try {
    const { targetStreamId } = req.body;

    const myStream = await Stream.findOne({ streamerId: req.user.userId, isLive: true });
    if (!myStream) return res.status(400).json({ error: 'You must be live to start a PK battle' });

    const targetStream = await Stream.findById(targetStreamId).populate('streamerId', 'username displayName');
    if (!targetStream || !targetStream.isLive) return res.status(400).json({ error: 'Target stream is not live' });

    // Check no active battle exists
    const existing = await PKBattle.findOne({
      $or: [{ streamA: myStream._id }, { streamB: myStream._id }],
      status: { $in: ['pending', 'active'] },
    });
    if (existing) return res.status(400).json({ error: 'You already have an active PK battle' });

    const battle = await new PKBattle({
      streamA: myStream._id,
      streamerA: req.user.userId,
      streamB: targetStream._id,
      streamerB: targetStream.streamerId._id,
      status: 'pending',
      durationMinutes: PK_DURATION_MINUTES,
    }).save();

    // Notify via socket
    req.app.get('io').to(`stream_${targetStream._id}`).emit('pk_invite', {
      battleId: battle._id,
      fromStream: { id: myStream._id, title: myStream.title, streamer: req.user },
    });

    res.json({ message: 'PK invite sent!', battleId: battle._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send PK invite' });
  }
});

// Accept PK invite
router.post('/:battleId/accept', authenticateToken, async (req, res) => {
  try {
    const battle = await PKBattle.findById(req.params.battleId)
      .populate('streamerA', 'username displayName avatar')
      .populate('streamerB', 'username displayName avatar')
      .populate('streamA', 'title')
      .populate('streamB', 'title');

    if (!battle) return res.status(404).json({ error: 'Battle not found' });
    if (battle.streamerB.toString() !== req.user.userId && battle.streamerB._id.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (battle.status !== 'pending') return res.status(400).json({ error: 'Battle already started or ended' });

    const endsAt = new Date(Date.now() + PK_DURATION_MINUTES * 60 * 1000);
    battle.status = 'active';
    battle.startedAt = new Date();
    battle.endsAt = endsAt;
    await battle.save();

    const payload = {
      battleId: battle._id,
      streamerA: battle.streamerA,
      streamerB: battle.streamerB,
      streamA: battle.streamA,
      streamB: battle.streamB,
      coinsA: 0,
      coinsB: 0,
      endsAt,
      durationMinutes: PK_DURATION_MINUTES,
    };

    req.app.get('io').to(`stream_${battle.streamA._id}`).emit('pk_started', payload);
    req.app.get('io').to(`stream_${battle.streamB._id}`).emit('pk_started', payload);

    // Auto-end after duration
    setTimeout(async () => {
      try {
        const b = await PKBattle.findById(battle._id);
        if (b && b.status === 'active') {
          b.status = 'ended';
          b.endedAt = new Date();
          b.winnerId = b.coinsA >= b.coinsB ? b.streamerA : b.streamerB;
          await b.save();

          const endPayload = {
            battleId: b._id,
            coinsA: b.coinsA,
            coinsB: b.coinsB,
            winnerId: b.winnerId,
          };
          req.app.get('io').to(`stream_${b.streamA}`).emit('pk_ended', endPayload);
          req.app.get('io').to(`stream_${b.streamB}`).emit('pk_ended', endPayload);
        }
      } catch (e) { console.error('PK auto-end error:', e); }
    }, PK_DURATION_MINUTES * 60 * 1000);

    res.json({ message: 'PK battle started!', battle: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to accept PK invite' });
  }
});

// Decline PK
router.post('/:battleId/decline', authenticateToken, async (req, res) => {
  try {
    const battle = await PKBattle.findByIdAndUpdate(req.params.battleId, { status: 'ended' }, { new: true });
    if (!battle) return res.status(404).json({ error: 'Battle not found' });
    req.app.get('io').to(`stream_${battle.streamA}`).emit('pk_declined', { battleId: battle._id });
    res.json({ message: 'PK declined' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decline' });
  }
});

// PK coin contributions are driven by the socket `send_gift` flow which
// performs an atomic $inc on the battle. There is no client-callable
// contribute endpoint — accepting `coins` from a client without payment
// would let anyone arbitrarily inflate either side of a battle.

// Get active battle for a stream
router.get('/stream/:streamId', async (req, res) => {
  try {
    const battle = await PKBattle.findOne({
      $or: [{ streamA: req.params.streamId }, { streamB: req.params.streamId }],
      status: { $in: ['pending', 'active'] },
    })
      .populate('streamerA', 'username displayName avatar')
      .populate('streamerB', 'username displayName avatar')
      .populate('streamA', 'title')
      .populate('streamB', 'title');
    res.json(battle || null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch battle' });
  }
});

module.exports = router;
