const mongoose = require('mongoose');

const mfHoldingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  schemeCode: { type: String, required: true },
  schemeName: { type: String, required: true },
  units: { type: Number, required: true },
  avgNav: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('MfHolding', mfHoldingSchema);
