const mongoose = require('mongoose');

const streamSchema = new mongoose.Schema({
  streamerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String },
  category: { type: String, default: 'Entertainment' },
  tags: [{ type: String }],
  isLive: { type: Boolean, default: false },
  thumbnail: { type: String, default: '' },
  streamKey: { type: String, unique: true },
  viewerCount: { type: Number, default: 0 },
  totalViewers: { type: Number, default: 0 },
  peakViewers: { type: Number, default: 0 },
  duration: { type: Number, default: 0 },
  totalGiftsValue: { type: Number, default: 0 },
  language: { type: String, default: 'en' },
  startedAt: { type: Date },
  endedAt: { type: Date },
  allowComments: { type: Boolean, default: true },
  isAdultContent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

streamSchema.index({ isLive: 1, viewerCount: -1 });
streamSchema.index({ streamerId: 1 });
streamSchema.index({ category: 1 });

module.exports = mongoose.model('Stream', streamSchema);
