const Expense = require('../models/Expense');
const User = require('../models/User');

exports.getTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { title: regex },
        { category: regex },
        { account: regex },
        { notes: regex }
      ];
    }

    if (req.query.source) filter.source = req.query.source;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.category) filter.category = { $regex: new RegExp(`^${req.query.category}$`, 'i') };
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.flaggedForReview !== undefined) filter.flaggedForReview = req.query.flaggedForReview === 'true';

    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
    }

    const total = await Expense.countDocuments(filter);
    const transactions = await Expense.find(filter)
      .populate('userId', 'name email')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      transactions
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTransactionDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Expense.findById(id)
      .populate('userId', 'name email phone')
      .populate('accountId', 'name type balance')
      .lean();

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.json({ success: true, transaction });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
