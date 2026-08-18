const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userEmail: { type: String },
  userName: { type: String },
  category: { 
    type: String, 
    enum: ['bug_report', 'feature_request', 'parse_issue', 'account_issue', 'other'], 
    default: 'other' 
  },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  attachments: [{ type: String }],
  platform: { type: String, default: 'android' },
  appVersion: { type: String },
  status: { 
    type: String, 
    enum: ['open', 'in_progress', 'resolved', 'closed'], 
    default: 'open' 
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  assignedTo: { type: String },
  internalNotes: [{
    adminEmail: { type: String },
    note: { type: String },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
