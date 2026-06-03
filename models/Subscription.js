const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  frequency: { type: String, enum: ['Weekly', 'Bi-weekly', 'Monthly', 'Yearly'], required: true },
  nextDueDate: { type: Date, required: true },
  category: { type: String, required: true },
  isAutoDetected: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
