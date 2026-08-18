const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const auth = require('../middleware/authMiddleware');

// 1. Dedicated Stats Summary API
router.get('/summary', auth, budgetController.getBudgetSummary);

// 2. Dedicated Categories List API
router.get('/categories', auth, budgetController.getCategoryBudgets);

// 3. Dedicated Periods / Filter Metadata API
router.get('/periods', auth, budgetController.getBudgetPeriods);

// 4. Dedicated Category Mutation APIs
router.post('/category', auth, budgetController.createOrUpdateCategoryBudget);
router.put('/category/:id', auth, budgetController.updateBudget);
router.delete('/category/:id', auth, budgetController.deleteBudget);

// Backward Compatibility
router.get('/', auth, budgetController.getBudgets);
router.post('/', auth, budgetController.createBudget);
router.put('/:id', auth, budgetController.updateBudget);
router.delete('/:id', auth, budgetController.deleteBudget);

module.exports = router;
