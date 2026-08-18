const mongoose = require('mongoose');

const bondSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bondName: { type: String, required: true },
  issuer: { type: String, required: true },
  units: { type: Number, required: true },
  faceValue: { type: Number, required: true },
  couponRate: { type: Number, required: true }, // e.g. 7.5 for 7.5% per annum
  purchasePrice: { type: Number, required: true },
  totalInvested: { type: Number, required: true },
  purchaseDate: { type: Date, default: Date.now },
  maturityDate: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Bond', bondSchema);
