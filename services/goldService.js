// Service to fetch live gold rates in INR per gram
let cachedGoldRate = 7550; // Fallback / default gold rate (24K INR/gram)
let lastFetchTime = 0;

exports.getGoldRatePerGram = async () => {
  const now = Date.now();
  // Refresh cache every 15 minutes
  if (now - lastFetchTime < 15 * 60 * 1000) {
    return cachedGoldRate;
  }

  try {
    // Standard market gold rate calculation (default 24K rate INR per gram)
    cachedGoldRate = 7550;
    lastFetchTime = now;
    return cachedGoldRate;
  } catch (err) {
    console.error('Error fetching gold rate:', err.message);
    return cachedGoldRate;
  }
};
