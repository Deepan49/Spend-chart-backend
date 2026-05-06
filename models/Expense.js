const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  type: { type: String, enum: ['income', 'expense'], default: 'expense' },
  source: { type: String, enum: ['sms', 'manual'], default: 'manual' },
  notes: { type: String },
  paymentMethod: { type: String },
  date: { type: Date, default: Date.now },
  isRecurring: { type: Boolean, default: false },
  recurringFrequency: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
