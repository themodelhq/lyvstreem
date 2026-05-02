require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const authRoutes       = require('./routes/auth');
const userRoutes       = require('./routes/users');
const streamRoutes     = require('./routes/streams');
const giftRoutes       = require('./routes/gifts');
const paymentRoutes    = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');
const withdrawalRoutes = require('./routes/withdrawals');
const pkRoutes         = require('./routes/pk');
const roomRoutes       = require('./routes/rooms');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173',
];

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  pingTimeout: 30000,
  pingInterval: 10000,
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lyvstreem')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/streams',       streamRoutes);
app.use('/api/gifts',         giftRoutes);
app.use('/api/payments',      paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/withdrawals',   withdrawalRoutes);
app.use('/api/pk',            pkRoutes);
app.use('/api/rooms',         roomRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// ─── Models ──────────────────────────────────────────────────────────────────
const Stream       = require('./models/Stream');
const ChatMessage  = require('./models/ChatMessage');
const User         = require('./models/User');
const PKBattle     = require('./models/PKBattle');
const RoomSession  = require('./models/RoomSession');

// ─── In-memory state ─────────────────────────────────────────────────────────
const activeUsers   = new Map();  // socketId -> {userId, username, displayName, avatar}
const streamViewers = new Map();  // streamId -> Set<socketId>
const userSockets   = new Map();  // userId   -> socketId  (latest socket per user)

// ─── Socket.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  // ── Auth ────────────────────────────────────────────────────────────────
  socket.on('authenticate', async (data) => {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'lyvstreem-secret');
      const user = await User.findById(decoded.userId).select('username displayName avatar');
      if (user) {
        const userData = { userId: user._id.toString(), username: user.username, displayName: user.displayName, avatar: user.avatar };
        activeUsers.set(socket.id, userData);
        userSockets.set(user._id.toString(), socket.id);
        // Join personal room so host can target this user
        socket.join(`user_${user._id}`);
        socket.emit('authenticated', { user, socketId: socket.id });
      }
    } catch (e) {
      socket.emit('auth_error', { message: 'Invalid token' });
    }
  });

  // ── Stream joining ───────────────────────────────────────────────────────
  socket.on('join_stream', async ({ streamId }) => {
    socket.join(`stream_${streamId}`);
    if (!streamViewers.has(streamId)) streamViewers.set(streamId, new Set());
    streamViewers.get(streamId).add(socket.id);

    const count = streamViewers.get(streamId).size;
    await Stream.findByIdAndUpdate(streamId, { viewerCount: count });
    io.to(`stream_${streamId}`).emit('viewer_count', { count });

    const userData = activeUsers.get(socket.id);
    if (userData) io.to(`stream_${streamId}`).emit('user_joined', { user: userData });

    const messages = await ChatMessage.find({ streamId })
      .populate('userId', 'username displayName avatar')
      .sort({ timestamp: -1 }).limit(50).lean();
    socket.emit('chat_history', messages.reverse());

    // Active PK
    const battle = await PKBattle.findOne({
      $or: [{ streamA: streamId }, { streamB: streamId }],
      status: { $in: ['pending', 'active'] },
    }).populate('streamerA', 'username displayName avatar').populate('streamerB', 'username displayName avatar');
    if (battle) socket.emit('pk_active', battle);

    // Active room session
    const room = await RoomSession.findOne({ streamId, isActive: true });
    if (room) socket.emit('room_state', { mode: room.mode, maxSeats: room.maxSeats, seats: room.seats, allMuted: room.allMuted });
  });

  socket.on('leave_stream', async ({ streamId }) => {
    socket.leave(`stream_${streamId}`);
    if (streamViewers.has(streamId)) {
      streamViewers.get(streamId).delete(socket.id);
      const count = streamViewers.get(streamId).size;
      await Stream.findByIdAndUpdate(streamId, { viewerCount: count });
      io.to(`stream_${streamId}`).emit('viewer_count', { count });
    }
  });

  // ── Chat ─────────────────────────────────────────────────────────────────
  socket.on('send_message', async ({ streamId, message }) => {
    const userData = activeUsers.get(socket.id);
    if (!userData || !message?.trim()) return;
    const msg = new ChatMessage({ streamId, userId: userData.userId, message: message.trim().substring(0, 300), type: 'message' });
    await msg.save();
    io.to(`stream_${streamId}`).emit('new_message', {
      _id: msg._id,
      userId: { _id: userData.userId, username: userData.username, displayName: userData.displayName, avatar: userData.avatar },
      message: msg.message, type: 'message', timestamp: msg.timestamp,
    });
  });

  // ── Gifts ────────────────────────────────────────────────────────────────
  socket.on('send_gift', async ({ streamId, giftId, giftName, giftEmoji, giftValue, giftRarity, giftEffect, pkBattleId, pkSide }) => {
    const userData = activeUsers.get(socket.id);
    if (!userData) return;
    const msg = new ChatMessage({ streamId, userId: userData.userId, message: `sent ${giftName}`, type: 'gift', giftInfo: { giftType: giftName, giftValue, giftCount: 1, giftEmoji, giftRarity, giftEffect } });
    await msg.save();
    const stream = await Stream.findById(streamId);
    if (stream) {
      await User.findByIdAndUpdate(stream.streamerId, { $inc: { earningCoins: giftValue, totalEarningsCoins: giftValue, totalLikes: 1 } });
      if (pkBattleId && pkSide) {
        const battle = await PKBattle.findById(pkBattleId);
        if (battle && battle.status === 'active') {
          const field = pkSide === 'A' ? 'coinsA' : 'coinsB';
          battle[field] += giftValue;
          await battle.save();
          const pkPayload = { battleId: battle._id, coinsA: battle.coinsA, coinsB: battle.coinsB };
          io.to(`stream_${battle.streamA}`).emit('pk_update', pkPayload);
          io.to(`stream_${battle.streamB}`).emit('pk_update', pkPayload);
        }
      }
    }
    const giftPayload = { _id: msg._id, userId: { _id: userData.userId, username: userData.username, displayName: userData.displayName, avatar: userData.avatar }, message: `sent ${giftName}`, type: 'gift', giftInfo: { giftType: giftName, giftValue, giftEmoji, giftRarity, giftEffect }, timestamp: msg.timestamp };
    io.to(`stream_${streamId}`).emit('new_message', giftPayload);
    io.to(`stream_${streamId}`).emit('gift_received', giftPayload);
  });

  // ── Stream lifecycle ─────────────────────────────────────────────────────
  socket.on('start_stream', async ({ streamId }) => {
    const stream = await Stream.findByIdAndUpdate(streamId, { isLive: true, startedAt: new Date() }, { new: true })
      .populate('streamerId', 'username displayName avatar');
    if (stream) io.emit('stream_started', { stream });
  });

  socket.on('end_stream', async ({ streamId }) => {
    const stream = await Stream.findById(streamId);
    if (stream && stream.isLive && stream.startedAt) {
      const durationSeconds = Math.floor((new Date() - new Date(stream.startedAt)) / 1000);
      const durationMinutes = Math.floor(durationSeconds / 60);
      await Stream.findByIdAndUpdate(streamId, { isLive: false, endedAt: new Date(), duration: durationSeconds });
      const hostUser = await User.findById(stream.streamerId);
      if (hostUser) {
        const now = new Date();
        const lastReset = new Date(hostUser.lastMonthlyReset);
        if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
          hostUser.monthlyStreamMinutes = 0;
          hostUser.lastMonthlyReset = now;
        }
        hostUser.monthlyStreamMinutes += durationMinutes;
        hostUser.totalStreamMinutes += durationMinutes;
        await hostUser.save();
      }
      // Clean up room
      await RoomSession.findOneAndUpdate({ streamId }, { isActive: false });
      io.to(`stream_${streamId}`).emit('stream_ended', { streamId });
      io.emit('stream_offline', { streamId });
    }
  });

  socket.on('react', ({ streamId, reaction }) => {
    const userData = activeUsers.get(socket.id);
    io.to(`stream_${streamId}`).emit('new_reaction', { reaction, userId: userData?.userId });
  });

  socket.on('host_media_state', ({ streamId, camOn, micOn }) => {
    socket.to(`stream_${streamId}`).emit('host_media_state', { camOn, micOn });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ──  MULTI-SEAT ROOM SIGNALING  ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  // Viewer requests to join a seat
  socket.on('room_request_seat', async ({ streamId, seatIndex }) => {
    const userData = activeUsers.get(socket.id);
    if (!userData) return socket.emit('room_error', { message: 'Not authenticated' });

    const room = await RoomSession.findOne({ streamId, isActive: true });
    if (!room) return socket.emit('room_error', { message: 'No room session active' });

    const seat = room.seats[seatIndex];
    if (!seat) return socket.emit('room_error', { message: 'Seat not found' });
    if (seat.isLocked) return socket.emit('room_error', { message: 'This seat is locked' });
    if (seat.userId) return socket.emit('room_error', { message: 'Seat is occupied' });

    // Forward request to host for approval
    io.to(`user_${room.hostId}`).emit('room_seat_request', {
      streamId,
      seatIndex,
      user: userData,
      socketId: socket.id,
    });
    socket.emit('room_seat_request_sent', { seatIndex });
  });

  // Host approves a seat request
  socket.on('room_approve_seat', async ({ streamId, seatIndex, targetSocketId, targetUserId, targetUser }) => {
    const userData = activeUsers.get(socket.id);
    if (!userData) return;

    const room = await RoomSession.findOne({ streamId, hostId: userData.userId, isActive: true });
    if (!room) return;

    const seat = room.seats[seatIndex];
    if (!seat || seat.isLocked || seat.userId) return socket.emit('room_error', { message: 'Seat unavailable' });

    // Assign user to seat
    room.seats[seatIndex] = {
      seatIndex,
      userId: targetUserId,
      username: targetUser.username,
      displayName: targetUser.displayName,
      avatar: targetUser.avatar,
      socketId: targetSocketId,
      isLocked: false,
      isMuted: room.allMuted,
      hasVideo: room.mode === 'video',
      hasAudio: true,
      joinedAt: new Date(),
    };
    await room.save();

    // Notify the approved user
    io.to(targetSocketId).emit('room_seat_approved', {
      seatIndex,
      mode: room.mode,
      isMuted: room.allMuted,
      streamId,
    });

    // Broadcast updated seats to all viewers
    io.to(`stream_${streamId}`).emit('seat_updated', { seats: room.seats });
  });

  // Host denies a seat request
  socket.on('room_deny_seat', ({ targetSocketId, seatIndex }) => {
    io.to(targetSocketId).emit('room_seat_denied', { seatIndex });
  });

  // User joins a seat after approval (triggers WebRTC setup)
  socket.on('room_join_seat', async ({ streamId, seatIndex }) => {
    const userData = activeUsers.get(socket.id);
    if (!userData) return;

    const room = await RoomSession.findOne({ streamId, isActive: true });
    if (!room) return;

    const seat = room.seats[seatIndex];
    if (!seat || seat.userId?.toString() !== userData.userId) return;

    // Update socketId in case it changed
    room.seats[seatIndex].socketId = socket.id;
    await room.save();

    // Join seat-specific room for WebRTC signaling
    socket.join(`seat_${streamId}_${seatIndex}`);

    // Tell all existing seat holders to initiate WebRTC offer to this new peer
    const existingSeats = room.seats.filter((s, i) => s.userId && i !== seatIndex);
    existingSeats.forEach(s => {
      if (s.socketId) {
        io.to(s.socketId).emit('room_new_peer', {
          peerId: socket.id,
          peerUser: userData,
          seatIndex,
          shouldInitiate: true,
        });
      }
    });

    // Also tell host to create offer to this new peer
    io.to(`user_${room.hostId}`).emit('room_new_peer', {
      peerId: socket.id,
      peerUser: userData,
      seatIndex,
      shouldInitiate: true,
    });

    socket.emit('room_peers_list', {
      peers: existingSeats.map(s => ({ socketId: s.socketId, seatIndex: s.seatIndex, user: { userId: s.userId, displayName: s.displayName, avatar: s.avatar } })),
      hostSocketId: userSockets.get(room.hostId.toString()),
    });

    io.to(`stream_${streamId}`).emit('seat_updated', { seats: room.seats });
  });

  // User leaves seat voluntarily
  socket.on('room_leave_seat', async ({ streamId, seatIndex }) => {
    const userData = activeUsers.get(socket.id);
    if (!userData) return;

    const room = await RoomSession.findOne({ streamId, isActive: true });
    if (!room) return;

    const seat = room.seats[seatIndex];
    if (!seat || seat.userId?.toString() !== userData.userId) return;

    room.seats[seatIndex] = { seatIndex, isLocked: false, isMuted: false };
    await room.save();

    socket.leave(`seat_${streamId}_${seatIndex}`);
    io.to(`stream_${streamId}`).emit('seat_updated', { seats: room.seats });
    io.to(`stream_${streamId}`).emit('room_peer_left', { peerId: socket.id, seatIndex });
  });

  // User self-mute toggle
  socket.on('room_self_mute', async ({ streamId, seatIndex, muted }) => {
    const room = await RoomSession.findOne({ streamId, isActive: true });
    if (!room) return;
    const seat = room.seats[seatIndex];
    if (!seat || seat.isMuted) return; // can't unmute if host muted
    room.seats[seatIndex].hasAudio = !muted;
    await room.save();
    io.to(`stream_${streamId}`).emit('seat_updated', { seats: room.seats });
  });

  // User video toggle
  socket.on('room_self_video', async ({ streamId, seatIndex, videoOn }) => {
    const room = await RoomSession.findOne({ streamId, isActive: true });
    if (!room || room.mode !== 'video') return;
    const seat = room.seats[seatIndex];
    if (!seat) return;
    room.seats[seatIndex].hasVideo = videoOn;
    await room.save();
    io.to(`stream_${streamId}`).emit('seat_updated', { seats: room.seats });
  });

  // ── WebRTC Signaling relay ─────────────────────────────────────────────
  socket.on('rtc_offer', ({ targetSocketId, offer, seatIndex }) => {
    io.to(targetSocketId).emit('rtc_offer', { fromSocketId: socket.id, offer, seatIndex });
  });

  socket.on('rtc_answer', ({ targetSocketId, answer, seatIndex }) => {
    io.to(targetSocketId).emit('rtc_answer', { fromSocketId: socket.id, answer, seatIndex });
  });

  socket.on('rtc_ice_candidate', ({ targetSocketId, candidate, seatIndex }) => {
    io.to(targetSocketId).emit('rtc_ice_candidate', { fromSocketId: socket.id, candidate, seatIndex });
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    const userData = activeUsers.get(socket.id);
    activeUsers.delete(socket.id);
    if (userData) userSockets.delete(userData.userId);

    // Remove from stream viewer counts
    for (const [streamId, viewers] of streamViewers.entries()) {
      if (viewers.has(socket.id)) {
        viewers.delete(socket.id);
        const count = viewers.size;
        await Stream.findByIdAndUpdate(streamId, { viewerCount: count });
        io.to(`stream_${streamId}`).emit('viewer_count', { count });

        // If they were in a seat, free it
        if (userData) {
          const room = await RoomSession.findOne({ streamId, isActive: true });
          if (room) {
            const seatIdx = room.seats.findIndex(s => s.userId?.toString() === userData.userId && s.socketId === socket.id);
            if (seatIdx >= 0) {
              io.to(`stream_${streamId}`).emit('room_peer_left', { peerId: socket.id, seatIndex: seatIdx });
              room.seats[seatIdx] = { seatIndex: seatIdx, isLocked: false, isMuted: false };
              await room.save();
              io.to(`stream_${streamId}`).emit('seat_updated', { seats: room.seats });
            }
          }
        }
      }
    }
    console.log('🔌 Disconnected:', socket.id);
  });
});

app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 LyvStreem backend on port ${PORT}`));
module.exports = { app, server, io };
