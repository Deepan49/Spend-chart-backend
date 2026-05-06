const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token, access denied' });
    }

    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (!verified) {
      return res.status(401).json({ error: 'Token verification failed, access denied' });
    }

    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token, access denied' });
  }
};
