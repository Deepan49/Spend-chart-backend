const express = require('express');
const router = express.Router();
const bondHoldingController = require('../controllers/bondHoldingController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, bondHoldingController.getBondHoldings);
router.post('/', auth, bondHoldingController.addBondHolding);
router.put('/:id', auth, bondHoldingController.updateBondHolding);
router.delete('/:id', auth, bondHoldingController.deleteBondHolding);

module.exports = router;
