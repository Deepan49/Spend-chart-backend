const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Account = require('../models/Account');
const Budget = require('../models/Budget');

// Helper to calculate date range based on filter
function getDateRange(filter) {
  const now = new Date();
  let startDate = new Date(0); // All time default
  let endDate = now;

  switch (filter) {
    case 'weekly':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'yearly':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all':
    default:
      startDate = new Date(0);
      break;
  }
  return { startDate, endDate };
}

exports.getSummary = async (req, res) => {
  try {
    const filter = req.query.filter || 'monthly';
    const { startDate, endDate } = getDateRange(filter);
    const userId = new mongoose.Types.ObjectId(req.user.userId);

    // 1. Calculate Combined Net Balance across all linked accounts
    const accounts = await Account.find({ userId });
    const netBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    // 2. Income and Expense Summaries within time filter (excluding transfers)
    const transactionStats = await Expense.aggregate([
      {
        $match: {
          userId,
          type: { $in: ['income', 'expense'] },
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" }
        }
      }
    ]);

    let incomeSummary = 0;
    let expenseSummary = 0;

    transactionStats.forEach(stat => {
      if (stat._id === 'income') incomeSummary = stat.total;
      if (stat._id === 'expense') expenseSummary = stat.total;
    });

    // 3. Budget Status Summary
    const budgets = await Budget.find({ userId });
    const budgetStatusList = await Promise.all(budgets.map(async (budget) => {
      const totalSpent = await Expense.aggregate([
        {
          $match: {
            userId,
            type: 'expense',
            category: budget.category === 'All' ? { $exists: true } : { $regex: new RegExp(`^${budget.category}$`, 'i') },
            date: { $gte: budget.startDate, $lte: budget.endDate }
          }
        },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      const spent = totalSpent.length > 0 ? totalSpent[0].total : 0;
      return {
        category: budget.category,
        limit: budget.limit,
        spent,
        percentUsed: budget.limit > 0 ? (spent / budget.limit) * 100 : 0
      };
    }));

    // 4. Recent Transactions (last 5)
    const recentTransactions = await Expense.find({ userId })
      .sort({ date: -1 })
      .limit(5)
      .populate('accountId', 'name type');

    // 5. Category Breakdown (for Spending Chart - Expenses only)
    const categoryBreakdown = await Expense.aggregate([
      {
        $match: {
          userId,
          type: 'expense',
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: "$category",
          amount: { $sum: "$amount" }
        }
      },
      { $project: { category: "$_id", amount: 1, _id: 0 } },
      { $sort: { amount: -1 } }
    ]);

    // 6. Trend Data (for Chart history - Income vs Expense only)
    let groupingFormat = "%Y-%m-%d"; // Daily grouping by default
    if (filter === 'yearly') {
      groupingFormat = "%Y-%m"; // Monthly grouping for year filter
    }

    const trendData = await Expense.aggregate([
      {
        $match: {
          userId,
          type: { $in: ['income', 'expense'] },
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: groupingFormat, date: "$date" } },
            type: "$type"
          },
          total: { $sum: "$amount" }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          income: {
            $sum: { $cond: [{ $eq: ["$_id.type", "income"] }, "$total", 0] }
          },
          expense: {
            $sum: { $cond: [{ $eq: ["$_id.type", "expense"] }, "$total", 0] }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $project: { label: "$_id", income: 1, expense: 1, _id: 0 } }
    ]);

    res.json({
      netBalance,
      incomeSummary,
      expenseSummary,
      savings: incomeSummary - expenseSummary,
      budgetStatus: budgetStatusList,
      recentTransactions,
      spendingChart: {
        categories: categoryBreakdown,
        trend: trendData
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAIInsights = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get current month transactions
    const expenses = await Expense.find({
      userId,
      date: { $gte: startOfMonth }
    });

    const totalIncome = expenses
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalExpense = expenses
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + e.amount, 0);

    const insights = [];

    // Rule 1: High Spending Ratio
    if (totalIncome > 0) {
      const burnRate = (totalExpense / totalIncome) * 100;
      if (burnRate > 80) {
        insights.push({
          title: "High Burn Rate Warning",
          description: `You've spent ${burnRate.toFixed(1)}% of your income this month. Consider slowing down discretionary purchases.`,
          level: "warning"
        });
      } else if (burnRate < 50) {
        insights.push({
          title: "Healthy Savings Rate",
          description: `Excellent! You have saved more than 50% of your income so far this month.`,
          level: "success"
        });
      }
    }

    // Rule 2: Top Expense Category
    const categoryTotals = {};
    expenses.filter(e => e.type === 'expense').forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    let topCategory = null;
    let maxCategorySpend = 0;
    Object.entries(categoryTotals).forEach(([category, spend]) => {
      if (spend > maxCategorySpend) {
        maxCategorySpend = spend;
        topCategory = category;
      }
    });

    if (topCategory && maxCategorySpend > 0) {
      insights.push({
        title: `Top Spending Category: ${topCategory}`,
        description: `You have spent $${maxCategorySpend.toFixed(2)} on ${topCategory} this month.`,
        level: "info"
      });
    }

    // Rule 3: Budget warnings
    const budgets = await Budget.find({ userId });
    for (const budget of budgets) {
      const matchQuery = {
        userId,
        type: 'expense',
        date: { $gte: budget.startDate, $lte: budget.endDate }
      };
      if (budget.category !== 'All') {
        matchQuery.category = { $regex: new RegExp(`^${budget.category}$`, 'i') };
      }
      const categorySpentAgg = await Expense.aggregate([
        { $match: matchQuery },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      const spent = categorySpentAgg.length > 0 ? categorySpentAgg[0].total : 0;
      const pct = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;

      if (pct >= 100) {
        insights.push({
          title: `Budget Exceeded: ${budget.category}`,
          description: `You have exceeded your $${budget.limit} limit for ${budget.category} (spent $${spent.toFixed(2)}).`,
          level: "warning"
        });
      } else if (pct >= 85) {
        insights.push({
          title: `Budget Warning: ${budget.category}`,
          description: `You are approaching your limit for ${budget.category}. You've used ${pct.toFixed(0)}% of your $${budget.limit} budget.`,
          level: "warning"
        });
      }
    }

    // Fallback insight if no data
    if (insights.length === 0) {
      insights.push({
        title: "No Data Yet",
        description: "Add more transactions and set budgets to receive personalized AI financial insights.",
        level: "info"
      });
    }

    res.json({ success: true, insights });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
