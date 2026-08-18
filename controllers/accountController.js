const mongoose = require('mongoose');
const Account = require('../models/Account');
const Expense = require('../models/Expense');

exports.getAccounts = async (req, res) => {
  try {
    const accounts = await Account.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createAccount = async (req, res) => {
  try {
    const { name, type, balance, currency, startingBalance, creditLimit, dueDate } = req.body;
    const account = new Account({
      userId: req.user.userId,
      name,
      type,
      balance: balance || 0,
      currency: currency || 'USD',
      startingBalance: startingBalance || 0,
      creditLimit,
      dueDate
    });
    await account.save();
    res.status(201).json({ success: true, account });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateAccount = async (req, res) => {
  try {
    const { name, type, balance, currency, startingBalance, creditLimit, dueDate } = req.body;
    let account = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      account = await Account.findOne({ _id: req.params.id, userId: req.user.userId });
    }
    if (!account) {
      account = await Account.findOne({
        userId: req.user.userId,
        name: { $regex: new RegExp(`^${req.params.id}$`, 'i') }
      });
    }

    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    if (name !== undefined) account.name = name;
    if (type !== undefined) account.type = type;
    if (balance !== undefined) account.balance = balance;
    if (currency !== undefined) account.currency = currency;
    if (startingBalance !== undefined) account.startingBalance = startingBalance;
    if (creditLimit !== undefined) account.creditLimit = creditLimit;
    if (dueDate !== undefined) account.dueDate = dueDate;

    await account.save();
    res.json({ success: true, account });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    let account = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      account = await Account.findOne({ _id: req.params.id, userId: req.user.userId });
    }
    if (!account) {
      account = await Account.findOne({
        userId: req.user.userId,
        name: { $regex: new RegExp(`^${req.params.id}$`, 'i') }
      });
    }

    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Check if there are active transactions with this account name or accountId
    const txCount = await Expense.countDocuments({
      userId: req.user.userId,
      $or: [
        { accountId: account._id },
        { account: { $regex: new RegExp(`^${account.name}$`, 'i') } },
        { fromAccount: { $regex: new RegExp(`^${account.name}$`, 'i') } },
        { toAccount: { $regex: new RegExp(`^${account.name}$`, 'i') } }
      ]
    });

    if (txCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete account "${account.name}". It contains ${txCount} transaction(s). Please delete or reassign its transactions first.`
      });
    }

    await Account.deleteOne({ _id: account._id, userId: req.user.userId });

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
