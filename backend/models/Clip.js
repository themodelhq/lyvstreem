const mongoose = require('mongoose');

const clipSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  streamId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Stream' },
  title:       { type: String, default: '' },
  category:    { type: String, default: 'Entertainment' },
  // Inline data URL of the captured webm clip (kept short — typically < 4 MB)
  videoData:   { type: String, required: true },
  // Inline data URL of a JPEG thumbnail captured at the time of recording
  thumbnail:   { type: String, default: '' },
  duration:    { type: Number, default: 0 }, // seconds
  capturedAt:  { type: Date,   default: Date.now },
});

clipSchema.index({ userId: 1, capturedAt: -1 });

module.exports = mongoose.model('Clip', clipSchema);
