const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true }, // e.g., 'Food', 'Entertainment', 'All'
  limit: { type: Number, required: true },
  period: { type: String, enum: ['weekly', 'monthly', 'yearly'], default: 'monthly' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Budget', budgetSchema);
