const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  seatIndex: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username: { type: String, default: '' },
  displayName: { type: String, default: '' },
  avatar: { type: String, default: '' },
  socketId: { type: String, default: '' },
  isLocked: { type: Boolean, default: false },
  isMuted: { type: Boolean, default: false },
  hasVideo: { type: Boolean, default: false },
  hasAudio: { type: Boolean, default: false },
  coinsGiven: { type: Number, default: 0 },
  joinedAt: { type: Date },
}, { _id: false });

const roomSessionSchema = new mongoose.Schema({
  streamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream', required: true, unique: true },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mode: { type: String, enum: ['solo', 'audio', 'video'], default: 'solo' },
  maxSeats: { type: Number, default: 0 },
  seats: [seatSchema],
  allMuted: { type: Boolean, default: false },
  backgroundWallpaper: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

roomSessionSchema.pre('save', function(next) { this.updatedAt = new Date(); next(); });
module.exports = mongoose.model('RoomSession', roomSessionSchema);
