const express = require('express');
const router = express.Router();
const portfolioController = require('../controllers/portfolioController');
const auth = require('../middleware/authMiddleware');

router.get('/', auth, portfolioController.getPortfolio);
router.post('/', auth, portfolioController.addHolding);

module.exports = router;
