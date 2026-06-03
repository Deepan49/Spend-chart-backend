require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Account = require('../models/Account');
const Budget = require('../models/Budget');
const Expense = require('../models/Expense');

const accountController = require('../controllers/accountController');
const budgetController = require('../controllers/budgetController');
const expenseController = require('../controllers/expenseController');
const analyticsController = require('../controllers/analyticsController');
const subscriptionController = require('../controllers/subscriptionController');
const Subscription = require('../models/Subscription');

// Mock req and res objects
const createMockReq = (userId, body = {}, query = {}, params = {}) => ({
  user: { userId },
  body,
  query,
  params
});

const createMockRes = () => {
  const res = {
    statusCode: 200,
    jsonData: null
  };
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.jsonData = data;
    return this;
  };
  return res;
};

async function runTests() {
  console.log('Connecting to database...');
  const localUri = 'mongodb://127.0.0.1:27017/finance_tracker_test';
  await mongoose.connect(localUri);
  console.log('Connected to local database.');

  let testUser;
  let testAccount;
  let testBudget;
  let createdExpenseId;

  try {
    // 1. Setup Test User
    console.log('\n--- 1. Setting up test user ---');
    testUser = await User.findOne({ email: 'test_verify@spendwise.com' });
    if (!testUser) {
      testUser = new User({
        name: 'Test Verifier',
        email: 'test_verify@spendwise.com',
        isVerified: true
      });
      await testUser.save();
    }
    const userId = testUser._id.toString();
    console.log(`Test user initialized: ${userId}`);

    // Clean up any old test data for this user
    await Account.deleteMany({ userId });
    await Budget.deleteMany({ userId });
    await Expense.deleteMany({ userId });

    // 2. Test Account Creation
    console.log('\n--- 2. Testing Account Creation ---');
    const accReq = createMockReq(userId, {
      name: 'Chase Checking',
      type: 'bank',
      balance: 1000,
      currency: 'USD'
    });
    const accRes = createMockRes();
    await accountController.createAccount(accReq, accRes);
    
    if (accRes.statusCode === 201 && accRes.jsonData.success) {
      testAccount = accRes.jsonData.account;
      console.log(`Success: Created account "${testAccount.name}" with balance $${testAccount.balance}`);
    } else {
      throw new Error(`Failed to create account: ${JSON.stringify(accRes.jsonData)}`);
    }

    // 2.5. Test Account Update with credit card properties
    console.log('\n--- 2.5. Testing Account Update and Credit Card Fields ---');
    const updateAccReq = createMockReq(userId, {
      name: 'Chase Checking Updated',
      type: 'credit_card',
      balance: 1000,
      startingBalance: 100,
      creditLimit: 5000,
      dueDate: 15
    }, {}, { id: testAccount._id.toString() });
    const updateAccRes = createMockRes();
    await accountController.updateAccount(updateAccReq, updateAccRes);

    if (updateAccRes.statusCode === 200 && updateAccRes.jsonData.success) {
      const updatedAcc = updateAccRes.jsonData.account;
      console.log(`Success: Updated account type to "${updatedAcc.type}", creditLimit: ${updatedAcc.creditLimit}, dueDate: ${updatedAcc.dueDate}`);
      if (updatedAcc.dueDate !== 15 || updatedAcc.type !== 'credit_card') {
        throw new Error('Failed to update account fields!');
      }
    } else {
      throw new Error(`Failed to update account: ${JSON.stringify(updateAccRes.jsonData)}`);
    }

    // 3. Test Budget Creation
    console.log('\n--- 3. Testing Budget Creation ---');
    const start = new Date();
    start.setDate(1); // start of this month
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0); // end of this month
    
    const budgetReq = createMockReq(userId, {
      category: 'Food',
      limit: 200,
      period: 'monthly',
      startDate: start.toISOString(),
      endDate: end.toISOString()
    });
    const budgetRes = createMockRes();
    await budgetController.createBudget(budgetReq, budgetRes);

    if (budgetRes.statusCode === 201 && budgetRes.jsonData.success) {
      testBudget = budgetRes.jsonData.budget;
      console.log(`Success: Created "${testBudget.category}" budget with limit $${testBudget.limit}`);
    } else {
      throw new Error(`Failed to create budget: ${JSON.stringify(budgetRes.jsonData)}`);
    }

    // 4. Test Adding an Expense (updates Account Balance & Budget Status)
    console.log('\n--- 4. Testing Expense Addition ---');
    const expReq = createMockReq(userId, {
      title: 'Grocery Shopping',
      amount: 50,
      category: 'Food',
      type: 'expense',
      accountId: testAccount._id.toString(),
      date: new Date().toISOString()
    });
    const expRes = createMockRes();
    await expenseController.addExpense(expReq, expRes);

    if (expRes.statusCode === 201 && expRes.jsonData.success) {
      const expense = expRes.jsonData.expense;
      createdExpenseId = expense._id;
      console.log(`Success: Added expense "${expense.title}" of $${expense.amount}`);

      // Verify Account Balance updated
      const updatedAcc = await Account.findById(testAccount._id);
      console.log(`Verified: Account balance is now $${updatedAcc.balance} (expected $950)`);
      if (updatedAcc.balance !== 950) {
        throw new Error('Balance mismatch!');
      }
    } else {
      throw new Error(`Failed to add expense: ${JSON.stringify(expRes.jsonData)}`);
    }

    // 5. Test Budget status fetch
    console.log('\n--- 5. Testing Budget Status and Real-time Spent Calculation ---');
    const bStatusReq = createMockReq(userId);
    const bStatusRes = createMockRes();
    await budgetController.getBudgets(bStatusReq, bStatusRes);

    if (bStatusRes.statusCode === 200) {
      const activeBudgets = bStatusRes.jsonData;
      console.log(`Active budgets returned: ${activeBudgets.length}`);
      const foodBudget = activeBudgets.find(b => b.category === 'Food');
      if (foodBudget) {
        console.log(`Verified: Food Budget has spent $${foodBudget.spent} / $${foodBudget.limit} (${foodBudget.percentUsed}% used)`);
        if (foodBudget.spent !== 50 || foodBudget.percentUsed !== 25) {
          throw new Error('Budget aggregation incorrect!');
        }
      } else {
        throw new Error('Food budget not found in list!');
      }
    } else {
      throw new Error(`Failed to get budgets: ${JSON.stringify(bStatusRes.jsonData)}`);
    }

    // 6. Test Statement Import
    console.log('\n--- 6. Testing Statement Import ---');
    const importReq = createMockReq(userId, {
      accountId: testAccount._id.toString(),
      expenses: [
        { title: 'Salary Credited', amount: 500, category: 'Work', type: 'income', date: new Date().toISOString() },
        { title: 'Coffee', amount: 10, category: 'Food', type: 'expense', date: new Date().toISOString() }
      ]
    });
    const importRes = createMockRes();
    await expenseController.importStatement(importReq, importRes);

    if (importRes.statusCode === 201 && importRes.jsonData.success) {
      console.log(`Success: Imported ${importRes.jsonData.count} transactions.`);
      console.log(`Verified: Account balance after import is $${importRes.jsonData.balance} (expected $1440)`);
      if (importRes.jsonData.balance !== 1440) {
        throw new Error('Balance mismatch after import!');
      }
    } else {
      throw new Error(`Failed to import statement: ${JSON.stringify(importRes.jsonData)}`);
    }

    // 7. Test Analytics and AI Insights
    console.log('\n--- 7. Testing Analytics Summary & AI Insights ---');
    const analyticReq = createMockReq(userId, {}, { filter: 'monthly' });
    const analyticRes = createMockRes();
    await analyticsController.getSummary(analyticReq, analyticRes);

    if (analyticRes.statusCode === 200) {
      const data = analyticRes.jsonData;
      console.log(`Verified Combined Net Balance: $${data.netBalance}`);
      console.log(`Verified Income Summary: $${data.incomeSummary}`);
      console.log(`Verified Expense Summary: $${data.expenseSummary}`);
      console.log(`Verified Spending Chart trend data counts: ${data.spendingChart.trend.length}`);
    } else {
      throw new Error(`Failed to get analytics summary: ${JSON.stringify(analyticRes.jsonData)}`);
    }

    const insightReq = createMockReq(userId);
    const insightRes = createMockRes();
    await analyticsController.getAIInsights(insightReq, insightRes);

    if (insightRes.statusCode === 200) {
      console.log('AI Insights Generated:');
      insightRes.jsonData.insights.forEach(ins => {
        console.log(`- [${ins.level.toUpperCase()}] ${ins.title}: ${ins.description}`);
      });
    } else {
      throw new Error(`Failed to get AI insights: ${JSON.stringify(insightRes.jsonData)}`);
    }

    // 8. Test Search/Filter Expenses
    console.log('\n--- 8. Testing Expense Search and Filtering ---');
    const searchReq = createMockReq(userId, {}, { search: 'grocery' });
    const searchRes = createMockRes();
    await expenseController.getExpenses(searchReq, searchRes);

    if (searchRes.statusCode === 200) {
      console.log(`Success: Found ${searchRes.jsonData.length} transactions matching search term "grocery"`);
      if (searchRes.jsonData.length !== 1 || searchRes.jsonData[0].title !== 'Grocery Shopping') {
        throw new Error('Search filtering logic failed!');
      }
    } else {
      throw new Error(`Failed search: ${JSON.stringify(searchRes.jsonData)}`);
    }

    // 8.5. Test Subscription Cloud Sync & Auto Payments
    console.log('\n--- 8.5. Testing Subscription Cloud Sync & Auto Payments ---');
    const subCreateReq = createMockReq(userId, {
      title: 'Netflix Premium',
      amount: 649,
      frequency: 'Monthly',
      category: 'Entertainment',
      nextDueDate: new Date().toISOString()
    });
    const subCreateRes = createMockRes();
    await subscriptionController.createSubscription(subCreateReq, subCreateRes);

    let createdSub;
    if (subCreateRes.statusCode === 201 && subCreateRes.jsonData.success) {
      createdSub = subCreateRes.jsonData.subscription;
      console.log(`Success: Created subscription "${createdSub.title}" of $${createdSub.amount}`);
    } else {
      throw new Error(`Failed to create subscription: ${JSON.stringify(subCreateRes.jsonData)}`);
    }

    // Pay subscription
    console.log('Paying subscription...');
    const paySubReq = createMockReq(userId, { accountId: testAccount._id.toString() }, {}, { id: createdSub._id.toString() });
    const paySubRes = createMockRes();
    await subscriptionController.paySubscription(paySubReq, paySubRes);

    if (paySubRes.statusCode === 200 && paySubRes.jsonData.success) {
      const updatedSub = paySubRes.jsonData.subscription;
      const createdExpense = paySubRes.jsonData.expense;
      console.log(`Success: Paid subscription. Next due date advanced to: ${updatedSub.nextDueDate}`);
      console.log(`Success: Created expense record for payment with title "${createdExpense.title}"`);
      
      // Verify account balance decreased by 649 (1440 - 649 = 791)
      const afterPayAcc = await Account.findById(testAccount._id);
      console.log(`Verified: Account balance after subscription payment is $${afterPayAcc.balance} (expected $791)`);
      if (afterPayAcc.balance !== 791) {
        throw new Error('Balance mismatch after subscription payment!');
      }
    } else {
      throw new Error(`Failed to pay subscription: ${JSON.stringify(paySubRes.jsonData)}`);
    }

    // Delete subscription
    console.log('Deleting subscription...');
    const delSubReq = createMockReq(userId, {}, {}, { id: createdSub._id.toString() });
    const delSubRes = createMockRes();
    await subscriptionController.deleteSubscription(delSubReq, delSubRes);
    if (delSubRes.statusCode === 200 && delSubRes.jsonData.success) {
      console.log('Success: Subscription deleted from cloud.');
    } else {
      throw new Error(`Failed to delete subscription: ${JSON.stringify(delSubRes.jsonData)}`);
    }

    // 8.6. Testing Portfolio/Holdings CRUD
    console.log('\n--- 8.6. Testing Portfolio Holdings CRUD ---');
    const portfolioController = require('../controllers/portfolioController');
    
    // Add holding
    const addHoldReq = createMockReq(userId, {
      symbol: 'AAPL',
      shares: 10,
      avgPrice: 150
    });
    const addHoldRes = createMockRes();
    await portfolioController.addHolding(addHoldReq, addHoldRes);
    
    let createdHolding;
    if (addHoldRes.statusCode === 201) {
      createdHolding = addHoldRes.jsonData;
      console.log(`Success: Added holding symbol "${createdHolding.symbol}" shares: ${createdHolding.shares}`);
    } else {
      throw new Error(`Failed to add holding: ${JSON.stringify(addHoldRes.jsonData)}`);
    }

    // Update holding
    const updateHoldReq = createMockReq(userId, {
      shares: 15,
      avgPrice: 160
    }, {}, { id: createdHolding._id.toString() });
    const updateHoldRes = createMockRes();
    await portfolioController.updateHolding(updateHoldReq, updateHoldRes);

    if (updateHoldRes.statusCode === 200 && updateHoldRes.jsonData.success) {
      const updatedHolding = updateHoldRes.jsonData.holding;
      console.log(`Success: Updated holding shares to ${updatedHolding.shares}, avgPrice: ${updatedHolding.avgPrice}`);
      if (updatedHolding.shares !== 15 || updatedHolding.avgPrice !== 160) {
        throw new Error('Holding fields mismatch after update!');
      }
    } else {
      throw new Error(`Failed to update holding: ${JSON.stringify(updateHoldRes.jsonData)}`);
    }

    // Delete holding
    const delHoldReq = createMockReq(userId, {}, {}, { id: createdHolding._id.toString() });
    const delHoldRes = createMockRes();
    await portfolioController.deleteHolding(delHoldReq, delHoldRes);

    if (delHoldRes.statusCode === 200 && delHoldRes.jsonData.success) {
      console.log('Success: Deleted holding.');
    } else {
      throw new Error(`Failed to delete holding: ${JSON.stringify(delHoldRes.jsonData)}`);
    }

    // 8.7. Test Expense Update (verify account balance changes)
    console.log('\n--- 8.7. Testing Expense Update and Balance Recalculation ---');
    const tempExpReq = createMockReq(userId, {
      title: 'Coffee Beans',
      amount: 100,
      category: 'Food',
      type: 'expense',
      accountId: testAccount._id.toString(),
      date: new Date().toISOString()
    });
    const tempExpRes = createMockRes();
    await expenseController.addExpense(tempExpReq, tempExpRes);
    
    let tempExp;
    if (tempExpRes.statusCode === 201 && tempExpRes.jsonData.success) {
      tempExp = tempExpRes.jsonData.expense;
      console.log(`Success: Created temp expense "${tempExp.title}" of $${tempExp.amount}`);
      const acc1 = await Account.findById(testAccount._id);
      console.log(`Verified account balance decreased: $${acc1.balance} (expected $691)`);
      if (acc1.balance !== 691) {
        throw new Error('Balance mismatch after adding temp expense!');
      }
    } else {
      throw new Error('Failed to create temp expense');
    }

    // Update the expense to 40 instead of 100 (should increase balance by 60 -> 751)
    const updateExpReq = createMockReq(userId, {
      amount: 40,
    }, {}, { id: tempExp._id.toString() });
    const updateExpRes = createMockRes();
    await expenseController.updateExpense(updateExpReq, updateExpRes);

    if (updateExpRes.statusCode === 200 && updateExpRes.jsonData.success) {
      console.log(`Success: Updated expense amount to $40`);
      const acc2 = await Account.findById(testAccount._id);
      console.log(`Verified: Account balance updated to $${acc2.balance} (expected $751)`);
      if (acc2.balance !== 751) {
        throw new Error('Balance recalculation mismatch after expense update!');
      }
    } else {
      throw new Error(`Failed to update expense: ${JSON.stringify(updateExpRes.jsonData)}`);
    }

    // Delete temp expense to keep cleanup clean
    const delTempReq = createMockReq(userId, {}, {}, { id: tempExp._id.toString() });
    const delTempRes = createMockRes();
    await expenseController.deleteExpense(delTempReq, delTempRes);
    if (delTempRes.statusCode === 200) {
      console.log('Success: Deleted temp expense.');
      const acc3 = await Account.findById(testAccount._id);
      console.log(`Verified account balance restored: $${acc3.balance} (expected $791)`);
      if (acc3.balance !== 791) {
        throw new Error('Balance mismatch after deleting temp expense!');
      }
    }

    // 9. Test Expense Deletion (balances update check)
    console.log('\n--- 9. Testing Expense Deletion ---');
    const delReq = createMockReq(userId, {}, {}, { id: createdExpenseId.toString() });
    const delRes = createMockRes();
    await expenseController.deleteExpense(delReq, delRes);

    if (delRes.statusCode === 200) {
      console.log('Success: Deleted the initial $50 expense.');
      const finalAcc = await Account.findById(testAccount._id);
      console.log(`Verified: Final account balance updated back to $${finalAcc.balance} (expected $841)`);
      if (finalAcc.balance !== 841) {
        throw new Error('Balance update after delete failed!');
      }
    } else {
      throw new Error(`Failed to delete expense: ${JSON.stringify(delRes.jsonData)}`);
    }

    console.log('\n=======================================');
    console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('=======================================');

  } catch (error) {
    console.error('\nTEST FAILED:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    console.log('\nCleaning up test data...');
    if (testUser) {
      const userId = testUser._id;
      await Account.deleteMany({ userId });
      await Budget.deleteMany({ userId });
      await Expense.deleteMany({ userId });
      await Subscription.deleteMany({ userId });
      await User.deleteOne({ _id: userId });
      console.log('Cleanup completed.');
    }
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

runTests();
