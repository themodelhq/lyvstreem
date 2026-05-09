const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coinsRequested: { type: Number, required: true },
  nairaAmount: { type: Number, required: true },       // coinsRequested / 210 * 1300
  status: { type: String, enum: ['pending', 'processing', 'completed', 'rejected'], default: 'pending' },
  bankDetails: {
    accountName: String,
    accountNumber: String,
    bankName: String,
    bankCode: String,
  },
  isFirstWithdrawal: { type: Boolean, default: false },
  monthlyMinutesMet: { type: Number },   // snapshot of monthly minutes at time of request
  adminNote: { type: String },
  processedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
