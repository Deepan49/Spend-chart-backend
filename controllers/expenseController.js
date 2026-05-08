const mongoose = require('mongoose');
const Expense = require('../models/Expense');

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
    const { startDate, endDate } = req.query;
    let query = { userId: req.user.userId };
    
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
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
    res.status(201).json({ success: true, count: result.length, expenses: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
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
    const result = await Expense.deleteMany({
      _id: { $in: ids },
      userId: req.user.userId
    });
    res.json({ success: true, count: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
