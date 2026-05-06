const stockService = require('../services/stockService');

exports.getPrice = async (req, res) => {
  try {
    const { symbol } = req.params;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });
    
    const price = await stockService.getStockPrice(symbol);
    res.json({ symbol, price });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getBatchPrices = async (req, res) => {
  try {
    const { symbols } = req.query; // Expecting comma-separated symbols
    if (!symbols) return res.status(400).json({ error: 'Symbols are required' });
    
    const symbolList = symbols.split(',').map(s => s.trim());
    const prices = await stockService.getBatchPrices(symbolList);
    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.searchStocks = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query is required' });
    
    const results = await stockService.search(q);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
