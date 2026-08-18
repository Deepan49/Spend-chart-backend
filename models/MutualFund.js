const mongoose = require('mongoose');

const mutualFundSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  schemeName: { type: String, required: true },
  schemeCode: { type: String },
  units: { type: Number, required: true },
  buyNav: { type: Number, required: true },
  currentNav: { type: Number, default: 0 },
  totalInvested: { type: Number, required: true },
  purchaseDate: { type: Date, default: Date.now },
  category: { type: String, default: 'Equity' }
}, { timestamps: true });

module.exports = mongoose.model('MutualFund', mutualFundSchema);
