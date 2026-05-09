const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, trim: true, lowercase: true },
  email: { type: String, unique: true, required: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  displayName: { type: String, trim: true },
  bio: { type: String, maxlength: 300 },
  avatar: { type: String, default: '' },
  coverImage: { type: String, default: '' },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  totalFollowers: { type: Number, default: 0 },
  totalFollowing: { type: Number, default: 0 },
  totalLikes: { type: Number, default: 0 },

  // Viewer coins (for buying gifts)
  coins: { type: Number, default: 0 },

  // Host earnings system (separate wallet)
  earningCoins: { type: Number, default: 0 },
  totalEarningsCoins: { type: Number, default: 0 },
  totalWithdrawnCoins: { type: Number, default: 0 },
  withdrawalCount: { type: Number, default: 0 },
  bankDetails: {
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    bankName: { type: String, default: '' },
    bankCode: { type: String, default: '' },
  },

  // Streaming hours (minutes internally)
  totalStreamMinutes: { type: Number, default: 0 },
  monthlyStreamMinutes: { type: Number, default: 0 },
  lastMonthlyReset: { type: Date, default: Date.now },

  isStreamer: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: false },
  level: { type: Number, default: 1 },
  exp: { type: Number, default: 0 },
  badges: [{ type: String }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  notificationSettings: {
    newFollower: { type: Boolean, default: true },
    giftReceived: { type: Boolean, default: true },
    streamStart: { type: Boolean, default: true },
  },

  // User Wall — auto-captured short clips from live streams
  wallEnabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
});

userSchema.index({ username: 'text', displayName: 'text' });
module.exports = mongoose.model('User', userSchema);
