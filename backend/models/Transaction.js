const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reference: { type: String, unique: true, required: true },
  amount: { type: Number, required: true }, // in kobo/pesewas
  currency: { type: String, default: 'NGN' },
  coins: { type: Number, required: true }, // coins credited
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  paystackId: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Transaction', transactionSchema);
