const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  type: { type: String, enum: ['income', 'expense'], default: 'expense' },
  source: { type: String, enum: ['sms', 'manual', 'import'], default: 'manual' },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  notes: { type: String },
  paymentMethod: { type: String },
  date: { type: Date, default: Date.now },
  isRecurring: { type: Boolean, default: false },
  recurringFrequency: { type: String },
  
  // Missing fields from the frontend Transaction model
  account: { type: String },
  bankName: { type: String },
  time: { type: String },
  attachmentPath: { type: String },
  isInvestment: { type: Boolean, default: false },
  assetType: { type: String },
  units: { type: Number },
  pricePerUnit: { type: Number },
  platform: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
