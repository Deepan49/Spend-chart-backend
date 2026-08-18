const User = require('../models/User');
const Expense = require('../models/Expense');
const Account = require('../models/Account');
const ErrorLog = require('../models/ErrorLog');
const SupportTicket = require('../models/SupportTicket');

exports.getDashboardAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersToday,
      newUsers30d,
      totalTransactions,
      totalVolumeResult,
      activeTodayUsersResult,
      active30dUsersResult,
      sourceBreakdown,
      categoryBreakdown,
      openTicketsCount,
      unresolvedErrorsCount,
      dailyUserSignups
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Expense.countDocuments(),
      Expense.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Expense.distinct('userId', { date: { $gte: todayStart } }),
      Expense.distinct('userId', { date: { $gte: thirtyDaysAgo } }),
      Expense.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 }, volume: { $sum: '$amount' } } }
      ]),
      Expense.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 }, total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
        { $limit: 6 }
      ]),
      SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      ErrorLog.countDocuments({ status: { $in: ['new', 'investigating'] } }),
      User.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    const totalVolume = totalVolumeResult[0]?.total || 0;
    const dau = activeTodayUsersResult.length;
    const mau = active30dUsersResult.length;

    // Parse success rate calculation
    const totalSmsOrImports = await Expense.countDocuments({ source: { $in: ['sms', 'import'] } });
    const flaggedCount = await Expense.countDocuments({ flaggedForReview: true });
    const parseSuccessRate = totalSmsOrImports > 0 
      ? Math.max(0, (((totalSmsOrImports - flaggedCount) / totalSmsOrImports) * 100)).toFixed(1)
      : '100.0';

    res.json({
      success: true,
      metrics: {
        totalUsers,
        dau,
        mau,
        newUsersToday,
        newUsers30d,
        totalTransactions,
        totalVolume,
        parseSuccessRate: parseFloat(parseSuccessRate),
        openTicketsCount,
        unresolvedErrorsCount
      },
      charts: {
        sourceBreakdown: sourceBreakdown.map(s => ({ source: s._id || 'manual', count: s.count, volume: s.volume })),
        topCategories: categoryBreakdown.map(c => ({ category: c._id || 'Others', total: c.total, count: c.count })),
        userGrowth: dailyUserSignups.map(d => ({ date: d._id, signups: d.count }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
