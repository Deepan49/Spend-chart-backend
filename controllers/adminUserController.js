const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Account = require('../models/Account');
const Budget = require('../models/Budget');
const Holding = require('../models/Holding');
const MutualFund = require('../models/MutualFund');
const Gold = require('../models/Gold');
const Bond = require('../models/Bond');
const { logAdminAction } = require('../utils/adminAuditLogger');

exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { phone: regex }
      ];
    }
    if (req.query.isVerified !== undefined) {
      query.isVerified = req.query.isVerified === 'true';
    }

    const total = await User.countDocuments(query);
    const rawUsers = await User.find(query)
      .select('-password -otp -otpExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Enrich users with account counts and transaction counts in parallel
    const users = await Promise.all(rawUsers.map(async (u) => {
      const [accountCount, transactionCount, lastExpense] = await Promise.all([
        Account.countDocuments({ userId: u._id }),
        Expense.countDocuments({ userId: u._id }),
        Expense.findOne({ userId: u._id }).sort({ date: -1 }).select('date')
      ]);

      return {
        ...u,
        userId: u._id,
        accountCount,
        totalTransactions: transactionCount,
        lastActiveDate: lastExpense ? lastExpense.date : u.updatedAt,
        status: u.isSuspended ? 'Suspended' : 'Active',
        platform: u.platform || 'Android'
      };
    }));

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      users
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password -otp -otpExpires').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [accounts, recentTransactions, budgets, totalTransactions, totalSpentResult, totalIncomeResult] = await Promise.all([
      Account.find({ userId: id }).lean(),
      Expense.find({ userId: id }).sort({ date: -1 }).limit(10).lean(),
      Budget.find({ userId: id }).lean(),
      Expense.countDocuments({ userId: id }),
      Expense.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(id), type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Expense.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(id), type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    const totalExpense = totalSpentResult[0]?.total || 0;
    const totalIncome = totalIncomeResult[0]?.total || 0;

    res.json({
      success: true,
      user: {
        ...user,
        userId: user._id,
        status: user.isSuspended ? 'Suspended' : 'Active',
        platform: user.platform || 'Android',
        stats: {
          totalAccounts: accounts.length,
          totalTransactions,
          totalIncome,
          totalExpense,
          netSavings: totalIncome - totalExpense
        },
        accounts,
        recentTransactions,
        budgets
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Active' or 'Suspended'

    const isSuspended = status === 'Suspended';
    const user = await User.findByIdAndUpdate(
      id,
      { isSuspended },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await logAdminAction({
      req,
      action: isSuspended ? 'user_suspended' : 'user_unsuspended',
      targetType: 'user',
      targetId: user._id,
      details: { email: user.email, name: user.name, status }
    });

    res.json({
      success: true,
      message: `User marked as ${status}`,
      user
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Cascade clean all user financial records
    await Promise.all([
      User.deleteOne({ _id: id }),
      Expense.deleteMany({ userId: id }),
      Account.deleteMany({ userId: id }),
      Budget.deleteMany({ userId: id }),
      Holding.deleteMany({ userId: id }),
      MutualFund.deleteMany({ userId: id }),
      Gold.deleteMany({ userId: id }),
      Bond.deleteMany({ userId: id })
    ]);

    await logAdminAction({
      req,
      action: 'user_deleted',
      targetType: 'user',
      targetId: id,
      details: { email: user.email, name: user.name }
    });

    res.json({ success: true, message: 'User and all associated data deleted permanently' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    await logAdminAction({
      req,
      action: 'user_password_reset_by_admin',
      targetType: 'user',
      targetId: id,
      details: { email: user.email }
    });

    res.json({ success: true, message: 'User password reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.generateImpersonateToken = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const impersonateToken = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        isImpersonated: true,
        impersonatedBy: req.admin.email 
      },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '2h' }
    );

    await logAdminAction({
      req,
      action: 'user_impersonation_token_generated',
      targetType: 'user',
      targetId: id,
      details: { email: user.email }
    });

    res.json({
      success: true,
      message: 'Impersonation view token generated (valid for 2 hours)',
      token: impersonateToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
