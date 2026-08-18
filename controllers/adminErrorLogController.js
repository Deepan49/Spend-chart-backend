const ErrorLog = require('../models/ErrorLog');
const { logAdminAction } = require('../utils/adminAuditLogger');

exports.getErrors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.errorType) filter.errorType = req.query.errorType;
    if (req.query.platform) filter.platform = req.query.platform;
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { message: regex },
        { stackTrace: regex },
        { endpoint: regex },
        { errorId: regex }
      ];
    }

    const total = await ErrorLog.countDocuments(filter);
    const errors = await ErrorLog.find(filter)
      .populate('userId', 'name email')
      .sort({ lastSeen: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      errors
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateErrorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const error = await ErrorLog.findById(id);
    if (!error) {
      return res.status(404).json({ success: false, message: 'Error log not found' });
    }

    error.status = status;
    await error.save();

    await logAdminAction({
      req,
      action: 'error_status_updated',
      targetType: 'error_log',
      targetId: error._id,
      details: { errorId: error.errorId, status }
    });

    res.json({ success: true, message: `Error status updated to ${status}`, error });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Client and Backend Error Reporting API
exports.logError = async (req, res) => {
  try {
    const { errorType, platform, appVersion, message, stackTrace, endpoint, userId, userEmail } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Error message is required' });
    }

    // Group similar errors by message & errorType
    let errorLog = await ErrorLog.findOne({
      message: message.trim(),
      errorType: errorType || 'api_failure',
      status: { $ne: 'resolved' }
    });

    if (errorLog) {
      errorLog.occurrenceCount += 1;
      errorLog.lastSeen = new Date();
      if (stackTrace) errorLog.stackTrace = stackTrace;
      await errorLog.save();
    } else {
      errorLog = new ErrorLog({
        errorId: `ERR-${Date.now().toString().slice(-6)}`,
        errorType: errorType || 'api_failure',
        platform: platform || 'android',
        appVersion: appVersion || '1.0.0',
        userId: userId || (req.user ? req.user.userId : null),
        userEmail: userEmail || (req.user ? req.user.email : null),
        endpoint,
        message: message.trim(),
        stackTrace,
        occurrenceCount: 1,
        status: 'new'
      });
      await errorLog.save();
    }

    res.status(201).json({ success: true, errorId: errorLog.errorId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
