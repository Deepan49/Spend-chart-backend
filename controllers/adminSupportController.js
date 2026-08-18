const SupportTicket = require('../models/SupportTicket');
const { logAdminAction } = require('../utils/adminAuditLogger');

exports.getTickets = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { subject: regex },
        { message: regex },
        { userEmail: regex },
        { userName: regex },
        { ticketId: regex }
      ];
    }

    const total = await SupportTicket.countDocuments(filter);
    const tickets = await SupportTicket.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      tickets
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTicketDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await SupportTicket.findById(id).populate('userId', 'name email phone');
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedTo, note } = req.body;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (assignedTo !== undefined) ticket.assignedTo = assignedTo;

    if (note && note.trim().length > 0) {
      ticket.internalNotes.push({
        adminEmail: req.admin.email,
        note: note.trim(),
        createdAt: new Date()
      });
    }

    await ticket.save();

    await logAdminAction({
      req,
      action: 'ticket_updated',
      targetType: 'support_ticket',
      targetId: ticket._id,
      details: { ticketId: ticket.ticketId, status: ticket.status, priority: ticket.priority }
    });

    res.json({ success: true, message: 'Ticket updated successfully', ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Client/User Submission Endpoint
exports.submitTicketFromUser = async (req, res) => {
  try {
    const { category, subject, message, attachments, platform, appVersion } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const ticketId = `TKT-${Date.now().toString().slice(-6)}`;
    const ticket = new SupportTicket({
      ticketId,
      userId: req.user ? req.user.userId : null,
      userEmail: req.user ? req.user.email : req.body.email,
      userName: req.user ? req.user.name : req.body.name,
      category: category || 'other',
      subject,
      message,
      attachments: attachments || [],
      platform: platform || 'android',
      appVersion: appVersion || '1.0.0',
      status: 'open'
    });

    await ticket.save();
    res.status(201).json({ success: true, message: 'Support ticket submitted successfully', ticketId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
