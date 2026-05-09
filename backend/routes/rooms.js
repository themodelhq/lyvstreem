const router = require('express').Router();
const RoomSession = require('../models/RoomSession');
const Stream = require('../models/Stream');
const { authenticateToken } = require('../middleware/auth');

const MAX_SEATS = 12;

router.get('/:streamId', async (req, res) => {
  try {
    const room = await RoomSession.findOne({ streamId: req.params.streamId, isActive: true });
    res.json(room || null);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch room' }); }
});

router.post('/:streamId/mode', authenticateToken, async (req, res) => {
  try {
    const { mode } = req.body;
    if (!['solo', 'audio', 'video'].includes(mode)) return res.status(400).json({ error: 'Invalid mode' });
    const stream = await Stream.findOne({ _id: req.params.streamId, streamerId: req.user.userId });
    if (!stream) return res.status(403).json({ error: 'Not your stream' });

    const seats = mode !== 'solo'
      ? Array.from({ length: MAX_SEATS }, (_, i) => ({ seatIndex: i, isLocked: false, isMuted: false }))
      : [];

    const room = await RoomSession.findOneAndUpdate(
      { streamId: req.params.streamId },
      { streamId: req.params.streamId, hostId: req.user.userId, mode, maxSeats: mode !== 'solo' ? MAX_SEATS : 0, seats, isActive: true, allMuted: false, backgroundWallpaper: '' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    req.app.get('io').to(`stream_${req.params.streamId}`).emit('room_mode_changed', { mode, maxSeats: room.maxSeats, seats: room.seats, wallpaper: room.backgroundWallpaper || '' });
    res.json(room);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to set mode' }); }
});

router.post('/:streamId/wallpaper', authenticateToken, async (req, res) => {
  try {
    const { wallpaper } = req.body;
    const room = await RoomSession.findOneAndUpdate(
      { streamId: req.params.streamId, hostId: req.user.userId },
      { backgroundWallpaper: wallpaper },
      { new: true }
    );
    if (!room) return res.status(403).json({ error: 'Not authorized' });
    req.app.get('io').to(`stream_${req.params.streamId}`).emit('room_wallpaper_changed', { wallpaper });
    res.json({ success: true, wallpaper });
  } catch (err) { res.status(500).json({ error: 'Failed to change wallpaper' }); }
});

router.post('/:streamId/seats/:seatIndex/lock', authenticateToken, async (req, res) => {
  try {
    const { locked } = req.body;
    const room = await RoomSession.findOne({ streamId: req.params.streamId, hostId: req.user.userId });
    if (!room) return res.status(403).json({ error: 'Not authorized' });
    const idx = parseInt(req.params.seatIndex);
    if (!room.seats[idx]) return res.status(404).json({ error: 'Seat not found' });
    if (locked && room.seats[idx].userId) {
      req.app.get('io').to(room.seats[idx].socketId).emit('seat_dropped', { seatIndex: idx, reason: 'locked' });
      room.seats[idx] = { seatIndex: idx, isLocked: true, isMuted: false };
    } else {
      room.seats[idx].isLocked = locked;
    }
    await room.save();
    req.app.get('io').to(`stream_${req.params.streamId}`).emit('seat_updated', { seats: room.seats });
    res.json({ success: true, seats: room.seats });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:streamId/seats/:seatIndex/mute', authenticateToken, async (req, res) => {
  try {
    const { muted } = req.body;
    const room = await RoomSession.findOne({ streamId: req.params.streamId, hostId: req.user.userId });
    if (!room) return res.status(403).json({ error: 'Not authorized' });
    const idx = parseInt(req.params.seatIndex);
    if (!room.seats[idx]) return res.status(404).json({ error: 'Seat not found' });
    room.seats[idx].isMuted = muted;
    await room.save();
    if (room.seats[idx].socketId) req.app.get('io').to(room.seats[idx].socketId).emit('host_mute_command', { seatIndex: idx, muted });
    req.app.get('io').to(`stream_${req.params.streamId}`).emit('seat_updated', { seats: room.seats });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:streamId/seats/:seatIndex/drop', authenticateToken, async (req, res) => {
  try {
    const room = await RoomSession.findOne({ streamId: req.params.streamId, hostId: req.user.userId });
    if (!room) return res.status(403).json({ error: 'Not authorized' });
    const idx = parseInt(req.params.seatIndex);
    if (!room.seats[idx]) return res.status(404).json({ error: 'Seat not found' });
    if (room.seats[idx].socketId) req.app.get('io').to(room.seats[idx].socketId).emit('seat_dropped', { seatIndex: idx, reason: 'removed_by_host' });
    room.seats[idx] = { seatIndex: idx, isLocked: room.seats[idx].isLocked, isMuted: false };
    await room.save();
    req.app.get('io').to(`stream_${req.params.streamId}`).emit('seat_updated', { seats: room.seats });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:streamId/mute-all', authenticateToken, async (req, res) => {
  try {
    const { muted } = req.body;
    const room = await RoomSession.findOne({ streamId: req.params.streamId, hostId: req.user.userId });
    if (!room) return res.status(403).json({ error: 'Not authorized' });
    room.allMuted = muted;
    room.seats.forEach((seat, i) => {
      if (seat.userId) {
        room.seats[i].isMuted = muted;
        if (seat.socketId) req.app.get('io').to(seat.socketId).emit('host_mute_command', { seatIndex: i, muted });
      }
    });
    await room.save();
    req.app.get('io').to(`stream_${req.params.streamId}`).emit('seat_updated', { seats: room.seats, allMuted: muted });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
