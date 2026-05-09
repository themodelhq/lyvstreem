require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const helmet  = require('helmet');
const compression = require('compression');
const morgan  = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const authRoutes        = require('./routes/auth');
const userRoutes        = require('./routes/users');
const streamRoutes      = require('./routes/streams');
const giftRoutes        = require('./routes/gifts');
const paymentRoutes     = require('./routes/payments');
const notificationRoutes = require('./routes/notifications');
const withdrawalRoutes  = require('./routes/withdrawals');
const pkRoutes          = require('./routes/pk');
const roomRoutes        = require('./routes/rooms');
const moderationRoutes  = require('./routes/moderation');
const clipRoutes        = require('./routes/clips');
const rtcRoutes         = require('./routes/rtc');

const app    = express();
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
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lyvstreem')
  .then(() => {
    console.log('✅ MongoDB connected');
    // End ALL live streams on startup — they are all ghost sessions
    cleanupAbandonedStreams(true);
  })
  .catch(err => console.error('❌ MongoDB error:', err));

app.use('/api/auth',         authRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/streams',      streamRoutes);
app.use('/api/gifts',        giftRoutes);
app.use('/api/payments',     paymentRoutes);
app.use('/api/notifications',notificationRoutes);
app.use('/api/withdrawals',  withdrawalRoutes);
app.use('/api/pk',           pkRoutes);
app.use('/api/rooms',        roomRoutes);
app.use('/api/moderation',   moderationRoutes);
app.use('/api/clips',        clipRoutes);
app.use('/api/rtc',          rtcRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// ── Models ────────────────────────────────────────────────────────────────────
const Stream      = require('./models/Stream');
const ChatMessage = require('./models/ChatMessage');
const User        = require('./models/User');
const PKBattle    = require('./models/PKBattle');
const RoomSession = require('./models/RoomSession');
const { HOST_SHARE } = require('./routes/gifts');

// ── Abandoned stream cleanup ──────────────────────────────────────────────────
async function cleanupAbandonedStreams(onStartup = false) {
  try {
    let query;
    if (onStartup) {
      // On startup: end ALL live streams — they are all abandoned since server was down
      query = { isLive: true };
    } else {
      // Periodic: only end streams with no heartbeat for 3+ minutes
      const TIMEOUT_MS = 3 * 60 * 1000;
      const cutoff = new Date(Date.now() - TIMEOUT_MS);
      query = {
        isLive: true,
        $or: [
          { lastHeartbeat: { $lt: cutoff } },
          { lastHeartbeat: null, startedAt: { $lt: cutoff } },
          { lastHeartbeat: null, startedAt: null },
        ],
      };
    }

    const streams = await Stream.find(query);
    if (streams.length === 0) return;

    let count = 0;
    for (const s of streams) {
      const dur = s.startedAt ? Math.floor((Date.now() - new Date(s.startedAt)) / 1000) : 0;
      const durMin = Math.floor(dur / 60);
      if (durMin > 0) {
        await User.findByIdAndUpdate(s.streamerId, {
          $inc: { totalStreamMinutes: durMin, monthlyStreamMinutes: durMin },
        });
      }
      io.to(`stream_${s._id}`).emit('stream_ended', { streamId: s._id, reason: 'abandoned' });
      // Delete the document so it doesn't linger as a stale entry on the profile
      await Stream.findByIdAndDelete(s._id);
      count++;
    }
    console.log(`🧹 Cleaned up ${count} ${onStartup ? 'startup' : 'abandoned'} streams`);
  } catch (e) { console.error('Cleanup error:', e); }
}

// On startup: end all — they are ghost sessions from before restart
// Periodic: only stale ones
setInterval(() => cleanupAbandonedStreams(false), 5 * 60 * 1000);

// ── In-memory state ───────────────────────────────────────────────────────────
const activeUsers   = new Map(); // socketId -> userData
const streamViewers = new Map(); // streamId -> Set<socketId>
const userSockets   = new Map(); // userId   -> socketId

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('authenticate', async (data) => {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'lyvstreem-secret');
      const user = await User.findById(decoded.userId).select('username displayName avatar');
      if (user) {
        const ud = { userId: user._id.toString(), username: user.username, displayName: user.displayName, avatar: user.avatar };
        activeUsers.set(socket.id, ud);
        userSockets.set(user._id.toString(), socket.id);
        socket.join(`user_${user._id}`);
        socket.emit('authenticated', { user, socketId: socket.id });
      }
    } catch { socket.emit('auth_error', { message: 'Invalid token' }); }
  });

  // ── Host heartbeat — prevents ghost streams ─────────────────────────────
  socket.on('host_heartbeat', async ({ streamId }) => {
    const ud = activeUsers.get(socket.id);
    if (!ud || !streamId) return;
    // Only the actual host of the stream can heartbeat it
    const updated = await Stream.findOneAndUpdate(
      { _id: streamId, streamerId: ud.userId, isLive: true },
      { lastHeartbeat: new Date() }
    );
    // Make sure the host's socket is joined to its own stream room so
    // broadcasts (background changes, sound effects, viewer count, gifts,
    // etc.) actually reach them.
    if (updated) {
      const room = `stream_${streamId}`;
      if (!socket.rooms.has(room)) socket.join(room);
    }
  });

  socket.on('join_stream', async ({ streamId }) => {
    socket.join(`stream_${streamId}`);
    if (!streamViewers.has(streamId)) streamViewers.set(streamId, new Set());
    streamViewers.get(streamId).add(socket.id);

    const count = streamViewers.get(streamId).size;
    await Stream.findByIdAndUpdate(streamId, { viewerCount: count });
    io.to(`stream_${streamId}`).emit('viewer_count', { count });

    const userData = activeUsers.get(socket.id);
    if (userData) io.to(`stream_${streamId}`).emit('user_joined', { user: userData, socketId: socket.id });

    const messages = await ChatMessage.find({ streamId })
      .populate('userId', 'username displayName avatar')
      .sort({ timestamp: -1 }).limit(50).lean();
    socket.emit('chat_history', messages.reverse());

    // Send moderation state to new viewer
    const stream = await Stream.findById(streamId).select('admins mutedUsers blockedUsers backgroundImage allowComments');
    if (stream) {
      const ud = activeUsers.get(socket.id);
      if (ud) {
        const isAdmin   = stream.admins.map(a => a.toString()).includes(ud.userId);
        const isMuted   = stream.mutedUsers.map(m => m.toString()).includes(ud.userId);
        const isBlocked = stream.blockedUsers.map(b => b.toString()).includes(ud.userId);
        if (isBlocked) { socket.emit('you_are_kicked', { streamId, blocked: true }); socket.leave(`stream_${streamId}`); return; }
        socket.emit('your_mod_state', { isAdmin, isMuted, streamId, backgroundImage: stream.backgroundImage || '' });
      }
      socket.emit('stream_background_changed', { backgroundImage: stream.backgroundImage || '' });
    }

    // PK battle
    const battle = await PKBattle.findOne({ $or: [{ streamA: streamId }, { streamB: streamId }], status: { $in: ['pending', 'active'] } })
      .populate('streamerA', 'username displayName avatar').populate('streamerB', 'username displayName avatar');
    if (battle) socket.emit('pk_active', battle);

    // Room state
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

  socket.on('send_message', async ({ streamId, message }) => {
    const userData = activeUsers.get(socket.id);
    if (!userData || !message?.trim()) return;

    // Check if user is muted
    const stream = await Stream.findById(streamId).select('mutedUsers allowComments');
    if (!stream?.allowComments) return;
    if (stream.mutedUsers.map(m => m.toString()).includes(userData.userId)) {
      socket.emit('chat_error', { message: 'You are muted in this stream' });
      return;
    }

    const msg = new ChatMessage({ streamId, userId: userData.userId, message: message.trim().substring(0, 300), type: 'message' });
    await msg.save();
    io.to(`stream_${streamId}`).emit('new_message', {
      _id: msg._id,
      userId: { _id: userData.userId, username: userData.username, displayName: userData.displayName, avatar: userData.avatar },
      message: msg.message, type: 'message', timestamp: msg.timestamp,
    });
  });

  // NOTE: coin debit (sender) and credit (host's earningCoins) are handled
  // atomically by POST /api/gifts/send. This handler ONLY records the chat
  // message and broadcasts the gift event. Do not write financial state here.
  socket.on('send_gift', async ({ streamId, giftId, giftName, giftEmoji, giftValue, giftRarity, giftEffect, giftColor, pkBattleId, pkSide }) => {
    const userData = activeUsers.get(socket.id);
    if (!userData) return;
    if (!streamId) return;

    // Validate stream actually exists and is the one the user is in
    const stream = await Stream.findById(streamId).select('streamerId isLive');
    if (!stream) return;
    // Cap giftValue to a sane number — used only for chat-message metadata
    const safeValue = Math.max(0, Math.min(parseInt(giftValue) || 0, 100000));

    const msg = new ChatMessage({
      streamId, userId: userData.userId, message: `sent ${giftName}`, type: 'gift',
      giftInfo: { giftType: giftName, giftValue: safeValue, giftCount: 1, giftEmoji, giftRarity, giftEffect, giftColor },
    });
    await msg.save();

    if (pkBattleId && pkSide && (pkSide === 'A' || pkSide === 'B')) {
      const field = pkSide === 'A' ? 'coinsA' : 'coinsB';
      // Atomic increment + status guard — also verifies the streamId is part of the battle
      const battle = await PKBattle.findOneAndUpdate(
        {
          _id: pkBattleId,
          status: 'active',
          $or: [{ streamA: streamId }, { streamB: streamId }],
        },
        { $inc: { [field]: safeValue } },
        { new: true }
      );
      if (battle) {
        const p = { battleId: battle._id, coinsA: battle.coinsA, coinsB: battle.coinsB };
        io.to(`stream_${battle.streamA}`).emit('pk_update', p);
        io.to(`stream_${battle.streamB}`).emit('pk_update', p);
      }
    }

    const giftPayload = {
      _id: msg._id,
      userId: { _id: userData.userId, username: userData.username, displayName: userData.displayName, avatar: userData.avatar },
      message: `sent ${giftName}`, type: 'gift',
      giftInfo: { giftType: giftName, giftValue: safeValue, giftEmoji, giftRarity, giftEffect, giftColor },
      timestamp: msg.timestamp,
    };
    io.to(`stream_${streamId}`).emit('new_message', giftPayload);
    io.to(`stream_${streamId}`).emit('gift_received', giftPayload);
  });

  socket.on('start_stream', async ({ streamId }) => {
    const ud = activeUsers.get(socket.id);
    if (!ud || !streamId) return;
    // Only the host can start their own stream
    const s = await Stream.findOneAndUpdate(
      { _id: streamId, streamerId: ud.userId },
      { isLive: true, startedAt: new Date(), lastHeartbeat: new Date() },
      { new: true }
    ).populate('streamerId', 'username displayName avatar');
    if (s) {
      // Host joins their own stream room so broadcasts reach them too
      socket.join(`stream_${streamId}`);
      io.emit('stream_started', { stream: s });
    }
  });

  socket.on('end_stream', async ({ streamId }) => {
    const ud = activeUsers.get(socket.id);
    if (!ud || !streamId) return;
    const s = await Stream.findById(streamId);
    if (s && s.streamerId.toString() !== ud.userId) return; // only host can end
    if (s && s.isLive && s.startedAt) {
      const dur = Math.floor((new Date() - new Date(s.startedAt)) / 1000);
      const hostUser = await User.findById(s.streamerId);
      if (hostUser) {
        const now = new Date(); const lr = new Date(hostUser.lastMonthlyReset);
        if (now.getMonth() !== lr.getMonth() || now.getFullYear() !== lr.getFullYear()) { hostUser.monthlyStreamMinutes = 0; hostUser.lastMonthlyReset = now; }
        hostUser.monthlyStreamMinutes += Math.floor(dur / 60);
        hostUser.totalStreamMinutes   += Math.floor(dur / 60);
        await hostUser.save();
      }
      await RoomSession.findOneAndUpdate({ streamId }, { isActive: false });
      io.to(`stream_${streamId}`).emit('stream_ended', { streamId });
      io.emit('stream_offline', { streamId });
      // Delete the stream so it does not linger on the host's profile
      await Stream.findByIdAndDelete(streamId);
    }
  });

  socket.on('react', ({ streamId, reaction }) => {
    const ud = activeUsers.get(socket.id);
    io.to(`stream_${streamId}`).emit('new_reaction', { reaction, userId: ud?.userId });
  });

  socket.on('host_media_state', async ({ streamId, camOn, micOn }) => {
    const ud = activeUsers.get(socket.id);
    if (!ud || !streamId) return;
    // Only the host of the stream can broadcast media state
    const stream = await Stream.findById(streamId).select('streamerId');
    if (!stream || stream.streamerId.toString() !== ud.userId) return;
    socket.to(`stream_${streamId}`).emit('host_media_state', { camOn, micOn });
  });

  // ── Room signaling ────────────────────────────────────────────────────────
  socket.on('room_request_seat', async ({ streamId, seatIndex }) => {
    const userData = activeUsers.get(socket.id);
    if (!userData) return socket.emit('room_error', { message: 'Not authenticated' });
    const room = await RoomSession.findOne({ streamId, isActive: true });
    if (!room) return socket.emit('room_error', { message: 'No room active' });
    const seat = room.seats[seatIndex];
    if (!seat) return socket.emit('room_error', { message: 'Seat not found' });
    if (seat.isLocked) return socket.emit('room_error', { message: 'Seat is locked' });
    if (seat.userId) return socket.emit('room_error', { message: 'Seat occupied' });
    io.to(`user_${room.hostId}`).emit('room_seat_request', { streamId, seatIndex, user: userData, socketId: socket.id });
    socket.emit('room_seat_request_sent', { seatIndex });
  });

  socket.on('room_approve_seat', async ({ streamId, seatIndex, targetSocketId, targetUserId, targetUser }) => {
    const ud = activeUsers.get(socket.id);
    if (!ud) return;
    const room = await RoomSession.findOne({ streamId, hostId: ud.userId, isActive: true });
    if (!room) return;
    const seat = room.seats[seatIndex];
    if (!seat || seat.isLocked || seat.userId) return socket.emit('room_error', { message: 'Seat unavailable' });
    room.seats[seatIndex] = { seatIndex, userId: targetUserId, username: targetUser.username, displayName: targetUser.displayName, avatar: targetUser.avatar, socketId: targetSocketId, isLocked: false, isMuted: room.allMuted, hasVideo: room.mode === 'video', hasAudio: true, joinedAt: new Date() };
    await room.save();
    io.to(targetSocketId).emit('room_seat_approved', { seatIndex, mode: room.mode, isMuted: room.allMuted, streamId });
    io.to(`stream_${streamId}`).emit('seat_updated', { seats: room.seats });
  });

  socket.on('room_deny_seat', ({ targetSocketId, seatIndex }) => {
    io.to(targetSocketId).emit('room_seat_denied', { seatIndex });
  });

  socket.on('room_join_seat', async ({ streamId, seatIndex }) => {
    const ud = activeUsers.get(socket.id);
    if (!ud) return;
    const room = await RoomSession.findOne({ streamId, isActive: true });
    if (!room) return;
    const seat = room.seats[seatIndex];
    if (!seat || seat.userId?.toString() !== ud.userId) return;
    room.seats[seatIndex].socketId = socket.id;
    await room.save();
    socket.join(`seat_${streamId}_${seatIndex}`);
    const existingSeats = room.seats.filter((s, i) => s.userId && i !== seatIndex);
    existingSeats.forEach(s => { if (s.socketId) io.to(s.socketId).emit('room_new_peer', { peerId: socket.id, peerUser: ud, seatIndex, shouldInitiate: true }); });
    io.to(`user_${room.hostId}`).emit('room_new_peer', { peerId: socket.id, peerUser: ud, seatIndex, shouldInitiate: true });
    socket.emit('room_peers_list', { peers: existingSeats.map(s => ({ socketId: s.socketId, seatIndex: s.seatIndex, user: { userId: s.userId, displayName: s.displayName, avatar: s.avatar } })), hostSocketId: userSockets.get(room.hostId.toString()) });
    io.to(`stream_${streamId}`).emit('seat_updated', { seats: room.seats });
  });

  socket.on('room_leave_seat', async ({ streamId, seatIndex }) => {
    const ud = activeUsers.get(socket.id);
    if (!ud) return;
    const room = await RoomSession.findOne({ streamId, isActive: true });
    if (!room || room.seats[seatIndex]?.userId?.toString() !== ud.userId) return;
    room.seats[seatIndex] = { seatIndex, isLocked: false, isMuted: false };
    await room.save();
    socket.leave(`seat_${streamId}_${seatIndex}`);
    io.to(`stream_${streamId}`).emit('seat_updated', { seats: room.seats });
    io.to(`stream_${streamId}`).emit('room_peer_left', { peerId: socket.id, seatIndex });
  });

  socket.on('room_self_mute', async ({ streamId, seatIndex, muted }) => {
    const room = await RoomSession.findOne({ streamId, isActive: true });
    if (!room || room.seats[seatIndex]?.isMuted) return;
    room.seats[seatIndex].hasAudio = !muted;
    await room.save();
    io.to(`stream_${streamId}`).emit('seat_updated', { seats: room.seats });
  });

  socket.on('room_self_video', async ({ streamId, seatIndex, videoOn }) => {
    const room = await RoomSession.findOne({ streamId, isActive: true });
    if (!room || room.mode !== 'video') return;
    if (room.seats[seatIndex]) { room.seats[seatIndex].hasVideo = videoOn; await room.save(); io.to(`stream_${streamId}`).emit('seat_updated', { seats: room.seats }); }
  });

  socket.on('rtc_offer',         ({ targetSocketId, offer, seatIndex })     => io.to(targetSocketId).emit('rtc_offer',         { fromSocketId: socket.id, offer, seatIndex }));
  socket.on('rtc_answer',        ({ targetSocketId, answer, seatIndex })    => io.to(targetSocketId).emit('rtc_answer',        { fromSocketId: socket.id, answer, seatIndex }));
  socket.on('rtc_ice_candidate', ({ targetSocketId, candidate, seatIndex }) => io.to(targetSocketId).emit('rtc_ice_candidate', { fromSocketId: socket.id, candidate, seatIndex }));

  // ── Solo-mode WebRTC: viewers (auth or guest) receive the host's video ──
  // Pure relay between the viewer's socket and the live host's socket. Auth
  // is intentionally not required so non-logged-in guests can watch too.
  socket.on('solo_request_stream', async ({ streamId }) => {
    if (!streamId) return;
    try {
      const s = await Stream.findById(streamId).select('streamerId isLive');
      if (!s || !s.isLive) return socket.emit('solo_host_offline', { streamId });
      // Emit to the host's user room (every authenticated socket of theirs
      // joined `user_<id>` on authenticate). Routing by room — instead of by
      // a single tracked socketId — means it reaches ALL of the host's
      // tabs/devices, and only the one with HostStreamBroadcaster active
      // (i.e. the one actually streaming) responds.
      if (!userSockets.has(s.streamerId.toString())) {
        return socket.emit('solo_host_offline', { streamId });
      }
      io.to(`user_${s.streamerId}`).emit('solo_viewer_wants_stream', { viewerSocketId: socket.id, streamId });
    } catch (_) {}
  });

  socket.on('solo_offer', ({ targetSocketId, offer, streamId }) => {
    if (!targetSocketId || !offer) return;
    io.to(targetSocketId).emit('solo_offer', { fromSocketId: socket.id, offer, streamId });
  });

  socket.on('solo_answer', ({ targetSocketId, answer, streamId }) => {
    if (!targetSocketId || !answer) return;
    io.to(targetSocketId).emit('solo_answer', { fromSocketId: socket.id, answer, streamId });
  });

  socket.on('solo_ice', ({ targetSocketId, candidate }) => {
    if (!targetSocketId || !candidate) return;
    io.to(targetSocketId).emit('solo_ice', { fromSocketId: socket.id, candidate });
  });

  socket.on('disconnect', async () => {
    const ud = activeUsers.get(socket.id);
    activeUsers.delete(socket.id);
    if (ud) userSockets.delete(ud.userId);

    // If this socket was a HOST of any live stream, mark its heartbeat
    // far enough back that the next periodic sweep will end it,
    // and (if no reconnect happens within ~60s) end + delete it now.
    if (ud) {
      try {
        const hostStreams = await Stream.find({ streamerId: ud.userId, isLive: true });
        for (const hs of hostStreams) {
          // Push heartbeat to "stale-ish" — gives a brief window for reconnect
          await Stream.findByIdAndUpdate(hs._id, {
            lastHeartbeat: new Date(Date.now() - (9 * 60 * 1000)),
          });
          // Hard-end after 60s if no reconnect (no new heartbeat)
          setTimeout(async () => {
            try {
              const fresh = await Stream.findById(hs._id);
              if (!fresh || !fresh.isLive) return;
              const last = fresh.lastHeartbeat ? new Date(fresh.lastHeartbeat).getTime() : 0;
              if (Date.now() - last < 60 * 1000) return; // host reconnected
              const dur = fresh.startedAt ? Math.floor((Date.now() - new Date(fresh.startedAt)) / 1000) : 0;
              const durMin = Math.floor(dur / 60);
              if (durMin > 0) {
                await User.findByIdAndUpdate(fresh.streamerId, {
                  $inc: { totalStreamMinutes: durMin, monthlyStreamMinutes: durMin },
                });
              }
              io.to(`stream_${fresh._id}`).emit('stream_ended', { streamId: fresh._id, reason: 'host_disconnected' });
              await Stream.findByIdAndDelete(fresh._id);
            } catch (_) {}
          }, 60 * 1000);
        }
      } catch (_) {}
    }

    for (const [streamId, viewers] of streamViewers.entries()) {
      if (viewers.has(socket.id)) {
        viewers.delete(socket.id);
        const count = viewers.size;
        await Stream.findByIdAndUpdate(streamId, { viewerCount: count });
        io.to(`stream_${streamId}`).emit('viewer_count', { count });
        // Tell the stream's host to tear down any solo-mode peer connection
        // that was serving this viewer. Emit to the host's user room so it
        // reaches whichever tab is actively broadcasting.
        try {
          const s = await Stream.findById(streamId).select('streamerId');
          if (s && userSockets.has(s.streamerId.toString())) {
            io.to(`user_${s.streamerId}`).emit('solo_viewer_left', { viewerSocketId: socket.id });
          }
        } catch (_) {}
        if (ud) {
          const room = await RoomSession.findOne({ streamId, isActive: true });
          if (room) {
            const si = room.seats.findIndex(s => s.userId?.toString() === ud.userId && s.socketId === socket.id);
            if (si >= 0) {
              io.to(`stream_${streamId}`).emit('room_peer_left', { peerId: socket.id, seatIndex: si });
              room.seats[si] = { seatIndex: si, isLocked: false, isMuted: false };
              await room.save();
              io.to(`stream_${streamId}`).emit('seat_updated', { seats: room.seats });
            }
          }
        }
      }
    }
  });
});

app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 LyvStreem on port ${PORT}`));
module.exports = { app, server, io };
