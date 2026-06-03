const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, budgetController.getBudgets);
router.post('/', auth, budgetController.createBudget);
router.put('/:id', auth, budgetController.updateBudget);
router.delete('/:id', auth, budgetController.deleteBudget);

module.exports = router;
