const mongoose = require('mongoose');
const Budget = require('../models/Budget');
const Expense = require('../models/Expense');

exports.getBudgets = async (req, res) => {
  try {
    const budgets = await Budget.find({ userId: req.user.userId }).sort({ startDate: -1 });
    
    // Enrich budgets with actual spending data
    const enrichedBudgets = await Promise.all(budgets.map(async (budget) => {
      const matchQuery = {
        userId: new mongoose.Types.ObjectId(req.user.userId),
        type: 'expense',
        date: { $gte: budget.startDate, $lte: budget.endDate }
      };

      if (budget.category !== 'All') {
        // Case-insensitive match on category
        matchQuery.category = { $regex: new RegExp(`^${budget.category}$`, 'i') };
      }

      const totalSpent = await Expense.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      const spent = totalSpent.length > 0 ? totalSpent[0].total : 0;
      return {
        _id: budget._id,
        category: budget.category,
        limit: budget.limit,
        period: budget.period,
        startDate: budget.startDate,
        endDate: budget.endDate,
        spent,
        remaining: Math.max(0, budget.limit - spent),
        percentUsed: budget.limit > 0 ? (spent / budget.limit) * 100 : 0
      };
    }));

    res.json(enrichedBudgets);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createBudget = async (req, res) => {
  try {
    const { category, limit, period, startDate, endDate } = req.body;
    
    const budget = new Budget({
      userId: req.user.userId,
      category: category || 'All',
      limit,
      period: period || 'monthly',
      startDate: startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: endDate ? new Date(endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59)
    });

    await budget.save();
    res.status(201).json({ success: true, budget });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateBudget = async (req, res) => {
  try {
    const { category, limit, period, startDate, endDate } = req.body;
    const budget = await Budget.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!budget) {
      return res.status(404).json({ success: false, message: 'Budget not found' });
    }

    if (category !== undefined) budget.category = category;
    if (limit !== undefined) budget.limit = limit;
    if (period !== undefined) budget.period = period;
    if (startDate !== undefined) budget.startDate = new Date(startDate);
    if (endDate !== undefined) budget.endDate = new Date(endDate);

    await budget.save();
    res.json({ success: true, budget });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteBudget = async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!budget) {
      return res.status(404).json({ success: false, message: 'Budget not found' });
    }
    res.json({ success: true, message: 'Budget deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
