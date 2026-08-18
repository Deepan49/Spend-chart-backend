const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const auth = require('../middleware/authMiddleware');

router.get('/summary', auth, expenseController.getSummary);
router.get('/search', auth, expenseController.searchExpenses);
router.get('/by-month', auth, expenseController.getExpensesByMonth);
router.get('/filter', auth, expenseController.getFilteredExpenses);
router.get('/history', auth, expenseController.getTransactionHistory);
router.get('/categories', auth, expenseController.getCategories);
router.get('/detect-transfers', auth, expenseController.detectTransferCandidates);
router.post('/confirm-transfer', auth, expenseController.confirmTransfer);
router.post('/transfer', auth, expenseController.addTransfer);
router.get('/', auth, expenseController.getExpenses);
router.post('/', auth, expenseController.addExpense);
router.post('/batch', auth, expenseController.batchAddExpenses);
router.post('/import', auth, expenseController.importStatement);
router.delete('/:id', auth, expenseController.deleteExpense);
router.patch('/:id', auth, expenseController.updateExpense);
router.post('/batch-delete', auth, expenseController.batchDeleteExpenses);

module.exports = router;
