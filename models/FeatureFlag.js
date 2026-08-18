const mongoose = require('mongoose');

const featureFlagSchema = new mongoose.Schema({
  featureKey: { type: String, required: true, unique: true, trim: true },
  displayName: { type: String, required: true },
  description: { type: String },
  platform: { 
    type: String, 
    enum: ['all', 'android', 'ios', 'web'], 
    default: 'all' 
  },
  status: { 
    type: String, 
    enum: ['enabled', 'disabled', 'beta'], 
    default: 'enabled' 
  },
  rolloutPercentage: { type: Number, min: 0, max: 100, default: 100 },
  notes: { type: String },
  lastModifiedBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('FeatureFlag', featureFlagSchema);
