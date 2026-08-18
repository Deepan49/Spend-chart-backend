const mongoose = require('mongoose');

const goldSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true }, // e.g., '24K Physical Gold Bar', 'Tanishq Digital Gold', 'SGB 2023-24'
  type: { type: String, enum: ['physical', 'digital', 'sgb'], default: 'physical' },
  weightGrams: { type: Number, required: true },
  buyPricePerGram: { type: Number, required: true },
  totalAmountPaid: { type: Number, required: true },
  purchaseDate: { type: Date, default: Date.now },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Gold', goldSchema);
