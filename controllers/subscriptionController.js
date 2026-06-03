const Subscription = require('../models/Subscription');
const Expense = require('../models/Expense');
const Account = require('../models/Account');

exports.getSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ userId: req.user.userId }).sort({ nextDueDate: 1 });
    res.json(subscriptions);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSubscription = async (req, res) => {
  try {
    const { title, amount, frequency, nextDueDate, category, isAutoDetected, isActive } = req.body;
    
    const subscription = new Subscription({
      userId: req.user.userId,
      title,
      amount,
      frequency,
      nextDueDate: nextDueDate ? new Date(nextDueDate) : new Date(),
      category: category || 'Others',
      isAutoDetected: isAutoDetected || false,
      isActive: isActive !== undefined ? isActive : true
    });

    await subscription.save();
    res.status(201).json({ success: true, subscription });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateSubscription = async (req, res) => {
  try {
    const { title, amount, frequency, nextDueDate, category, isAutoDetected, isActive } = req.body;
    const subscription = await Subscription.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    if (title !== undefined) subscription.title = title;
    if (amount !== undefined) subscription.amount = amount;
    if (frequency !== undefined) subscription.frequency = frequency;
    if (nextDueDate !== undefined) subscription.nextDueDate = new Date(nextDueDate);
    if (category !== undefined) subscription.category = category;
    if (isAutoDetected !== undefined) subscription.isAutoDetected = isAutoDetected;
    if (isActive !== undefined) subscription.isActive = isActive;

    await subscription.save();
    res.json({ success: true, subscription });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }
    res.json({ success: true, message: 'Subscription deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.paySubscription = async (req, res) => {
  try {
    const { accountId } = req.body;
    const subscription = await Subscription.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    // 1. Advance next due date
    let currentDue = new Date(subscription.nextDueDate);
    let nextDue = new Date(currentDue);

    switch (subscription.frequency) {
      case 'Weekly':
        nextDue.setDate(currentDue.getDate() + 7);
        break;
      case 'Bi-weekly':
        nextDue.setDate(currentDue.getDate() + 14);
        break;
      case 'Monthly':
        nextDue.setMonth(currentDue.getMonth() + 1);
        break;
      case 'Yearly':
        nextDue.setFullYear(currentDue.getFullYear() + 1);
        break;
      default:
        nextDue.setMonth(currentDue.getMonth() + 1);
        break;
    }

    subscription.nextDueDate = nextDue;
    await subscription.save();

    // 2. Create the associated Expense
    const expense = new Expense({
      userId: req.user.userId,
      title: subscription.title,
      amount: subscription.amount,
      category: subscription.category,
      type: 'expense',
      source: 'manual',
      isRecurring: true,
      recurringFrequency: subscription.frequency.toLowerCase(),
      accountId: accountId || undefined,
      date: new Date()
    });
    await expense.save();

    // 3. Update account balance if accountId is passed
    if (accountId) {
      await Account.findOneAndUpdate(
        { _id: accountId, userId: req.user.userId },
        { $inc: { balance: -subscription.amount } }
      );
    }

    res.json({
      success: true,
      message: 'Subscription paid, next due date updated and transaction recorded.',
      subscription,
      expense
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
