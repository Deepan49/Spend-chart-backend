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
    const account = await Account.findOne({ _id: req.params.id, userId: req.user.userId });
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
    const account = await Account.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    // Unlink expenses associated with this account
    await Expense.updateMany(
      { accountId: req.params.id, userId: req.user.userId },
      { $unset: { accountId: "" } }
    );

    res.json({ success: true, message: 'Account deleted and associated transactions unlinked' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
