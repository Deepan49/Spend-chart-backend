const GoldHolding = require('../models/GoldHolding');

exports.getGoldHoldings = async (req, res) => {
  try {
    const holdings = await GoldHolding.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(holdings);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addGoldHolding = async (req, res) => {
  try {
    const { metalType, purity, weight, avgPrice } = req.body;
    const mType = (metalType || 'GOLD').trim().toUpperCase();
    const pur = (purity || '24K').trim().toUpperCase();

    let holding = await GoldHolding.findOne({
      userId: req.user.userId,
      metalType: mType,
      purity: pur
    });

    if (holding) {
      const totalWeight = holding.weight + weight;
      const totalCost = (holding.weight * holding.avgPrice) + (weight * avgPrice);
      holding.avgPrice = totalWeight > 0 ? (totalCost / totalWeight) : 0;
      holding.weight = totalWeight;
      await holding.save();
    } else {
      holding = new GoldHolding({
        userId: req.user.userId,
        metalType: mType,
        purity: pur,
        weight,
        avgPrice
      });
      await holding.save();
    }
    
    res.status(201).json(holding);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateGoldHolding = async (req, res) => {
  try {
    const { metalType, purity, weight, avgPrice } = req.body;
    const holding = await GoldHolding.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!holding) {
      return res.status(404).json({ success: false, message: 'Holding not found' });
    }

    if (metalType !== undefined) holding.metalType = metalType;
    if (purity !== undefined) holding.purity = purity;
    if (weight !== undefined) holding.weight = weight;
    if (avgPrice !== undefined) holding.avgPrice = avgPrice;

    await holding.save();
    res.json(holding);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteGoldHolding = async (req, res) => {
  try {
    const holding = await GoldHolding.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!holding) {
      return res.status(404).json({ success: false, message: 'Holding not found' });
    }
    res.json({ success: true, message: 'Holding deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
