const mongoose = require('mongoose');

const broadcastNotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  targetAudience: { 
    type: String, 
    enum: ['all', 'android', 'ios', 'verified_only', 'beta_testers'], 
    default: 'all' 
  },
  status: { 
    type: String, 
    enum: ['draft', 'scheduled', 'sent', 'cancelled'], 
    default: 'draft' 
  },
  scheduledAt: { type: Date },
  sentAt: { type: Date },
  sentBy: { type: String },
  deliveryCount: { type: Number, default: 0 },
  openRatePercent: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('BroadcastNotification', broadcastNotificationSchema);
