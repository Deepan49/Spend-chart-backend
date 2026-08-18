const FeatureFlag = require('../models/FeatureFlag');
const { logAdminAction } = require('../utils/adminAuditLogger');

// Default initial feature flags
const DEFAULT_FLAGS = [
  {
    featureKey: 'sms_auto_import',
    displayName: 'Automatic SMS Import',
    description: 'Real-time SMS detection and background transaction parsing',
    platform: 'android',
    status: 'enabled',
    rolloutPercentage: 100,
    notes: 'Core Android SMS parsing pipeline'
  },
  {
    featureKey: 'gemini_smart_insights',
    displayName: 'Gemini AI Insights',
    description: 'AI-generated personal financial coaching & spending advice',
    platform: 'all',
    status: 'enabled',
    rolloutPercentage: 100,
    notes: 'Google Gemini API Powered'
  },
  {
    featureKey: 'pdf_statement_import',
    displayName: 'PDF Statement Import',
    description: 'Upload bank PDF/Excel statements to extract historical transactions',
    platform: 'all',
    status: 'enabled',
    rolloutPercentage: 100,
    notes: 'Syncfusion PDF extraction engine'
  },
  {
    featureKey: 'portfolio_bonds_stocks',
    displayName: 'Investments & Portfolio',
    description: 'Stock, Mutual Fund, Gold & Bond price tracking with live market quotes',
    platform: 'all',
    status: 'enabled',
    rolloutPercentage: 100,
    notes: 'Yahoo Finance quote sync'
  },
  {
    featureKey: 'biometric_app_lock',
    displayName: 'Biometric & PIN Security',
    description: 'Inactivity auto-lock with 1-hour session retention and fingerprint protection',
    platform: 'all',
    status: 'enabled',
    rolloutPercentage: 100,
    notes: 'Local auth biometric hardware security'
  }
];

async function seedDefaultFlags() {
  try {
    const count = await FeatureFlag.countDocuments();
    if (count === 0) {
      await FeatureFlag.insertMany(DEFAULT_FLAGS);
      console.log('✅ Default Feature Flags initialized');
    }
  } catch (err) {
    console.error('Error seeding default feature flags:', err);
  }
}

seedDefaultFlags();

exports.getFeatureFlags = async (req, res) => {
  try {
    const flags = await FeatureFlag.find().sort({ createdAt: -1 });
    res.json({ success: true, flags });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createFeatureFlag = async (req, res) => {
  try {
    const { featureKey, displayName, description, platform, status, rolloutPercentage, notes } = req.body;
    if (!featureKey || !displayName) {
      return res.status(400).json({ success: false, message: 'featureKey and displayName are required' });
    }

    const existing = await FeatureFlag.findOne({ featureKey: featureKey.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Feature flag key already exists' });
    }

    const flag = new FeatureFlag({
      featureKey: featureKey.trim().toLowerCase(),
      displayName: displayName.trim(),
      description,
      platform: platform || 'all',
      status: status || 'enabled',
      rolloutPercentage: rolloutPercentage !== undefined ? rolloutPercentage : 100,
      notes,
      lastModifiedBy: req.admin.email
    });

    await flag.save();

    await logAdminAction({
      req,
      action: 'feature_flag_created',
      targetType: 'feature_flag',
      targetId: flag._id,
      details: { featureKey: flag.featureKey, status: flag.status, rolloutPercentage: flag.rolloutPercentage }
    });

    res.status(201).json({ success: true, message: 'Feature flag created', flag });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, description, platform, status, rolloutPercentage, notes } = req.body;

    const flag = await FeatureFlag.findById(id);
    if (!flag) {
      return res.status(404).json({ success: false, message: 'Feature flag not found' });
    }

    if (displayName !== undefined) flag.displayName = displayName;
    if (description !== undefined) flag.description = description;
    if (platform !== undefined) flag.platform = platform;
    if (status !== undefined) flag.status = status;
    if (rolloutPercentage !== undefined) flag.rolloutPercentage = rolloutPercentage;
    if (notes !== undefined) flag.notes = notes;
    flag.lastModifiedBy = req.admin.email;

    await flag.save();

    await logAdminAction({
      req,
      action: 'feature_flag_updated',
      targetType: 'feature_flag',
      targetId: flag._id,
      details: { featureKey: flag.featureKey, status: flag.status, rolloutPercentage: flag.rolloutPercentage }
    });

    res.json({ success: true, message: 'Feature flag updated', flag });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const flag = await FeatureFlag.findByIdAndDelete(id);
    if (!flag) {
      return res.status(404).json({ success: false, message: 'Feature flag not found' });
    }

    await logAdminAction({
      req,
      action: 'feature_flag_deleted',
      targetType: 'feature_flag',
      targetId: id,
      details: { featureKey: flag.featureKey }
    });

    res.json({ success: true, message: 'Feature flag deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Client Endpoint: /api/features/active (Public or User-authed)
exports.getActiveFlagsForClient = async (req, res) => {
  try {
    const platform = req.query.platform || 'all';
    const flags = await FeatureFlag.find({
      status: { $in: ['enabled', 'beta'] },
      platform: { $in: ['all', platform] }
    }).select('featureKey displayName status rolloutPercentage');

    const config = {};
    for (const f of flags) {
      config[f.featureKey] = {
        enabled: f.status === 'enabled' || f.status === 'beta',
        rolloutPercentage: f.rolloutPercentage
      };
    }

    res.json({ success: true, features: config });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
