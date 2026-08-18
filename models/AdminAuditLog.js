const mongoose = require('mongoose');

const adminAuditLogSchema = new mongoose.Schema({
  adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  adminEmail: { type: String, required: true },
  action: { type: String, required: true }, // e.g., 'user_suspended', 'feature_flag_updated', 'ticket_resolved'
  targetType: { type: String, required: true }, // 'user', 'feature_flag', 'support_ticket', 'system', 'admin'
  targetId: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);
