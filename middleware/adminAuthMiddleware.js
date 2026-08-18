const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Admin authentication required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');

    if (!decoded.isAdmin || !decoded.adminId) {
      return res.status(403).json({ success: false, message: 'Invalid admin token' });
    }

    const admin = await AdminUser.findById(decoded.adminId).select('-password');
    if (!admin || !admin.isActive) {
      return res.status(403).json({ success: false, message: 'Admin account is deactivated or deleted' });
    }

    req.admin = {
      adminId: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired admin session token' });
  }
};

const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, message: 'Admin authentication required' });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Forbidden: requires one of the following roles: [${allowedRoles.join(', ')}]` 
      });
    }

    next();
  };
};

module.exports = { adminAuth, requireRole };
