const express = require('express');
const router = express.Router();
const mfHoldingController = require('../controllers/mfHoldingController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, mfHoldingController.getMfHoldings);
router.post('/', auth, mfHoldingController.addMfHolding);
router.put('/:id', auth, mfHoldingController.updateMfHolding);
router.delete('/:id', auth, mfHoldingController.deleteMfHolding);

module.exports = router;
