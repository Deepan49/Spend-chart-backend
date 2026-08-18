const mongoose = require('mongoose');
const Budget = require('../models/Budget');
const Expense = require('../models/Expense');

/**
 * Helper to compute date boundaries for standard financial periods
 */
function getDateRange(period, dateStr, startDateStr, endDateStr) {
  if (startDateStr && endDateStr) {
    return {
      startDate: new Date(startDateStr),
      endDate: new Date(endDateStr)
    };
  }

  const baseDate = dateStr ? new Date(dateStr) : new Date();
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();

  switch ((period || 'monthly').toLowerCase()) {
    case 'daily':
      return {
        startDate: new Date(year, month, day, 0, 0, 0),
        endDate: new Date(year, month, day, 23, 59, 59, 999)
      };
    case 'weekly': {
      const dayOfWeek = baseDate.getDay();
      const diffToMonday = baseDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(baseDate.setDate(diffToMonday));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        startDate: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0),
        endDate: new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999)
      };
    }
    case 'yearly':
      return {
        startDate: new Date(year, 0, 1, 0, 0, 0),
        endDate: new Date(year, 11, 31, 23, 59, 59, 999)
      };
    case 'monthly':
    default:
      return {
        startDate: new Date(year, month, 1, 0, 0, 0),
        endDate: new Date(year, month + 1, 0, 23, 59, 59, 999)
      };
  }
}

/**
 * 1. Dedicated Stats Summary API (/api/budgets/summary)
 */
exports.getBudgetSummary = async (req, res) => {
  try {
    const { period, date, startDate: qStart, endDate: qEnd } = req.query;
    const { startDate, endDate } = getDateRange(period, date, qStart, qEnd);
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    // Fetch user's deduplicated budgets
    const allBudgets = await Budget.find({ userId: req.user.userId });
    const seen = new Set();
    let totalBudget = 0;

    for (const b of allBudgets) {
      const key = b.category?.toLowerCase() || 'all';
      if (!seen.has(key)) {
        seen.add(key);
        totalBudget += (b.limit || 0);
      }
    }

    // Aggregate total expense in this date range
    const totalSpentResult = await Expense.aggregate([
      {
        $match: {
          userId,
          type: 'expense',
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const totalSpent = totalSpentResult.length > 0 ? totalSpentResult[0].total : 0;
    const remaining = Math.max(0, totalBudget - totalSpent);
    const percentage = totalBudget > 0 ? Math.min(1.0, totalSpent / totalBudget) : 0.0;

    res.json({
      success: true,
      totalBudget,
      totalSpent,
      remaining,
      percentage,
      period: period || 'Monthly',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
  } catch (err) {
    console.error('getBudgetSummary Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 2. Dedicated Category Budgets List API (/api/budgets/categories)
 */
exports.getCategoryBudgets = async (req, res) => {
  try {
    const { period, date, startDate: qStart, endDate: qEnd } = req.query;
    const { startDate, endDate } = getDateRange(period, date, qStart, qEnd);
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const allBudgets = await Budget.find({ userId: req.user.userId }).sort({ category: 1 });

    // Deduplicate by category
    const seen = new Set();
    const uniqueBudgets = [];
    const duplicateIds = [];

    for (const b of allBudgets) {
      const key = b.category?.toLowerCase() || 'all';
      if (!seen.has(key)) {
        seen.add(key);
        uniqueBudgets.push(b);
      } else {
        duplicateIds.push(b._id);
      }
    }

    // Auto-clean duplicates in background
    if (duplicateIds.length > 0) {
      Budget.deleteMany({ _id: { $in: duplicateIds } }).exec().catch(err => console.error(err));
    }

    // Aggregate category-wise expenses for the requested period in a single query
    const spendingByCategory = await Expense.aggregate([
      {
        $match: {
          userId,
          type: 'expense',
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $toLower: "$category" },
          totalSpent: { $sum: "$amount" }
        }
      }
    ]);

    const spendingMap = {};
    for (const item of spendingByCategory) {
      if (item._id) spendingMap[item._id] = item.totalSpent;
    }

    const categories = uniqueBudgets.map((b) => {
      const catKey = (b.category || '').toLowerCase();
      const spent = spendingMap[catKey] || 0;
      const limit = b.limit || 0;
      const remaining = Math.max(0, limit - spent);
      const percentUsed = limit > 0 ? Math.min(100.0, (spent / limit) * 100) : 0.0;

      return {
        _id: b._id,
        category: b.category,
        limit,
        spent,
        remaining,
        percentUsed,
        period: b.period || 'monthly',
        startDate: b.startDate,
        endDate: b.endDate
      };
    });

    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (err) {
    console.error('getCategoryBudgets Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 3. Dedicated Budget Periods / Filter Metadata API (/api/budgets/periods)
 */
exports.getBudgetPeriods = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    // Find min and max transaction dates to discover active years & months
    const dateRangeResult = await Expense.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          minDate: { $min: "$date" },
          maxDate: { $max: "$date" }
        }
      }
    ]);

    const availablePeriods = [
      { id: 'daily', name: 'Daily' },
      { id: 'weekly', name: 'Weekly' },
      { id: 'monthly', name: 'Monthly' },
      { id: 'yearly', name: 'Yearly' }
    ];

    const currentPeriod = 'Monthly';
    const now = new Date();

    res.json({
      success: true,
      availablePeriods,
      currentPeriod,
      minDate: dateRangeResult.length > 0 ? dateRangeResult[0].minDate : now,
      maxDate: dateRangeResult.length > 0 ? dateRangeResult[0].maxDate : now
    });
  } catch (err) {
    console.error('getBudgetPeriods Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 4. Dedicated Category Mutation API (/api/budgets/category)
 */
exports.createOrUpdateCategoryBudget = async (req, res) => {
  try {
    const { category, limit, period, startDate, endDate } = req.body;
    const catName = (category || 'Others').trim();
    const periodName = period || 'monthly';

    // Upsert by category to guarantee uniqueness
    let budget = await Budget.findOne({
      userId: req.user.userId,
      category: { $regex: new RegExp(`^${catName}$`, 'i') }
    });

    if (budget) {
      if (limit !== undefined) budget.limit = limit;
      if (period) budget.period = periodName;
      if (startDate) budget.startDate = new Date(startDate);
      if (endDate) budget.endDate = new Date(endDate);
      await budget.save();
      return res.status(200).json({ success: true, message: 'Category budget updated', budget });
    }

    budget = new Budget({
      userId: req.user.userId,
      category: catName,
      limit: limit || 0,
      period: periodName,
      startDate: startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: endDate ? new Date(endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59)
    });

    await budget.save();
    res.status(201).json({ success: true, message: 'Category budget created', budget });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Backward compatibility endpoints
 */
exports.getBudgets = exports.getCategoryBudgets;
exports.createBudget = exports.createOrUpdateCategoryBudget;

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
    let budget = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      budget = await Budget.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    }
    if (!budget) {
      budget = await Budget.findOneAndDelete({ 
        userId: req.user.userId,
        category: { $regex: new RegExp(`^${req.params.id}$`, 'i') }
      });
    }
    if (!budget) {
      return res.status(404).json({ success: false, message: 'Budget not found' });
    }
    res.json({ success: true, message: 'Budget deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
