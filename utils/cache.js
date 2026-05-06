const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 15 });

exports.get = (key) => cache.get(key);
exports.set = (key, value) => cache.set(key, value);
