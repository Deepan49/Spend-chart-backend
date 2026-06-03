const mongoose = require('mongoose');
const Holding = require('../models/Holding');
const stockService = require('../services/stockService');

exports.getPortfolio = async (req, res) => {
  try {
    const holdings = await Holding.find({ userId: req.user.userId });
    if (holdings.length === 0) return res.json({ totalValue: 0, totalGain: 0, holdings: [] });

    const symbols = holdings.map(h => h.symbol);
    const currentPrices = await stockService.getBatchPrices(symbols);

    let totalValue = 0;
    let totalCost = 0;

    const detailedHoldings = holdings.map(h => {
      const currentPrice = currentPrices[h.symbol] || 0;
      const value = h.shares * currentPrice;
      const cost = h.shares * h.avgPrice;
      const gain = value - cost;
      
      totalValue += value;
      totalCost += cost;

      return {
        symbol: h.symbol,
        shares: h.shares,
        avgPrice: h.avgPrice,
        currentPrice,
        value,
        gain,
        gainPercent: cost > 0 ? (gain / cost) * 100 : 0
      };
    });

    res.json({
      totalValue,
      totalCost,
      totalGain: totalValue - totalCost,
      gainPercent: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
      holdings: detailedHoldings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addHolding = async (req, res) => {
  try {
    const { symbol, shares, avgPrice } = req.body;
    let holding = await Holding.findOne({ userId: req.user.userId, symbol });

    if (holding) {
      // Update existing holding (Weighted average)
      const totalShares = holding.shares + shares;
      const totalCost = (holding.shares * holding.avgPrice) + (shares * avgPrice);
      holding.avgPrice = totalCost / totalShares;
      holding.shares = totalShares;
      await holding.save();
    } else {
      holding = new Holding({ userId: req.user.userId, symbol, shares, avgPrice });
      await holding.save();
    }
    
    res.status(201).json(holding);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateHolding = async (req, res) => {
  try {
    const { shares, avgPrice, symbol } = req.body;
    let holding;
    
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      holding = await Holding.findOne({ _id: req.params.id, userId: req.user.userId });
    }
    
    if (!holding && symbol) {
      holding = await Holding.findOne({ symbol, userId: req.user.userId });
    }
    if (!holding && req.params.id) {
      holding = await Holding.findOne({ symbol: req.params.id, userId: req.user.userId });
    }

    if (!holding) {
      return res.status(404).json({ success: false, message: 'Holding not found' });
    }

    if (shares !== undefined) holding.shares = shares;
    if (avgPrice !== undefined) holding.avgPrice = avgPrice;
    if (symbol !== undefined) holding.symbol = symbol;

    await holding.save();
    res.json({ success: true, holding });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteHolding = async (req, res) => {
  try {
    let holding;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      holding = await Holding.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    }
    
    if (!holding) {
      holding = await Holding.findOneAndDelete({ symbol: req.params.id, userId: req.user.userId });
    }

    if (!holding) {
      return res.status(404).json({ success: false, message: 'Holding not found' });
    }

    res.json({ success: true, message: 'Holding deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
