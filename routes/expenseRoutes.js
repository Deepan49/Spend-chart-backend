const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const auth = require('../middleware/authMiddleware');

router.get('/summary', auth, expenseController.getSummary);
router.get('/', auth, expenseController.getExpenses);
router.post('/', auth, expenseController.addExpense);
router.post('/batch', auth, expenseController.batchAddExpenses);
router.delete('/:id', auth, expenseController.deleteExpense);

module.exports = router;
