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

    // Adjust associated account balances
    if (expense.type === 'transfer') {
      if (expense.fromAccountId) {
        await Account.findOneAndUpdate(
          { _id: expense.fromAccountId, userId: req.user.userId },
          { $inc: { balance: -expense.amount } }
        );
      }
      if (expense.toAccountId) {
        await Account.findOneAndUpdate(
          { _id: expense.toAccountId, userId: req.user.userId },
          { $inc: { balance: expense.amount } }
        );
      }
    } else if (expense.accountId) {
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
      if (exp.type === 'transfer') {
        if (exp.fromAccountId) {
          await Account.findOneAndUpdate(
            { _id: exp.fromAccountId, userId: req.user.userId },
            { $inc: { balance: -exp.amount } }
          );
        }
        if (exp.toAccountId) {
          await Account.findOneAndUpdate(
            { _id: exp.toAccountId, userId: req.user.userId },
            { $inc: { balance: exp.amount } }
          );
        }
      } else if (exp.accountId) {
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
    if (expense.type === 'transfer') {
      if (expense.fromAccountId) {
        await Account.findOneAndUpdate(
          { _id: expense.fromAccountId, userId: req.user.userId },
          { $inc: { balance: expense.amount } }
        );
      }
      if (expense.toAccountId) {
        await Account.findOneAndUpdate(
          { _id: expense.toAccountId, userId: req.user.userId },
          { $inc: { balance: -expense.amount } }
        );
      }
    } else if (expense.accountId) {
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
      if (exp.type === 'transfer') {
        if (exp.fromAccountId) {
          await Account.findOneAndUpdate(
            { _id: exp.fromAccountId, userId: req.user.userId },
            { $inc: { balance: exp.amount } }
          );
        }
        if (exp.toAccountId) {
          await Account.findOneAndUpdate(
            { _id: exp.toAccountId, userId: req.user.userId },
            { $inc: { balance: -exp.amount } }
          );
        }
      } else if (exp.accountId) {
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
      accountId: e.accountId || accountId,
      source: 'import'
    }));

    const result = await Expense.insertMany(transactionsToInsert);

    // Accumulate total change to account balance
    let balanceChange = 0;
    result.forEach(exp => {
      if (exp.type === 'income') {
        balanceChange += exp.amount;
      } else if (exp.type === 'expense') {
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
    const oldFromAccountId = expense.fromAccountId;
    const oldToAccountId = expense.toAccountId;
    const oldType = expense.type;

    // Apply updates
    Object.assign(expense, req.body);
    expense.userId = req.user.userId; // ensure userId cannot be changed
    await expense.save();

    // 1. Reverse old balance changes
    if (oldType === 'transfer') {
      if (oldFromAccountId) {
        await Account.findOneAndUpdate(
          { _id: oldFromAccountId, userId: req.user.userId },
          { $inc: { balance: oldAmount } }
        );
      }
      if (oldToAccountId) {
        await Account.findOneAndUpdate(
          { _id: oldToAccountId, userId: req.user.userId },
          { $inc: { balance: -oldAmount } }
        );
      }
    } else if (oldAccountId) {
      const reverseChange = oldType === 'income' ? -oldAmount : oldAmount;
      await Account.findOneAndUpdate(
        { _id: oldAccountId, userId: req.user.userId },
        { $inc: { balance: reverseChange } }
      );
    }

    // 2. Apply new balance changes
    if (expense.type === 'transfer') {
      if (expense.fromAccountId) {
        await Account.findOneAndUpdate(
          { _id: expense.fromAccountId, userId: req.user.userId },
          { $inc: { balance: -expense.amount } }
        );
      }
      if (expense.toAccountId) {
        await Account.findOneAndUpdate(
          { _id: expense.toAccountId, userId: req.user.userId },
          { $inc: { balance: expense.amount } }
        );
      }
    } else if (expense.accountId) {
      const newChange = expense.type === 'income' ? expense.amount : -expense.amount;
      await Account.findOneAndUpdate(
        { _id: expense.accountId, userId: req.user.userId },
        { $inc: { balance: newChange } }
      );
    }

    res.json({ success: true, expense });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Auto-detect transfer candidates across user transactions
exports.detectTransferCandidates = async (req, res) => {
  try {
    const userId = req.user.userId;
    // Fetch non-transfer transactions
    const expenses = await Expense.find({
      userId,
      type: { $in: ['income', 'expense'] }
    }).sort({ date: -1 });

    const candidates = [];
    const usedIds = new Set();
    const transferKeywords = ['transfer', 'neft', 'imps', 'rtgs', 'self', 'own account', 'trf', 'upi'];

    for (let i = 0; i < expenses.length; i++) {
      const tx1 = expenses[i];
      if (usedIds.has(tx1._id.toString())) continue;

      for (let j = i + 1; j < expenses.length; j++) {
        const tx2 = expenses[j];
        if (usedIds.has(tx2._id.toString())) continue;

        // Must be opposite directions (one income, one expense)
        if (tx1.type === tx2.type) continue;

        // Check date difference (within +/- 2 days = 172,800,000 ms)
        const dateDiff = Math.abs(new Date(tx1.date).getTime() - new Date(tx2.date).getTime());
        if (dateDiff > 2 * 24 * 60 * 60 * 1000) continue;

        // Check amount match (within +/- 1.00)
        const amtDiff = Math.abs(tx1.amount - tx2.amount);
        if (amtDiff > 1.0) continue;

        // Calculate confidence score
        let score = 50; // base score for amount + date match
        if (amtDiff === 0) score += 20;

        const text1 = (tx1.title + ' ' + (tx1.notes || '')).toLowerCase();
        const text2 = (tx2.title + ' ' + (tx2.notes || '')).toLowerCase();

        const hasKeyword = transferKeywords.some(kw => text1.includes(kw) || text2.includes(kw));
        if (hasKeyword) score += 30;

        const debitTx = tx1.type === 'expense' ? tx1 : tx2;
        const creditTx = tx1.type === 'income' ? tx1 : tx2;

        candidates.push({
          debitTx,
          creditTx,
          score,
          amount: debitTx.amount,
          date: debitTx.date
        });

        usedIds.add(tx1._id.toString());
        usedIds.add(tx2._id.toString());
        break;
      }
    }

    res.json({ success: true, count: candidates.length, candidates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Confirm transfer candidate pair and merge into single transfer
exports.confirmTransfer = async (req, res) => {
  try {
    const { debitTxId, creditTxId, fromAccountId, toAccountId } = req.body;
    const userId = req.user.userId;

    const debitTx = await Expense.findOne({ _id: debitTxId, userId });
    const creditTx = await Expense.findOne({ _id: creditTxId, userId });

    if (!debitTx || !creditTx) {
      return res.status(404).json({ success: false, message: 'One or both transactions not found' });
    }

    // Determine accounts
    const fAccId = fromAccountId || debitTx.accountId;
    const tAccId = toAccountId || creditTx.accountId;

    // Convert debitTx to a single transfer record
    debitTx.type = 'transfer';
    debitTx.category = 'Transfer';
    debitTx.fromAccountId = fAccId;
    debitTx.toAccountId = tAccId;
    debitTx.fromAccount = debitTx.account || debitTx.bankName;
    debitTx.toAccount = creditTx.account || creditTx.bankName;
    debitTx.notes = `Self-transfer merged from: ${debitTx.title} & ${creditTx.title}`;
    await debitTx.save();

    // Delete the redundant credit transaction
    await Expense.deleteOne({ _id: creditTxId, userId });

    res.json({ success: true, message: 'Merged into self-transfer successfully', transfer: debitTx });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

