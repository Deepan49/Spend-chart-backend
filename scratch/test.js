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

    // 9. Test Expense Deletion (balances update check)
    console.log('\n--- 9. Testing Expense Deletion ---');
    const delReq = createMockReq(userId, {}, {}, { id: createdExpenseId.toString() });
    const delRes = createMockRes();
    await expenseController.deleteExpense(delReq, delRes);

    if (delRes.statusCode === 200) {
      console.log('Success: Deleted the initial $50 expense.');
      const finalAcc = await Account.findById(testAccount._id);
      console.log(`Verified: Final account balance updated back to $${finalAcc.balance} (expected $1490)`);
      if (finalAcc.balance !== 1490) {
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
      await User.deleteOne({ _id: userId });
      console.log('Cleanup completed.');
    }
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

runTests();
