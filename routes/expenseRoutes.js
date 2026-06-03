const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const auth = require('../middleware/authMiddleware');

router.get('/summary', auth, expenseController.getSummary);
router.get('/', auth, expenseController.getExpenses);
router.post('/', auth, expenseController.addExpense);
router.post('/batch', auth, expenseController.batchAddExpenses);
router.post('/import', auth, expenseController.importStatement);
router.delete('/:id', auth, expenseController.deleteExpense);
router.post('/batch-delete', auth, expenseController.batchDeleteExpenses);

module.exports = router;
