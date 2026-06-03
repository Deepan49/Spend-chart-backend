const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['bank', 'credit', 'investment', 'cash', 'wallet', 'credit_card'], default: 'bank' },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  startingBalance: { type: Number, default: 0 },
  creditLimit: { type: Number },
  dueDate: { type: Number }
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
