const mongoose = require('mongoose');

const bondHoldingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bondName: { type: String, required: true },
  faceValue: { type: Number, required: true },
  quantity: { type: Number, required: true },
  buyPrice: { type: Number, required: true },
  couponRate: { type: Number, required: true },
  maturityDate: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('BondHolding', bondHoldingSchema);
