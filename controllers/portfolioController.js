const mongoose = require('mongoose');
const Holding = require('../models/Holding');
const Gold = require('../models/Gold');
const MutualFund = require('../models/MutualFund');
const Bond = require('../models/Bond');
const stockService = require('../services/stockService');
const goldService = require('../services/goldService');

// ─── Stocks / General Holdings ───────────────────────────────────────────────
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
        _id: h._id,
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

// ─── Gold Holdings Endpoints ────────────────────────────────────────────────
exports.getGoldHoldings = async (req, res) => {
  try {
    const goldHoldings = await Gold.find({ userId: req.user.userId }).sort({ purchaseDate: -1 });
    const liveRatePerGram = await goldService.getGoldRatePerGram();

    let totalWeightGrams = 0;
    let totalInvested = 0;
    let currentValue = 0;

    const detailedHoldings = goldHoldings.map(g => {
      totalWeightGrams += g.weightGrams;
      totalInvested += g.totalAmountPaid;
      const itemCurrentValue = g.weightGrams * liveRatePerGram;
      currentValue += itemCurrentValue;
      const gain = itemCurrentValue - g.totalAmountPaid;

      return {
        _id: g._id,
        name: g.name,
        type: g.type,
        weightGrams: g.weightGrams,
        buyPricePerGram: g.buyPricePerGram,
        totalAmountPaid: g.totalAmountPaid,
        currentRatePerGram: liveRatePerGram,
        currentValue: itemCurrentValue,
        gain,
        gainPercent: g.totalAmountPaid > 0 ? (gain / g.totalAmountPaid) * 100 : 0,
        purchaseDate: g.purchaseDate,
        notes: g.notes
      };
    });

    const totalGain = currentValue - totalInvested;

    res.json({
      success: true,
      liveRatePerGram,
      totalWeightGrams,
      totalInvested,
      currentValue,
      totalGain,
      gainPercent: totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0,
      holdings: detailedHoldings
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.addGoldHolding = async (req, res) => {
  try {
    const { name, type, weightGrams, buyPricePerGram, totalAmountPaid, purchaseDate, notes } = req.body;
    if (!weightGrams || weightGrams <= 0) {
      return res.status(400).json({ success: false, message: 'Weight in grams is required' });
    }

    const calculatedPaid = totalAmountPaid || (weightGrams * (buyPricePerGram || 0));

    const goldHolding = new Gold({
      userId: req.user.userId,
      name: name || `${weightGrams}g ${type || 'Physical'} Gold`,
      type: type || 'physical',
      weightGrams,
      buyPricePerGram: buyPricePerGram || (calculatedPaid / weightGrams),
      totalAmountPaid: calculatedPaid,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      notes
    });

    await goldHolding.save();
    res.status(201).json({ success: true, holding: goldHolding });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateGoldHolding = async (req, res) => {
  try {
    const holding = await Gold.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!holding) {
      return res.status(404).json({ success: false, message: 'Gold holding not found' });
    }

    Object.assign(holding, req.body);
    holding.userId = req.user.userId;
    await holding.save();

    res.json({ success: true, holding });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.deleteGoldHolding = async (req, res) => {
  try {
    const holding = await Gold.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!holding) {
      return res.status(404).json({ success: false, message: 'Gold holding not found' });
    }
    res.json({ success: true, message: 'Gold holding deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Mutual Funds Endpoints ─────────────────────────────────────────────────
exports.getMFHoldings = async (req, res) => {
  try {
    const mfHoldings = await MutualFund.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    let totalInvested = 0;
    let currentValue = 0;

    const detailedHoldings = mfHoldings.map(mf => {
      totalInvested += mf.totalInvested;
      const nav = mf.currentNav > 0 ? mf.currentNav : mf.buyNav;
      const itemVal = mf.units * nav;
      currentValue += itemVal;
      const gain = itemVal - mf.totalInvested;

      return {
        _id: mf._id,
        schemeName: mf.schemeName,
        schemeCode: mf.schemeCode,
        units: mf.units,
        buyNav: mf.buyNav,
        currentNav: nav,
        totalInvested: mf.totalInvested,
        currentValue: itemVal,
        gain,
        gainPercent: mf.totalInvested > 0 ? (gain / mf.totalInvested) * 100 : 0,
        category: mf.category,
        purchaseDate: mf.purchaseDate
      };
    });

    const totalGain = currentValue - totalInvested;

    res.json({
      success: true,
      totalInvested,
      currentValue,
      totalGain,
      gainPercent: totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0,
      holdings: detailedHoldings
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.addMFHolding = async (req, res) => {
  try {
    const { schemeName, schemeCode, units, buyNav, currentNav, totalInvested, category, purchaseDate } = req.body;
    const calcInvested = totalInvested || (units * buyNav);

    const mf = new MutualFund({
      userId: req.user.userId,
      schemeName,
      schemeCode,
      units,
      buyNav,
      currentNav: currentNav || buyNav,
      totalInvested: calcInvested,
      category: category || 'Equity',
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date()
    });

    await mf.save();
    res.status(201).json({ success: true, holding: mf });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateMFHolding = async (req, res) => {
  try {
    const holding = await MutualFund.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!holding) {
      return res.status(404).json({ success: false, message: 'Mutual fund holding not found' });
    }
    Object.assign(holding, req.body);
    holding.userId = req.user.userId;
    await holding.save();
    res.json({ success: true, holding });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.deleteMFHolding = async (req, res) => {
  try {
    const holding = await MutualFund.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!holding) {
      return res.status(404).json({ success: false, message: 'Mutual fund holding not found' });
    }
    res.json({ success: true, message: 'Mutual fund holding deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Bonds Endpoints ────────────────────────────────────────────────────────
exports.getBondHoldings = async (req, res) => {
  try {
    const bonds = await Bond.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    let totalInvested = 0;

    const detailedHoldings = bonds.map(b => {
      totalInvested += b.totalInvested;
      return {
        _id: b._id,
        bondName: b.bondName,
        issuer: b.issuer,
        units: b.units,
        faceValue: b.faceValue,
        couponRate: b.couponRate,
        purchasePrice: b.purchasePrice,
        totalInvested: b.totalInvested,
        purchaseDate: b.purchaseDate,
        maturityDate: b.maturityDate
      };
    });

    res.json({
      success: true,
      totalInvested,
      currentValue: totalInvested,
      holdings: detailedHoldings
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.addBondHolding = async (req, res) => {
  try {
    const { bondName, issuer, units, faceValue, couponRate, purchasePrice, totalInvested, purchaseDate, maturityDate } = req.body;
    const calcInvested = totalInvested || (units * purchasePrice);

    const bond = new Bond({
      userId: req.user.userId,
      bondName,
      issuer,
      units,
      faceValue,
      couponRate,
      purchasePrice,
      totalInvested: calcInvested,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      maturityDate
    });

    await bond.save();
    res.status(201).json({ success: true, holding: bond });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateBondHolding = async (req, res) => {
  try {
    const holding = await Bond.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!holding) {
      return res.status(404).json({ success: false, message: 'Bond holding not found' });
    }
    Object.assign(holding, req.body);
    holding.userId = req.user.userId;
    await holding.save();
    res.json({ success: true, holding });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.deleteBondHolding = async (req, res) => {
  try {
    const holding = await Bond.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!holding) {
      return res.status(404).json({ success: false, message: 'Bond holding not found' });
    }
    res.json({ success: true, message: 'Bond holding deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Overall Portfolio Analysis ─────────────────────────────────────────────
exports.getPortfolioAnalysis = async (req, res) => {
  try {
    const userId = req.user.userId;
    const [stocks, gold, mf, bonds] = await Promise.all([
      Holding.find({ userId }),
      Gold.find({ userId }),
      MutualFund.find({ userId }),
      Bond.find({ userId })
    ]);

    let stocksValue = 0;
    stocks.forEach(s => stocksValue += (s.shares * s.avgPrice));

    let goldValue = 0;
    const goldRate = await goldService.getGoldRatePerGram();
    gold.forEach(g => goldValue += (g.weightGrams * goldRate));

    let mfValue = 0;
    mf.forEach(m => mfValue += m.totalInvested);

    let bondsValue = 0;
    bonds.forEach(b => bondsValue += b.totalInvested);

    const totalNetWorth = stocksValue + goldValue + mfValue + bondsValue;

    res.json({
      success: true,
      totalNetWorth,
      allocation: {
        stocks: { amount: stocksValue, percentage: totalNetWorth > 0 ? (stocksValue / totalNetWorth) * 100 : 0 },
        gold: { amount: goldValue, percentage: totalNetWorth > 0 ? (goldValue / totalNetWorth) * 100 : 0 },
        mutualFunds: { amount: mfValue, percentage: totalNetWorth > 0 ? (mfValue / totalNetWorth) * 100 : 0 },
        bonds: { amount: bondsValue, percentage: totalNetWorth > 0 ? (bondsValue / totalNetWorth) * 100 : 0 }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
