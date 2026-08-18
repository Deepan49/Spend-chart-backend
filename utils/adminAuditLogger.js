const AdminAuditLog = require('../models/AdminAuditLog');

/**
 * Log an administrative action into the audit trail
 */
async function logAdminAction({ req, action, targetType, targetId, details }) {
  try {
    const adminUserId = req.admin?.adminId;
    const adminEmail = req.admin?.email || 'system';
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await AdminAuditLog.create({
      adminUserId,
      adminEmail,
      action,
      targetType,
      targetId: targetId ? targetId.toString() : null,
      details,
      ipAddress,
      userAgent
    });
  } catch (err) {
    console.error('Failed to write AdminAuditLog:', err);
  }
}

module.exports = { logAdminAction };
