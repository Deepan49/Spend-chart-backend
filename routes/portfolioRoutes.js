const express = require('express');
const router = express.Router();
const portfolioController = require('../controllers/portfolioController');
const auth = require('../middleware/authMiddleware');

// Stocks / General Holdings
router.get('/', auth, portfolioController.getPortfolio);
router.post('/', auth, portfolioController.addHolding);
router.put('/:id', auth, portfolioController.updateHolding);
router.delete('/:id', auth, portfolioController.deleteHolding);

// Gold Holdings
router.get('/gold', auth, portfolioController.getGoldHoldings);
router.post('/gold', auth, portfolioController.addGoldHolding);
router.put('/gold/:id', auth, portfolioController.updateGoldHolding);
router.delete('/gold/:id', auth, portfolioController.deleteGoldHolding);

// Mutual Funds Holdings
router.get('/mf', auth, portfolioController.getMFHoldings);
router.post('/mf', auth, portfolioController.addMFHolding);
router.put('/mf/:id', auth, portfolioController.updateMFHolding);
router.delete('/mf/:id', auth, portfolioController.deleteMFHolding);

// Bond Holdings
router.get('/bonds', auth, portfolioController.getBondHoldings);
router.post('/bonds', auth, portfolioController.addBondHolding);
router.put('/bonds/:id', auth, portfolioController.updateBondHolding);
router.delete('/bonds/:id', auth, portfolioController.deleteBondHolding);

// Overall Portfolio Analysis
router.get('/analysis', auth, portfolioController.getPortfolioAnalysis);

module.exports = router;
