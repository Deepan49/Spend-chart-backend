const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

router.get('/prices', stockController.getBatchPrices);
router.get('/search', stockController.searchStocks);
router.get('/batch', stockController.getBatchPrices);
router.get('/:symbol', stockController.getPrice);

module.exports = router;
