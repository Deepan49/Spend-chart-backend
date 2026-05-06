const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol: { type: String, required: true },
  shares: { type: Number, required: true },
  avgPrice: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Holding', holdingSchema);
