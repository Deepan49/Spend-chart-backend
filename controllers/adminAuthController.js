const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');
const AdminAuditLog = require('../models/AdminAuditLog');
const { logAdminAction } = require('../utils/adminAuditLogger');

// Auto-seed initial super admin if no admin accounts exist
async function ensureSuperAdmin() {
  try {
    const count = await AdminUser.countDocuments();
    if (count === 0) {
      const defaultAdmin = new AdminUser({
        name: 'Super Admin',
        email: process.env.INITIAL_ADMIN_EMAIL || 'admin@spendchart.com',
        password: process.env.INITIAL_ADMIN_PASSWORD || 'Admin@12345',
        role: 'super_admin',
        isActive: true
      });
      await defaultAdmin.save();
      console.log('✅ Initial Super Admin created:', defaultAdmin.email);
    }
  } catch (err) {
    console.error('Error ensuring super admin:', err);
  }
}

// Call on startup
ensureSuperAdmin();

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const admin = await AdminUser.findOne({ email: email.toLowerCase().trim() });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'Admin account has been deactivated' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      { adminId: admin._id, email: admin.email, role: admin.role, isAdmin: true },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '24h' }
    );

    await logAdminAction({
      req: { ...req, admin: { adminId: admin._id, email: admin.email } },
      action: 'admin_login',
      targetType: 'admin',
      targetId: admin._id,
      details: { email: admin.email, role: admin.role }
    });

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        lastLogin: admin.lastLogin
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const admin = await AdminUser.findById(req.admin.adminId).select('-password');
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    res.json({ success: true, admin });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password required' });
    }

    const existing = await AdminUser.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Admin with this email already exists' });
    }

    const newAdmin = new AdminUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role || 'support',
      isActive: true,
      createdBy: req.admin.adminId
    });

    await newAdmin.save();

    await logAdminAction({
      req,
      action: 'admin_created',
      targetType: 'admin',
      targetId: newAdmin._id,
      details: { email: newAdmin.email, role: newAdmin.role }
    });

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.listAdmins = async (req, res) => {
  try {
    const admins = await AdminUser.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateAdminStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, role } = req.body;

    const admin = await AdminUser.findById(id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Prevent self-deactivation
    if (admin._id.toString() === req.admin.adminId.toString() && isActive === false) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
    }

    if (isActive !== undefined) admin.isActive = isActive;
    if (role !== undefined) admin.role = role;

    await admin.save();

    await logAdminAction({
      req,
      action: 'admin_status_updated',
      targetType: 'admin',
      targetId: admin._id,
      details: { isActive, role }
    });

    res.json({ success: true, message: 'Admin status updated', admin });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.targetType) filter.targetType = req.query.targetType;
    if (req.query.adminEmail) filter.adminEmail = { $regex: req.query.adminEmail, $options: 'i' };

    const total = await AdminAuditLog.countDocuments(filter);
    const logs = await AdminAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      logs
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
