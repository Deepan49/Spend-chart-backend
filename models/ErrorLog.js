const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  errorId: { type: String, required: true, unique: true },
  errorType: { 
    type: String, 
    enum: ['crash', 'api_failure', 'parse_failure', 'auth_failure', 'network_failure'], 
    default: 'api_failure' 
  },
  platform: { type: String, default: 'android' },
  appVersion: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: { type: String },
  endpoint: { type: String },
  message: { type: String, required: true },
  stackTrace: { type: String },
  occurrenceCount: { type: Number, default: 1 },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['new', 'investigating', 'resolved', 'ignored'], 
    default: 'new' 
  }
}, { timestamps: true });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
