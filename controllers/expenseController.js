const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Account = require('../models/Account');

exports.getSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let match = { userId: new mongoose.Types.ObjectId(req.user.userId) };

    if (startDate && endDate) {
      match.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const summary = await Expense.aggregate([
      { $match: match },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $project: { category: "$_id", total: 1, _id: 0 } }
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getExpenses = async (req, res) => {
  try {
    const { startDate, endDate, search, category, accountId, type, source, paymentMethod } = req.query;
    let query = { userId: req.user.userId };
    
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else if (startDate) {
      query.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.date = { $lte: new Date(endDate) };
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }

    if (accountId) {
      query.accountId = accountId;
    }

    if (type) {
      query.type = type;
    }

    if (source) {
      query.source = source;
    }

    if (paymentMethod) {
      query.paymentMethod = { $regex: new RegExp(`^${paymentMethod}$`, 'i') };
    }
    
    const expenses = await Expense.find(query).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addExpense = async (req, res) => {
  try {
    const expense = new Expense({
      ...req.body,
      userId: req.user.userId
    });
    await expense.save();

    // Adjust associated account balance
    if (expense.accountId) {
      const change = expense.type === 'income' ? expense.amount : -expense.amount;
      await Account.findOneAndUpdate(
        { _id: expense.accountId, userId: req.user.userId },
        { $inc: { balance: change } }
      );
    }

    res.status(201).json({ success: true, expense });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.batchAddExpenses = async (req, res) => {
  try {
    const { expenses } = req.body;
    if (!Array.isArray(expenses)) {
      return res.status(400).json({ success: false, message: 'Expenses must be an array' });
    }

    const expensesWithUser = expenses.map(e => ({
      ...e,
      userId: req.user.userId
    }));

    const result = await Expense.insertMany(expensesWithUser);

    // Update account balances
    for (const exp of result) {
      if (exp.accountId) {
        const change = exp.type === 'income' ? exp.amount : -exp.amount;
        await Account.findOneAndUpdate(
          { _id: exp.accountId, userId: req.user.userId },
          { $inc: { balance: change } }
        );
      }
    }

    res.status(201).json({ success: true, count: result.length, expenses: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Reverse associated account balance
    if (expense.accountId) {
      const change = expense.type === 'income' ? -expense.amount : expense.amount;
      await Account.findOneAndUpdate(
        { _id: expense.accountId, userId: req.user.userId },
        { $inc: { balance: change } }
      );
    }

    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.batchDeleteExpenses = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'IDs must be an array' });
    }

    const expensesToDelete = await Expense.find({
      _id: { $in: ids },
      userId: req.user.userId
    });

    const result = await Expense.deleteMany({
      _id: { $in: ids },
      userId: req.user.userId
    });

    // Reverse associated account balances
    for (const exp of expensesToDelete) {
      if (exp.accountId) {
        const change = exp.type === 'income' ? -exp.amount : exp.amount;
        await Account.findOneAndUpdate(
          { _id: exp.accountId, userId: req.user.userId },
          { $inc: { balance: change } }
        );
      }
    }

    res.json({ success: true, count: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.importStatement = async (req, res) => {
  try {
    const { accountId, expenses } = req.body;
    if (!accountId) {
      return res.status(400).json({ success: false, message: 'accountId is required' });
    }
    if (!Array.isArray(expenses)) {
      return res.status(400).json({ success: false, message: 'expenses array is required' });
    }

    const account = await Account.findOne({ _id: accountId, userId: req.user.userId });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const transactionsToInsert = expenses.map(e => ({
      ...e,
      userId: req.user.userId,
      accountId,
      source: 'import'
    }));

    const result = await Expense.insertMany(transactionsToInsert);

    // Accumulate total change to the account balance
    let balanceChange = 0;
    result.forEach(exp => {
      if (exp.type === 'income') {
        balanceChange += exp.amount;
      } else {
        balanceChange -= exp.amount;
      }
    });

    account.balance += balanceChange;
    await account.save();

    res.status(201).json({
      success: true,
      count: result.length,
      balance: account.balance,
      expenses: result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    const oldAmount = expense.amount;
    const oldAccountId = expense.accountId;
    const oldType = expense.type;

    // Apply updates
    Object.assign(expense, req.body);
    expense.userId = req.user.userId; // ensure userId cannot be changed
    await expense.save();

    // Recalculate account balances if amount, accountId, or type changed
    if (
      req.body.amount !== undefined ||
      req.body.accountId !== undefined ||
      req.body.type !== undefined
    ) {
      // 1. Reverse the old transaction balance change from the old account
      if (oldAccountId) {
        const reverseChange = oldType === 'income' ? -oldAmount : oldAmount;
        await Account.findOneAndUpdate(
          { _id: oldAccountId, userId: req.user.userId },
          { $inc: { balance: reverseChange } }
        );
      }

      // 2. Apply the new transaction balance change to the new account
      if (expense.accountId) {
        const newChange = expense.type === 'income' ? expense.amount : -expense.amount;
        await Account.findOneAndUpdate(
          { _id: expense.accountId, userId: req.user.userId },
          { $inc: { balance: newChange } }
        );
      }
    }

    res.json({ success: true, expense });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
