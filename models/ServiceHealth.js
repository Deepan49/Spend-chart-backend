const mongoose = require('mongoose');

const serviceHealthSchema = new mongoose.Schema({
  serviceName: { 
    type: String, 
    required: true, 
    unique: true, 
    enum: ['mongodb', 'gemini_ai', 'yahoo_finance', 'email_service', 'backend_api'] 
  },
  displayName: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['healthy', 'degraded', 'down'], 
    default: 'healthy' 
  },
  responseTimeMs: { type: Number, default: 0 },
  lastChecked: { type: Date, default: Date.now },
  errorRatePercent: { type: Number, default: 0 },
  message: { type: String },
  history: [{
    status: { type: String },
    responseTimeMs: { type: Number },
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('ServiceHealth', serviceHealthSchema);
