const BondHolding = require('../models/BondHolding');

exports.getBondHoldings = async (req, res) => {
  try {
    const holdings = await BondHolding.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(holdings);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addBondHolding = async (req, res) => {
  try {
    const { bondName, faceValue, quantity, buyPrice, couponRate, maturityDate } = req.body;
    const name = (bondName || '').trim();

    let holding = await BondHolding.findOne({
      userId: req.user.userId,
      bondName: { $regex: new RegExp(`^${name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
    });

    if (holding) {
      const totalQuantity = holding.quantity + quantity;
      const totalCost = (holding.quantity * holding.buyPrice) + (quantity * buyPrice);
      holding.buyPrice = totalQuantity > 0 ? (totalCost / totalQuantity) : 0;
      holding.quantity = totalQuantity;
      if (faceValue !== undefined) holding.faceValue = faceValue;
      if (couponRate !== undefined) holding.couponRate = couponRate;
      if (maturityDate !== undefined) holding.maturityDate = new Date(maturityDate);
      await holding.save();
    } else {
      holding = new BondHolding({
        userId: req.user.userId,
        bondName: name,
        faceValue,
        quantity,
        buyPrice,
        couponRate,
        maturityDate: maturityDate ? new Date(maturityDate) : undefined
      });
      await holding.save();
    }
    
    res.status(201).json(holding);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateBondHolding = async (req, res) => {
  try {
    const { bondName, faceValue, quantity, buyPrice, couponRate, maturityDate } = req.body;
    const holding = await BondHolding.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!holding) {
      return res.status(404).json({ success: false, message: 'Holding not found' });
    }

    if (bondName !== undefined) holding.bondName = bondName;
    if (faceValue !== undefined) holding.faceValue = faceValue;
    if (quantity !== undefined) holding.quantity = quantity;
    if (buyPrice !== undefined) holding.buyPrice = buyPrice;
    if (couponRate !== undefined) holding.couponRate = couponRate;
    if (maturityDate !== undefined) holding.maturityDate = new Date(maturityDate);

    await holding.save();
    res.json(holding);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteBondHolding = async (req, res) => {
  try {
    const holding = await BondHolding.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!holding) {
      return res.status(404).json({ success: false, message: 'Holding not found' });
    }
    res.json({ success: true, message: 'Holding deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
