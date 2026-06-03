const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['bank', 'credit', 'investment', 'cash'], default: 'bank' },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' }
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
