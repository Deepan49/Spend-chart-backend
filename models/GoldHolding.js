const mongoose = require('mongoose');

const goldHoldingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  metalType: { type: String, required: true }, // 'GOLD' or 'SILVER'
  purity: { type: String, required: true },
  weight: { type: Number, required: true },
  avgPrice: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('GoldHolding', goldHoldingSchema);
