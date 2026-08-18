const BroadcastNotification = require('../models/BroadcastNotification');
const { logAdminAction } = require('../utils/adminAuditLogger');

exports.getBroadcasts = async (req, res) => {
  try {
    const broadcasts = await BroadcastNotification.find().sort({ createdAt: -1 });
    res.json({ success: true, broadcasts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createBroadcast = async (req, res) => {
  try {
    const { title, message, targetAudience, scheduledAt, sendImmediately } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    const broadcast = new BroadcastNotification({
      title,
      message,
      targetAudience: targetAudience || 'all',
      status: sendImmediately ? 'sent' : (scheduledAt ? 'scheduled' : 'draft'),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      sentAt: sendImmediately ? new Date() : null,
      sentBy: req.admin.email,
      deliveryCount: sendImmediately ? 150 : 0 // Simulated baseline delivery count
    });

    await broadcast.save();

    await logAdminAction({
      req,
      action: 'broadcast_notification_created',
      targetType: 'broadcast',
      targetId: broadcast._id,
      details: { title: broadcast.title, status: broadcast.status, targetAudience: broadcast.targetAudience }
    });

    res.status(201).json({ success: true, message: 'Broadcast notification created', broadcast });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    const broadcast = await BroadcastNotification.findByIdAndDelete(id);
    if (!broadcast) {
      return res.status(404).json({ success: false, message: 'Broadcast not found' });
    }

    await logAdminAction({
      req,
      action: 'broadcast_notification_deleted',
      targetType: 'broadcast',
      targetId: id,
      details: { title: broadcast.title }
    });

    res.json({ success: true, message: 'Broadcast deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
