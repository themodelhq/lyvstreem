const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  streamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['message', 'gift', 'system', 'follow'], default: 'message' },
  giftInfo: {
    giftType: String,
    giftValue: Number,
    giftCount: Number,
    giftEmoji: String,
    giftRarity: String,
    giftEffect: String,
  },
  isModerator: { type: Boolean, default: false },
  isVip: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
});

chatMessageSchema.index({ streamId: 1, timestamp: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
