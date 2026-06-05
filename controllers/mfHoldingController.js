const MfHolding = require('../models/MfHolding');

exports.getMfHoldings = async (req, res) => {
  try {
    const holdings = await MfHolding.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(holdings);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addMfHolding = async (req, res) => {
  try {
    const { schemeCode, schemeName, units, avgNav } = req.body;
    const sCode = (schemeCode || '').trim();

    let holding = await MfHolding.findOne({
      userId: req.user.userId,
      schemeCode: sCode
    });

    if (holding) {
      const totalUnits = holding.units + units;
      const totalCost = (holding.units * holding.avgNav) + (units * avgNav);
      holding.avgNav = totalUnits > 0 ? (totalCost / totalUnits) : 0;
      holding.units = totalUnits;
      if (schemeName) holding.schemeName = schemeName;
      await holding.save();
    } else {
      holding = new MfHolding({
        userId: req.user.userId,
        schemeCode: sCode,
        schemeName,
        units,
        avgNav
      });
      await holding.save();
    }
    
    res.status(201).json(holding);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateMfHolding = async (req, res) => {
  try {
    const { schemeCode, schemeName, units, avgNav } = req.body;
    const holding = await MfHolding.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!holding) {
      return res.status(404).json({ success: false, message: 'Holding not found' });
    }

    if (schemeCode !== undefined) holding.schemeCode = schemeCode;
    if (schemeName !== undefined) holding.schemeName = schemeName;
    if (units !== undefined) holding.units = units;
    if (avgNav !== undefined) holding.avgNav = avgNav;

    await holding.save();
    res.json(holding);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.deleteMfHolding = async (req, res) => {
  try {
    const holding = await MfHolding.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!holding) {
      return res.status(404).json({ success: false, message: 'Holding not found' });
    }
    res.json({ success: true, message: 'Holding deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
