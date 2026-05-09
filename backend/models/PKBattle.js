const mongoose = require('mongoose');

const pkBattleSchema = new mongoose.Schema({
  streamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream', required: true },
  streamerA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  streamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream', required: true },
  streamerB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'active', 'ended'], default: 'pending' },
  coinsA: { type: Number, default: 0 },
  coinsB: { type: Number, default: 0 },
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  durationMinutes: { type: Number, default: 10 },
  endsAt: { type: Date },
  startedAt: { type: Date },
  endedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PKBattle', pkBattleSchema);
