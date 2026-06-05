const express = require('express');
const router = express.Router();
const goldHoldingController = require('../controllers/goldHoldingController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, goldHoldingController.getGoldHoldings);
router.post('/', auth, goldHoldingController.addGoldHolding);
router.put('/:id', auth, goldHoldingController.updateGoldHolding);
router.delete('/:id', auth, goldHoldingController.deleteGoldHolding);

module.exports = router;
